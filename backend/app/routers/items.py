"""Reports (lost / found), search, matches, feedback and claims."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from matcher import get_matcher

from ..auth import Actor, get_actor, get_actor_optional
from ..db import get_db
from ..dropoffs import get_dropoffs
from ..models import Claim, Item, Match, utcnow
from ..serializers import claim_view, item_view, match_view
from ..services import audit
from ..services.images import ImageError, process
from ..services.matching import ACTIVE, MATCHABLE, enrich, refresh_matches, search_scores
from ..services.storage import get_storage

router = APIRouter(tags=["items"])
MAX_PHOTOS = 3
FUTURE_SLACK = timedelta(hours=1)


class ItemFields(BaseModel):
    kind: Literal["lost", "found"]
    title: str = Field(default="", max_length=120)
    description: str = Field(min_length=3, max_length=2000)
    marks_text: str = Field(default="", max_length=500)
    private_detail: str = Field(default="", max_length=500)
    category: str = Field(min_length=1, max_length=40)
    colors: list[str] = Field(default_factory=list, max_length=3)
    brand: str | None = Field(default=None, max_length=40)
    locations: list[str] = Field(default_factory=list, max_length=5)
    location_note: str = Field(default="", max_length=200)
    time_from: datetime
    time_to: datetime | None = None
    holding: str | None = Field(default=None, max_length=20)  # dropoffs.yaml point id | with_finder | other
    holding_note: str = Field(default="", max_length=200)


CloseReason = Literal["found_myself", "from_desk", "gave_up"]


def _split(value: str | None) -> list[str]:
    return [v.strip() for v in (value or "").split(",") if v.strip()]


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def validate_fields(f: ItemFields) -> ItemFields:
    v = get_matcher().vocab
    if f.category != "other" and f.category not in v.categories:
        raise HTTPException(422, "unknown_category")
    if any(c not in v.colors for c in f.colors):
        raise HTTPException(422, "unknown_color")
    f.locations = [v.canon_place(p) for p in f.locations]
    if any(p not in v.places for p in f.locations):
        raise HTTPException(422, "unknown_location")
    if f.brand and f.brand not in v.brands:
        raise HTTPException(422, "unknown_brand")
    f.time_from, f.time_to = _aware(f.time_from), _aware(f.time_to)
    now = utcnow()
    if f.time_from > now + FUTURE_SLACK or (f.time_to and f.time_to > now + FUTURE_SLACK):
        raise HTTPException(422, "time_in_future")
    if f.kind == "found":
        f.time_to = None
        f.holding = get_dropoffs().canon(f.holding)
        if f.holding is not None and not get_dropoffs().valid(f.holding):
            raise HTTPException(422, "unknown_holding")
    else:
        f.holding, f.holding_note, f.private_detail = None, "", ""
        if f.time_to and f.time_to < f.time_from:
            f.time_from, f.time_to = f.time_to, f.time_from
    f.locations = list(dict.fromkeys(f.locations))
    f.colors = list(dict.fromkeys(f.colors))
    return f


def item_form(
    kind: str = Form(...), title: str = Form(""), description: str = Form(...), marks_text: str = Form(""),
    private_detail: str = Form(""), category: str = Form(...), colors: str = Form(""), brand: str = Form(""),
    locations: str = Form(""), location_note: str = Form(""), time_from: str = Form(...), time_to: str = Form(""),
    holding: str = Form(""), holding_note: str = Form(""),
) -> ItemFields:
    try:
        return ItemFields(kind=kind, title=title.strip(), description=description.strip(), marks_text=marks_text.strip(),
                          private_detail=private_detail.strip(), category=category, colors=_split(colors),
                          brand=brand or None, locations=_split(locations), location_note=location_note.strip(),
                          time_from=time_from, time_to=time_to or None, holding=holding or None,
                          holding_note=holding_note.strip())
    except ValidationError as exc:
        raise HTTPException(422, exc.errors(include_url=False, include_context=False)) from exc


def _save_photos(item: Item, photos: list[UploadFile]) -> list[dict]:
    storage = get_storage()
    saved = []
    for upload in photos[:MAX_PHOTOS]:
        data = upload.file.read()
        if not data:
            continue
        try:
            full, thumb, w, h = process(data)
        except ImageError as exc:
            raise HTTPException(422, f"photo_{exc}") from exc
        stem = f"items/{item.id}/{uuid.uuid4().hex}"
        storage.put(f"{stem}.jpg", full, "image/jpeg")
        storage.put(f"{stem}_t.jpg", thumb, "image/jpeg")
        saved.append({"key": f"{stem}.jpg", "thumb": f"{stem}_t.jpg", "w": w, "h": h})
    return saved


def _matches_for(db: Session, item: Item, viewer: Actor | None) -> list[dict]:
    col, other_col = (Match.lost_id, Match.found_id) if item.kind == "lost" else (Match.found_id, Match.lost_id)
    rows = db.execute(
        select(Match, Item).join(Item, Item.id == other_col)
        .where(col == item.id, Item.is_hidden.is_(False), Item.status.in_(ACTIVE + ("returned",)))
        .order_by(Match.probability.desc())).unique().all()
    return [match_view(m, other, viewer) for m, other in rows]


def get_item_or_404(db: Session, item_id: uuid.UUID, viewer: Actor | None) -> Item:
    item = db.get(Item, item_id)
    if item is None:
        raise HTTPException(404, "not_found")
    if item.is_hidden and not (viewer and (viewer.is_admin or viewer.id == item.reporter_id)):
        raise HTTPException(404, "not_found")
    return item


# --------------------------------------------------------------------------- create
@router.post("/items", status_code=201)
def create_item(fields: ItemFields = Depends(item_form), photos: list[UploadFile] = File(default=[]),
                actor: Actor = Depends(get_actor), db: Session = Depends(get_db)) -> dict:
    f = validate_fields(fields)
    if f.kind == "found" and f.holding is None:
        f.holding = actor.desk or get_dropoffs().desks[0]
    cat = get_matcher().vocab.categories.get(f.category)
    if cat and cat.sensitive and any(p.filename for p in photos):
        raise HTTPException(422, "photos_not_allowed_for_sensitive_items")
    if len([p for p in photos if p.filename]) > MAX_PHOTOS:
        raise HTTPException(422, "too_many_photos")
    item = Item(reporter_id=actor.id, **f.model_dump())
    db.add(item)
    db.flush()
    item.photos = _save_photos(item, [p for p in photos if p.filename])
    enrich(item)
    db.flush()
    refresh_matches(db, item)
    audit.log(db, actor.id, "item.create", "item", item.id, kind=item.kind)
    db.commit()
    db.refresh(item)
    return {"item": item_view(item, actor), "matches": _matches_for(db, item, actor)}


# --------------------------------------------------------------------------- read
@router.get("/items")
def list_items(
    kind: Literal["lost", "found"] = "found", q: str = Query("", max_length=200), category: str = "",
    color: str = "", zone: str = "", place: str = "", date_from: datetime | None = None,
    date_to: datetime | None = None, status: Literal["active", "returned", "all"] = "active",
    sort: Literal["new", "relevance"] = "new", page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=60), viewer: Actor | None = Depends(get_actor_optional),
    db: Session = Depends(get_db),
) -> dict:
    v = get_matcher().vocab
    stmt = select(Item).where(Item.kind == kind, Item.is_hidden.is_(False))
    if status == "active":
        stmt = stmt.where(Item.status.in_(ACTIVE))
    elif status == "returned":
        stmt = stmt.where(Item.status == "returned")
    if category:
        subcats = [category] if category in v.categories or category == "other" else \
            [c for c, cat in v.categories.items() if cat.parent == category]
        stmt = stmt.where(Item.category.in_(subcats or [category]))
    if date_from:
        stmt = stmt.where(Item.time_from >= _aware(date_from))
    if date_to:
        stmt = stmt.where(Item.time_from <= _aware(date_to))
    items = list(db.scalars(stmt.order_by(Item.created_at.desc()).limit(800)).unique().all())
    if color:
        items = [i for i in items if color in (i.colors or [])]
    if q.strip():
        scores = search_scores(q, items)
        floor = 0.45 if get_matcher().embedder is not None else 0.08
        items = [i for i in items if scores.get(i.id, 0) >= floor]
        items.sort(key=lambda i: -scores[i.id])
    # Per-zone counts under every filter except the place/zone one: the campus map is that filter.
    zones: dict[str, int] = {}
    for i in items:
        for z in {v.zone_of(p) for p in i.locations or []} - {None}:
            zones[z] = zones.get(z, 0) + 1
    if place:
        items = [i for i in items if place in (i.locations or [])]
    elif zone:
        items = [i for i in items if any(v.zone_of(p) == zone for p in i.locations or [])]
    total = len(items)
    start = (page - 1) * page_size
    return {"items": [item_view(i, viewer) for i in items[start:start + page_size]], "total": total,
            "page": page, "page_size": page_size, "zones": zones}


@router.get("/items/{item_id}")
def get_item(item_id: uuid.UUID, viewer: Actor | None = Depends(get_actor_optional),
             db: Session = Depends(get_db)) -> dict:
    item = get_item_or_404(db, item_id, viewer)
    out = {"item": item_view(item, viewer)}
    if viewer and (viewer.is_admin or viewer.id == item.reporter_id):
        out["matches"] = _matches_for(db, item, viewer)
    if viewer and item.kind == "found":
        mine = db.scalars(select(Claim).where(Claim.found_id == item.id, Claim.claimant_id == viewer.id)
                          .order_by(Claim.created_at.desc())).first()
        out["my_claim"] = claim_view(mine, None, viewer) if mine else None
    return out


@router.get("/items/{item_id}/matches")
def item_matches(item_id: uuid.UUID, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)) -> dict:
    item = get_item_or_404(db, item_id, actor)
    if not (actor.is_admin or actor.id == item.reporter_id):
        raise HTTPException(403, "not_owner")
    return {"matches": _matches_for(db, item, actor)}


# --------------------------------------------------------------------------- update
class ItemPatch(BaseModel):
    title: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, min_length=3, max_length=2000)
    marks_text: str | None = Field(default=None, max_length=500)
    private_detail: str | None = Field(default=None, max_length=500)
    category: str | None = None
    colors: list[str] | None = None
    brand: str | None = None
    locations: list[str] | None = None
    location_note: str | None = Field(default=None, max_length=200)
    holding: str | None = Field(default=None, max_length=20)
    holding_note: str | None = Field(default=None, max_length=200)
    status: Literal["open", "closed"] | None = None
    close_reason: CloseReason | None = None  # lost reports: why the owner closed it


CONTENT_FIELDS = {"title", "description", "marks_text", "private_detail", "category", "colors", "brand", "locations"}


@router.patch("/items/{item_id}")
def update_item(item_id: uuid.UUID, body: ItemPatch, actor: Actor = Depends(get_actor),
                db: Session = Depends(get_db)) -> dict:
    item = get_item_or_404(db, item_id, actor)
    if not (actor.is_admin or actor.id == item.reporter_id):
        raise HTTPException(403, "not_owner")
    changes = body.model_dump(exclude_unset=True)
    status = changes.pop("status", None)
    close_reason = changes.pop("close_reason", None)
    if changes:
        merged = ItemFields(**{**{k: getattr(item, k) for k in ItemFields.model_fields}, **changes})
        f = validate_fields(merged)
        for key in changes:
            setattr(item, key, getattr(f, key))
    if status == "closed" and item.status in ACTIVE:
        item.status, item.closed_at = "closed", utcnow()
        attrs = {k: v for k, v in (item.attrs or {}).items() if k != "close_reason"}
        item.attrs = {**attrs, "close_reason": close_reason} if close_reason else attrs
    elif status == "open" and item.status == "closed":
        item.status, item.closed_at = "open", None
        item.attrs = {k: v for k, v in (item.attrs or {}).items() if k != "close_reason"}
    if CONTENT_FIELDS & set(changes):
        enrich(item)
    db.flush()
    refresh_matches(db, item)
    audit.log(db, actor.id, "item.update", "item", item.id, fields=sorted(changes), status=status,
              close_reason=close_reason)
    db.commit()
    return {"item": item_view(item, actor), "matches": _matches_for(db, item, actor)}


# --------------------------------------------------------------------------- feedback
class Feedback(BaseModel):
    verdict: Literal["confirmed", "rejected"] | None


@router.post("/matches/{match_id}/feedback")
def match_feedback(match_id: uuid.UUID, body: Feedback, actor: Actor = Depends(get_actor),
                   db: Session = Depends(get_db)) -> dict:
    match = db.get(Match, match_id)
    if match is None:
        raise HTTPException(404, "not_found")
    lost = db.get(Item, match.lost_id)
    if not (actor.is_admin or (lost and lost.reporter_id == actor.id)):
        raise HTTPException(403, "not_owner")
    match.feedback = body.verdict
    match.feedback_at = utcnow() if body.verdict else None
    if body.verdict == "confirmed" and lost.status == "open":
        lost.status = "matched"
    audit.log(db, actor.id, "match.feedback", "match", match.id, verdict=body.verdict,
              probability=match.probability, band=match.band)
    db.commit()
    return {"ok": True, "feedback": match.feedback}


# --------------------------------------------------------------------------- claims
class ClaimRequest(BaseModel):
    proof: str = Field(min_length=5, max_length=1000)
    lost_item_id: uuid.UUID | None = None


@router.post("/items/{item_id}/claims", status_code=201)
def create_claim(item_id: uuid.UUID, body: ClaimRequest, actor: Actor = Depends(get_actor),
                 db: Session = Depends(get_db)) -> dict:
    item = get_item_or_404(db, item_id, actor)
    if item.kind != "found":
        raise HTTPException(422, "only_found_items_can_be_claimed")
    if get_dropoffs().is_shelf(item.holding):
        raise HTTPException(422, "shelf_item_self_service")
    if item.status not in MATCHABLE:
        raise HTTPException(409, "item_not_claimable")
    if item.reporter_id == actor.id:
        raise HTTPException(422, "cannot_claim_own_item")
    pending = db.scalar(select(func.count()).select_from(Claim).where(
        Claim.found_id == item.id, Claim.claimant_id == actor.id, Claim.status == "pending"))
    if pending:
        raise HTTPException(409, "claim_already_pending")
    lost_id = None
    if body.lost_item_id:
        lost = db.get(Item, body.lost_item_id)
        if lost and lost.reporter_id == actor.id and lost.kind == "lost":
            lost_id = lost.id
    claim = Claim(found_id=item.id, lost_id=lost_id, claimant_id=actor.id, proof=body.proof.strip())
    db.add(claim)
    if item.status == "open":
        item.status = "matched"
    audit.log(db, actor.id, "claim.create", "claim", claim.id, found_id=str(item.id))
    db.commit()
    return {"claim": claim_view(claim, item, actor)}


@router.post("/claims/{claim_id}/cancel")
def cancel_claim(claim_id: uuid.UUID, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)) -> dict:
    claim = db.get(Claim, claim_id)
    if claim is None or claim.claimant_id != actor.id:
        raise HTTPException(404, "not_found")
    if claim.status != "pending":
        raise HTTPException(409, "claim_not_pending")
    claim.status, claim.decided_at = "cancelled", utcnow()
    item = db.get(Item, claim.found_id)
    others = db.scalar(select(func.count()).select_from(Claim).where(
        Claim.found_id == claim.found_id, Claim.status == "pending", Claim.id != claim.id))
    if item and item.status == "matched" and not others:
        item.status = "open"
    db.commit()
    return {"claim": claim_view(claim, item, actor)}


# --------------------------------------------------------------------------- open shelf
class Collected(BaseModel):
    lost_item_id: uuid.UUID | None = None


@router.post("/items/{item_id}/collected")
def mark_collected(item_id: uuid.UUID, body: Collected, actor: Actor = Depends(get_actor),
                   db: Session = Depends(get_db)) -> dict:
    """Open-shelf items have no one on duty to hand them over: whoever takes one marks it taken,
    so the next person doesn't walk to an empty shelf."""
    item = get_item_or_404(db, item_id, actor)
    if item.kind != "found" or not get_dropoffs().is_shelf(item.holding):
        raise HTTPException(422, "not_a_shelf_item")
    if item.status not in MATCHABLE:
        raise HTTPException(409, "item_not_claimable")
    now = utcnow()
    item.status, item.returned_at = "returned", now
    item.attrs = {**(item.attrs or {}), "collected_by": str(actor.id), "collected_via": "shelf"}
    lost = db.get(Item, body.lost_item_id) if body.lost_item_id else None
    if lost and lost.reporter_id == actor.id and lost.kind == "lost" and lost.status in ACTIVE:
        lost.status, lost.returned_at = "returned", now
        refresh_matches(db, lost)
    db.flush()
    refresh_matches(db, item)
    audit.log(db, actor.id, "item.collected", "item", item.id, lost_id=str(lost.id) if lost else None)
    db.commit()
    return {"item": item_view(item, actor)}


# --------------------------------------------------------------------------- mine
@router.get("/me/items")
def my_items(actor: Actor = Depends(get_actor), db: Session = Depends(get_db)) -> dict:
    items = db.scalars(select(Item).where(Item.reporter_id == actor.id).order_by(Item.created_at.desc())).unique().all()
    counts = dict(db.execute(
        select(Item.id, func.count(Match.id)).join(Match, or_(Match.lost_id == Item.id, Match.found_id == Item.id))
        .where(Item.reporter_id == actor.id).group_by(Item.id)).all())
    return {"items": [item_view(i, actor, match_count=counts.get(i.id, 0)) for i in items]}


@router.get("/me/claims")
def my_claims(actor: Actor = Depends(get_actor), db: Session = Depends(get_db)) -> dict:
    rows = db.execute(select(Claim, Item).join(Item, Item.id == Claim.found_id)
                      .where(Claim.claimant_id == actor.id).order_by(Claim.created_at.desc())).unique().all()
    return {"claims": [claim_view(c, i, actor) for c, i in rows]}

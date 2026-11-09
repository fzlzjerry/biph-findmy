"""Front desk / club officer tools: moderation, claims, handover, stats, exports."""

from __future__ import annotations

import csv
import io
import json
import statistics
import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from matcher import get_matcher

from ..auth import Actor, require_admin
from ..db import get_db
from ..dropoffs import get_dropoffs
from ..models import Claim, Item, Match, utcnow
from ..serializers import claim_view, item_view
from ..services import audit
from ..services.matching import ACTIVE, MATCHABLE, refresh_matches, rematch_all, search_scores

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])
CST = timezone(timedelta(hours=8))
STATUSES = ("open", "matched", "claimed", "returned", "closed", "expired")


@router.get("/items")
def admin_items(kind: Literal["lost", "found", "all"] = "all", status: str = "all", hidden: bool | None = None,
                q: str = "", dropoff: str = "", limit: int = 300, actor: Actor = Depends(require_admin),
                db: Session = Depends(get_db)) -> dict:
    stmt = select(Item)
    if kind != "all":
        stmt = stmt.where(Item.kind == kind)
    if dropoff:
        stmt = stmt.where(Item.kind == "found", Item.holding.in_(get_dropoffs().stored_as(dropoff)))
    if status != "all":
        stmt = stmt.where(Item.status.in_(status.split(",")))
    if hidden is not None:
        stmt = stmt.where(Item.is_hidden.is_(hidden))
    items = list(db.scalars(stmt.order_by(Item.created_at.desc()).limit(min(limit, 1000))).unique().all())
    if q.strip():
        scores = search_scores(q, items)
        items = sorted([i for i in items if scores.get(i.id, 0) >= 0.3], key=lambda i: -scores[i.id])
    return {"items": [item_view(i, actor) for i in items]}


class AdminPatch(BaseModel):
    status: Literal[STATUSES] | None = None  # type: ignore[valid-type]
    is_hidden: bool | None = None
    holding: str | None = Field(default=None, max_length=20)
    holding_note: str | None = Field(default=None, max_length=200)


def _holding(value: str) -> str:
    value = get_dropoffs().canon(value)
    if not get_dropoffs().valid(value):
        raise HTTPException(422, "unknown_holding")
    return value


@router.patch("/items/{item_id}")
def admin_patch(item_id: uuid.UUID, body: AdminPatch, actor: Actor = Depends(require_admin),
                db: Session = Depends(get_db)) -> dict:
    item = db.get(Item, item_id)
    if item is None:
        raise HTTPException(404, "not_found")
    changes = body.model_dump(exclude_unset=True)
    if changes.get("holding"):
        changes["holding"] = _holding(changes["holding"])
    for key, value in changes.items():
        setattr(item, key, value)
    if body.status == "returned" and not item.returned_at:
        item.returned_at = utcnow()
    if body.status in ("closed", "expired"):
        item.closed_at = utcnow()
    db.flush()
    refresh_matches(db, item)
    audit.log(db, actor.id, "admin.item.patch", "item", item.id, **{k: str(v) for k, v in changes.items()})
    db.commit()
    return {"item": item_view(item, actor)}


@router.post("/items/{item_id}/returned")
def mark_returned(item_id: uuid.UUID, actor: Actor = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    item = db.get(Item, item_id)
    if item is None:
        raise HTTPException(404, "not_found")
    now = utcnow()
    item.status, item.returned_at = "returned", now
    claim = db.scalars(select(Claim).where(Claim.found_id == item.id, Claim.status == "approved")).first()
    if claim:
        claim.status = "completed"
        if claim.lost_id:
            lost = db.get(Item, claim.lost_id)
            if lost:
                lost.status, lost.returned_at = "returned", now
    db.flush()
    refresh_matches(db, item)
    audit.log(db, actor.id, "admin.item.returned", "item", item.id, claim=str(claim.id) if claim else None)
    db.commit()
    return {"item": item_view(item, actor)}


# --------------------------------------------------------------------------- daily check
@router.get("/inventory")
def inventory(dropoff: str = "", actor: Actor = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    """Found items still waiting at a desk or shelf, least recently checked first: the desk's daily round."""
    d = get_dropoffs()
    points = [dropoff] if dropoff else list(d.points)
    held = [h for p in points for h in d.stored_as(p)]
    items = db.scalars(select(Item).where(Item.kind == "found", Item.status.in_(ACTIVE), Item.is_hidden.is_(False),
                                          Item.holding.in_(held))).unique().all()
    items = sorted(items, key=lambda i: ((i.attrs or {}).get("checked_at") or i.created_at.isoformat()))
    return {"items": [item_view(i, actor) for i in items]}


class Check(BaseModel):
    action: Literal["present", "gone", "move"]
    to: str | None = Field(default=None, max_length=20)


@router.post("/items/{item_id}/check")
def check_item(item_id: uuid.UUID, body: Check, actor: Actor = Depends(require_admin),
               db: Session = Depends(get_db)) -> dict:
    """present: still there (stamps the time students see). gone: no longer there, taken without the app.
    move: carried to another desk or shelf."""
    item = db.get(Item, item_id)
    if item is None or item.kind != "found":
        raise HTTPException(404, "not_found")
    now = utcnow()
    attrs = {**(item.attrs or {}), "checked_at": now.isoformat(), "checked_by": actor.display_name}
    if body.action == "gone":
        item.status, item.returned_at = "returned", item.returned_at or now
        attrs["collected_via"] = "desk_check"
    elif body.action == "move":
        if not body.to or not get_dropoffs().is_point(_holding(body.to)):
            raise HTTPException(422, "unknown_holding")
        item.holding = _holding(body.to)
    item.attrs = attrs
    db.flush()
    if body.action == "gone":
        refresh_matches(db, item)
    audit.log(db, actor.id, f"admin.check.{body.action}", "item", item.id, to=body.to)
    db.commit()
    return {"item": item_view(item, actor)}


@router.get("/claims")
def admin_claims(status: str = "pending", desk: str = "", actor: Actor = Depends(require_admin),
                 db: Session = Depends(get_db)) -> dict:
    stmt = select(Claim, Item).join(Item, Item.id == Claim.found_id)
    if status != "all":
        stmt = stmt.where(Claim.status.in_(status.split(",")))
    if desk:
        stmt = stmt.where(Item.holding.in_(get_dropoffs().stored_as(desk)))
    rows = db.execute(stmt.order_by(Claim.created_at.desc()).limit(300)).unique().all()
    out = []
    for claim, found in rows:
        view = claim_view(claim, found, actor)
        if claim.lost_id:
            lost = db.get(Item, claim.lost_id)
            view["lost"] = item_view(lost, actor) if lost else None
        match = db.scalars(select(Match).where(Match.found_id == found.id, Match.lost_id == claim.lost_id)).first() \
            if claim.lost_id else None
        view["match"] = {"probability": match.probability, "band": match.band, "reasons": match.reasons} if match else None
        out.append(view)
    return {"claims": out}


class Decision(BaseModel):
    decision: Literal["approve", "reject"]
    note: str = Field(default="", max_length=500)


@router.post("/claims/{claim_id}/decide")
def decide_claim(claim_id: uuid.UUID, body: Decision, actor: Actor = Depends(require_admin),
                 db: Session = Depends(get_db)) -> dict:
    claim = db.get(Claim, claim_id)
    if claim is None:
        raise HTTPException(404, "not_found")
    if claim.status != "pending":
        raise HTTPException(409, "claim_not_pending")
    item = db.get(Item, claim.found_id)
    now = utcnow()
    claim.decided_at, claim.reviewer_id, claim.review_note = now, actor.id, body.note.strip()
    if body.decision == "approve":
        claim.status = "approved"
        item.status = "claimed"
        if claim.lost_id:
            lost = db.get(Item, claim.lost_id)
            if lost and lost.status in MATCHABLE:
                lost.status = "claimed"
        for other in db.scalars(select(Claim).where(Claim.found_id == item.id, Claim.status == "pending",
                                                    Claim.id != claim.id)):
            other.status, other.decided_at, other.reviewer_id = "rejected", now, actor.id
            other.review_note = "Another claim for this item was approved."
    else:
        claim.status = "rejected"
        pending = db.scalars(select(Claim).where(Claim.found_id == item.id, Claim.status == "pending",
                                                 Claim.id != claim.id)).first()
        if item.status == "matched" and not pending:
            item.status = "open"
    audit.log(db, actor.id, f"claim.{body.decision}", "claim", claim.id, found_id=str(item.id))
    db.commit()
    return {"claim": claim_view(claim, item, actor)}


@router.get("/stats")
def stats(db: Session = Depends(get_db)) -> dict:
    v = get_matcher().vocab
    items = db.scalars(select(Item).where(Item.is_hidden.is_(False))).unique().all()
    matches = db.scalars(select(Match)).all()
    claims = db.scalars(select(Claim)).unique().all()
    found = [i for i in items if i.kind == "found"]
    returned = [i for i in found if i.status == "returned" and i.returned_at]
    days = [(i.returned_at - i.created_at).total_seconds() / 86400 for i in returned]
    by_status = Counter(f"{i.kind}:{i.status}" for i in items)
    by_category = Counter(i.category or "other" for i in items).most_common(12)
    by_zone = Counter((v.zone_of(i.locations[0]) if i.locations else None) or "unknown" for i in found)
    by_lang = Counter((i.attrs or {}).get("language", "unknown") for i in items)
    d = get_dropoffs()
    by_dropoff = Counter(d.canon(i.holding) or "unknown" for i in found if i.status in ACTIVE)
    close_reasons = Counter((i.attrs or {}).get("close_reason") or "unknown"
                            for i in items if i.kind == "lost" and i.status == "closed")
    now = datetime.now(CST)
    week0 = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    weeks = []
    for w in range(11, -1, -1):
        start = week0 - timedelta(weeks=w)
        end = start + timedelta(weeks=1)
        in_week = [i for i in items if start <= i.created_at.astimezone(CST) < end]
        weeks.append({"week": start.date().isoformat(), "lost": sum(i.kind == "lost" for i in in_week),
                      "found": sum(i.kind == "found" for i in in_week),
                      "returned": sum(1 for i in returned if start <= i.returned_at.astimezone(CST) < end)})
    fb = [m for m in matches if m.feedback]
    strong_fb = [m for m in fb if m.band == "strong"]
    return {
        "totals": {"lost": sum(i.kind == "lost" for i in items), "found": len(found), "returned": len(returned),
                   "active": sum(i.status in ACTIVE for i in items),
                   "pending_claims": sum(c.status == "pending" for c in claims)},
        "return_rate": len(returned) / len(found) if found else None,
        "median_days_to_return": statistics.median(days) if days else None,
        "by_status": dict(by_status), "by_category": by_category, "by_zone": dict(by_zone),
        "by_language": dict(by_lang), "weekly": weeks,
        "by_dropoff": dict(by_dropoff), "close_reasons": dict(close_reasons),
        "feedback": {"confirmed": sum(m.feedback == "confirmed" for m in fb),
                     "rejected": sum(m.feedback == "rejected" for m in fb),
                     "strong_precision": (sum(m.feedback == "confirmed" for m in strong_fb) / len(strong_fb))
                     if strong_fb else None},
        "matcher": get_matcher().model_version,
    }


def _csv(rows: list[dict], name: str) -> Response:
    buf = io.StringIO()
    if rows:
        writer = csv.DictWriter(buf, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    return Response("﻿" + buf.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="{name}"'})


@router.get("/export/items.csv")
def export_items(db: Session = Depends(get_db)) -> Response:
    items = db.scalars(select(Item).order_by(Item.created_at)).unique().all()
    return _csv([{
        "id": str(i.id), "kind": i.kind, "status": i.status, "category": i.category, "colors": ";".join(i.colors or []),
        "brand": i.brand or "", "locations": ";".join(i.locations or []), "created_at": i.created_at.isoformat(),
        "time_from": i.time_from.isoformat(), "time_to": i.time_to.isoformat() if i.time_to else "",
        "returned_at": i.returned_at.isoformat() if i.returned_at else "", "language": (i.attrs or {}).get("language", ""),
        "title": i.title, "description": i.description, "marks_text": i.marks_text,
        "reporter_email": i.reporter.email if i.reporter else "", "hidden": i.is_hidden,
    } for i in items], "findmy-items.csv")


@router.get("/export/feedback.csv")
def export_feedback(db: Session = Depends(get_db)) -> Response:
    rows = db.scalars(select(Match).where(Match.feedback.is_not(None)).order_by(Match.feedback_at)).all()
    return _csv([{
        "match_id": str(m.id), "lost_id": str(m.lost_id), "found_id": str(m.found_id),
        "probability": round(m.probability, 4), "band": m.band, "feedback": m.feedback,
        "feedback_at": m.feedback_at.isoformat() if m.feedback_at else "", "model_version": m.model_version,
        "contributions": json.dumps(m.contributions),
    } for m in rows], "findmy-match-feedback.csv")


@router.post("/rematch")
def rematch(actor: Actor = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    n = rematch_all(db)
    audit.log(db, actor.id, "admin.rematch", "system", "-", items=n)
    db.commit()
    return {"ok": True, "items": n, "matcher": get_matcher().model_version}


@router.post("/purge-demo")
def purge_demo(actor: Actor = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    ids = [i.id for i in db.scalars(select(Item)).unique().all() if (i.attrs or {}).get("demo")]
    if ids:
        db.execute(delete(Claim).where(Claim.found_id.in_(ids)))
        db.execute(delete(Match).where(Match.lost_id.in_(ids) | Match.found_id.in_(ids)))
        db.execute(delete(Item).where(Item.id.in_(ids)))
    audit.log(db, actor.id, "admin.purge_demo", "system", "-", items=len(ids))
    db.commit()
    return {"ok": True, "deleted": len(ids)}

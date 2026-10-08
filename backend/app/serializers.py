"""JSON views of database rows. Visibility rules live here, in one place:

* public            — anyone (no reporter identity, no private verification detail)
* owner             — the reporter (+ private detail they wrote, match count)
* admin             — front desk / club officers (+ reporter name and email for handover)
"""

from __future__ import annotations

from .auth import Actor
from .models import Claim, Item, Match


def photo_urls(item: Item) -> list[dict]:
    return [{"url": f"/media/{p['key']}", "thumb_url": f"/media/{p['thumb']}", "w": p.get("w"), "h": p.get("h")}
            for p in item.photos or []]


def item_view(item: Item, viewer: Actor | None = None, match_count: int | None = None) -> dict:
    is_owner = viewer is not None and viewer.id == item.reporter_id
    is_admin = viewer is not None and viewer.is_admin
    out = {
        "id": str(item.id), "kind": item.kind, "status": item.status, "title": item.title,
        "description": item.description, "marks_text": item.marks_text, "category": item.category,
        "colors": list(item.colors or []), "brand": item.brand, "locations": list(item.locations or []),
        "location_note": item.location_note, "time_from": item.time_from.isoformat(),
        "time_to": item.time_to.isoformat() if item.time_to else None,
        "holding": item.holding, "holding_note": item.holding_note if (is_owner or is_admin) else "",
        "photos": photo_urls(item), "created_at": item.created_at.isoformat(),
        "returned_at": item.returned_at.isoformat() if item.returned_at else None,
        "language": (item.attrs or {}).get("language"),
        "is_mine": is_owner,
    }
    if item.kind == "found" and item.holding == "front_desk":
        out["holding_note"] = item.holding_note  # where to pick it up is public information
    if is_owner or is_admin:
        out["private_detail"] = item.private_detail
        out["is_hidden"] = item.is_hidden
        if match_count is not None:
            out["match_count"] = match_count
    if is_admin:
        out["reporter"] = {"display_name": item.reporter.display_name, "email": item.reporter.email} if item.reporter else None
        out["attrs"] = item.attrs
    return out


def match_view(match: Match, other: Item, viewer: Actor | None) -> dict:
    return {
        "id": str(match.id), "probability": round(match.probability, 4), "band": match.band,
        "reasons": match.reasons, "feedback": match.feedback, "model_version": match.model_version,
        "contributions": match.contributions if viewer and viewer.is_admin else None,
        "item": item_view(other, viewer),
    }


def claim_view(claim: Claim, found: Item | None, viewer: Actor | None) -> dict:
    out = {
        "id": str(claim.id), "status": claim.status, "proof": claim.proof, "review_note": claim.review_note,
        "created_at": claim.created_at.isoformat(),
        "decided_at": claim.decided_at.isoformat() if claim.decided_at else None,
        "lost_id": str(claim.lost_id) if claim.lost_id else None,
        "found": item_view(found, viewer) if found else None,
    }
    if viewer and viewer.is_admin and claim.claimant:
        out["claimant"] = {"display_name": claim.claimant.display_name, "email": claim.claimant.email}
    return out

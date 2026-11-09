"""Daily housekeeping, called by Vercel Cron (Authorization: Bearer $CRON_SECRET)."""

from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..dropoffs import get_dropoffs
from ..models import Item, utcnow
from ..services.matching import MATCHABLE, refresh_matches

router = APIRouter(prefix="/cron", tags=["cron"])


@router.get("/expire")
def expire(authorization: str = Header(default=""), db: Session = Depends(get_db)) -> dict:
    s = get_settings()
    if not s.cron_secret or authorization != f"Bearer {s.cron_secret}":
        raise HTTPException(401, "unauthorized")
    now = utcnow()
    active = select(Item).where(Item.status.in_(MATCHABLE))
    stale = {i.id: i for i in db.scalars(
        active.where(Item.created_at < now - timedelta(days=s.item_ttl_days))).unique()}
    # Open shelves are cleared out regularly, so their items leave the list sooner.
    for point in get_dropoffs().points.values():
        if point.ttl_days:
            stale |= {i.id: i for i in db.scalars(active.where(
                Item.kind == "found", Item.holding == point.id,
                Item.created_at < now - timedelta(days=point.ttl_days))).unique()}
    for item in stale.values():
        item.status, item.closed_at = "expired", now
        refresh_matches(db, item)
    db.commit()
    return {"ok": True, "expired": len(stale)}

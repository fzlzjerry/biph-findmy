"""Daily housekeeping, called by Vercel Cron (Authorization: Bearer $CRON_SECRET)."""

from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import Item, utcnow
from ..services.matching import MATCHABLE, refresh_matches

router = APIRouter(prefix="/cron", tags=["cron"])


@router.get("/expire")
def expire(authorization: str = Header(default=""), db: Session = Depends(get_db)) -> dict:
    s = get_settings()
    if not s.cron_secret or authorization != f"Bearer {s.cron_secret}":
        raise HTTPException(401, "unauthorized")
    cutoff = utcnow() - timedelta(days=s.item_ttl_days)
    stale = db.scalars(select(Item).where(Item.status.in_(MATCHABLE), Item.created_at < cutoff)).unique().all()
    for item in stale:
        item.status, item.closed_at = "expired", utcnow()
        refresh_matches(db, item)
    db.commit()
    return {"ok": True, "expired": len(stale)}

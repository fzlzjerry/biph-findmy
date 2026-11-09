"""Super admins manage front desk staff accounts: who is staff, and which desk they work at."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import Actor, require_superadmin, staff_table_ready
from ..config import get_settings
from ..db import get_db
from ..dropoffs import get_dropoffs
from ..models import Profile, StaffAccount
from ..services import audit
from .auth import EMAIL_RE

router = APIRouter(prefix="/admin/staff", tags=["staff"], dependencies=[Depends(require_superadmin)])
StaffRole = Literal["admin", "superadmin"]


class NewStaff(BaseModel):
    email: str = Field(pattern=EMAIL_RE, max_length=320)
    role: StaffRole = "admin"
    desk: str | None = Field(default=None, max_length=20)


class StaffPatch(BaseModel):
    role: StaffRole | None = None
    desk: str | None = Field(default=None, max_length=20)


def _ready(db: Session) -> None:
    if not staff_table_ready(db):
        raise HTTPException(503, "staff_table_missing")


def _desk(value: str | None) -> str | None:
    if value and not get_dropoffs().is_point(value):
        raise HTTPException(422, "unknown_holding")
    return value or None


def _from_env(email: str) -> bool:
    return email in get_settings().superadmins


def _view(email: str, role: str, desk: str | None, profile: Profile | None, managed: str) -> dict:
    return {"email": email, "role": role, "desk": desk, "managed": managed,  # env: set on the server, app: here
            "display_name": profile.display_name if profile else None,
            "last_seen_at": profile.last_seen_at.isoformat() if profile else None}


@router.get("")
def list_staff(db: Session = Depends(get_db)) -> dict:
    rows = {r.email: r for r in db.scalars(select(StaffAccount))} if staff_table_ready(db) else {}
    emails = sorted(get_settings().superadmins) + sorted(e for e in rows if not _from_env(e))
    profiles = {p.email: p for p in db.scalars(select(Profile).where(Profile.email.in_(emails)))}
    out = []
    for email in emails:
        row = rows.get(email)
        if _from_env(email):
            out.append(_view(email, "superadmin", row.desk if row else None, profiles.get(email), "env"))
        else:
            out.append(_view(email, row.role, row.desk, profiles.get(email), "app"))
    return {"staff": out, "ready": staff_table_ready(db)}


@router.post("", status_code=201)
def add_staff(body: NewStaff, actor: Actor = Depends(require_superadmin), db: Session = Depends(get_db)) -> dict:
    _ready(db)
    email = body.email.strip().lower()
    s = get_settings()
    if _from_env(email) or db.get(StaffAccount, email):
        raise HTTPException(409, "staff_exists")
    if s.domains and email.rsplit("@", 1)[-1] not in s.domains:
        raise HTTPException(422, "staff_email_domain")  # Supabase only lets school addresses sign up
    row = StaffAccount(email=email, role=body.role, desk=_desk(body.desk), added_by=actor.id)
    db.add(row)
    audit.log(db, actor.id, "staff.add", "staff", email[:40], email=email, role=body.role, desk=row.desk)
    db.commit()
    return {"staff": _view(email, row.role, row.desk, db.scalars(select(Profile).where(Profile.email == email)).first(),
                           "app")}


@router.patch("/{email}")
def update_staff(email: str, body: StaffPatch, actor: Actor = Depends(require_superadmin),
                 db: Session = Depends(get_db)) -> dict:
    _ready(db)
    email = email.strip().lower()
    changes = body.model_dump(exclude_unset=True)
    row = db.get(StaffAccount, email)
    env = _from_env(email)
    if env:
        if "role" in changes:
            raise HTTPException(422, "staff_env_managed")
        if row is None:  # a desk for a server-configured super admin
            row = StaffAccount(email=email, role="superadmin", added_by=actor.id)
            db.add(row)
    elif row is None:
        raise HTTPException(404, "not_found")
    if email == actor.email and changes.get("role") == "admin":
        raise HTTPException(422, "staff_cannot_demote_self")
    if "role" in changes and changes["role"]:
        row.role = changes["role"]
    if "desk" in changes:
        row.desk = _desk(changes["desk"])
    audit.log(db, actor.id, "staff.update", "staff", email[:40], email=email,
              **{k: str(v) for k, v in changes.items()})
    db.commit()
    profile = db.scalars(select(Profile).where(Profile.email == email)).first()
    return {"staff": _view(email, "superadmin" if env else row.role, row.desk, profile, "env" if env else "app")}


@router.delete("/{email}")
def remove_staff(email: str, actor: Actor = Depends(require_superadmin), db: Session = Depends(get_db)) -> dict:
    _ready(db)
    email = email.strip().lower()
    if _from_env(email):
        raise HTTPException(422, "staff_env_managed")
    if email == actor.email:
        raise HTTPException(422, "staff_cannot_remove_self")
    row = db.get(StaffAccount, email)
    if row is None:
        raise HTTPException(404, "not_found")
    db.delete(row)
    profile = db.scalars(select(Profile).where(Profile.email == email)).first()
    if profile is not None:
        profile.role = "user"
    audit.log(db, actor.id, "staff.remove", "staff", email[:40], email=email)
    db.commit()
    return {"ok": True}

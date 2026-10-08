from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import (ACCESS_COOKIE, Actor, LocalAuth, clear_session_cookies, get_actor, get_actor_optional,
                    get_auth_backend, set_session_cookies, upsert_profile)
from ..config import get_settings
from ..db import get_db
from ..models import Profile
from ..services.supabase_auth import AuthError

router = APIRouter(tags=["auth"])
EMAIL_RE = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class CodeRequest(BaseModel):
    email: str = Field(pattern=EMAIL_RE, max_length=320)


class VerifyRequest(BaseModel):
    email: str = Field(pattern=EMAIL_RE, max_length=320)
    code: str = Field(min_length=6, max_length=10)
    display_name: str | None = Field(default=None, max_length=60)


class ProfileUpdate(BaseModel):
    display_name: str = Field(min_length=1, max_length=60)


def user_view(actor: Actor) -> dict:
    return {"id": str(actor.id), "email": actor.email, "display_name": actor.display_name, "role": actor.role}


@router.post("/auth/request-code")
def request_code(body: CodeRequest) -> dict:
    email = body.email.strip().lower()
    s = get_settings()
    if not s.email_allowed(email):
        raise HTTPException(403, "email_domain_not_allowed")
    backend = get_auth_backend()
    try:
        result = backend.send_otp(email)
    except AuthError as exc:
        raise HTTPException(exc.status, exc.code) from exc
    out = {"ok": True}
    if isinstance(backend, LocalAuth) and s.dev_show_code and not s.is_production:
        out["dev_code"] = result
    return out


@router.post("/auth/verify")
def verify(body: VerifyRequest, response: Response, db: Session = Depends(get_db)) -> dict:
    email = body.email.strip().lower()
    if not get_settings().email_allowed(email):
        raise HTTPException(403, "email_domain_not_allowed")
    try:
        session = get_auth_backend().verify(email, body.code.strip())
    except AuthError as exc:
        raise HTTPException(exc.status, exc.code) from exc
    profile = upsert_profile(db, session.user_id, session.email or email, body.display_name)
    db.commit()
    set_session_cookies(response, session)
    return {"user": {"id": str(profile.id), "email": profile.email, "display_name": profile.display_name,
                     "role": "admin" if profile.email in get_settings().admins else profile.role}}


@router.post("/auth/logout")
def logout(request: Request, response: Response) -> dict:
    token = request.cookies.get(ACCESS_COOKIE)
    if token:
        get_auth_backend().logout(token)
    clear_session_cookies(response)
    return {"ok": True}


@router.get("/me")
def me(actor: Actor | None = Depends(get_actor_optional)) -> dict:
    return {"user": user_view(actor) if actor else None}


@router.patch("/me")
def update_me(body: ProfileUpdate, actor: Actor = Depends(get_actor), db: Session = Depends(get_db)) -> dict:
    profile = db.get(Profile, actor.id)
    profile.display_name = body.display_name.strip()
    db.commit()
    actor.display_name = profile.display_name
    return {"user": user_view(actor)}

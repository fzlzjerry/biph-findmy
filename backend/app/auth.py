"""Authentication: school-email OTP (Supabase in production, console codes locally).

Every permission check goes through `get_actor` / `get_actor_optional` / `require_admin`.
"""

from __future__ import annotations

import secrets
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from .config import Settings, get_settings
from .db import get_db
from .models import Profile, utcnow
from .services.supabase_auth import AuthError, AuthSession, SupabaseAuth

ACCESS_COOKIE = "fm_at"
REFRESH_COOKIE = "fm_rt"
CSRF_HEADER = "x-requested-with"
CSRF_VALUE = "findmy"
LOCAL_NAMESPACE = uuid.UUID("6f1d1a3e-8c9b-4b7e-9a51-6a2c0e8f4b10")


@dataclass
class Actor:
    id: uuid.UUID
    email: str
    role: str
    display_name: str

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"


# --------------------------------------------------------------------------- backends
class LocalAuth:
    """Development / tests: codes are printed (and optionally returned) instead of emailed."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.codes: dict[str, tuple[str, float, int]] = {}

    def send_otp(self, email: str) -> str:
        code = f"{secrets.randbelow(10**6):06d}"
        self.codes[email] = (code, time.time() + 600, 0)
        print(f"[local-auth] login code for {email}: {code}", flush=True)
        return code

    def verify(self, email: str, code: str) -> AuthSession:
        entry = self.codes.get(email)
        if not entry or entry[1] < time.time():
            raise AuthError("invalid_code")
        expected, expires, attempts = entry
        if attempts >= 5:
            raise AuthError("too_many_attempts", 429)
        if not secrets.compare_digest(expected, code.strip()):
            self.codes[email] = (expected, expires, attempts + 1)
            raise AuthError("invalid_code")
        del self.codes[email]
        user_id = str(uuid.uuid5(LOCAL_NAMESPACE, email))
        token = jwt.encode({"sub": user_id, "email": email, "aud": "authenticated",
                            "exp": int(time.time()) + 7 * 86400}, self.settings.session_secret, algorithm="HS256")
        return AuthSession(token, "", 7 * 86400, user_id, email)

    def refresh(self, refresh_token: str) -> AuthSession:
        raise AuthError("expired", 401)

    def logout(self, access_token: str) -> None:
        pass

    def decode(self, token: str) -> dict:
        try:
            return jwt.decode(token, self.settings.session_secret, algorithms=["HS256"], audience="authenticated")
        except jwt.ExpiredSignatureError as exc:
            raise AuthError("expired", 401) from exc
        except jwt.PyJWTError as exc:
            raise AuthError("invalid_token", 401) from exc


@lru_cache
def get_auth_backend() -> LocalAuth | SupabaseAuth:
    s = get_settings()
    if s.auth_backend == "supabase":
        if not (s.supabase_url and s.supabase_publishable_key):
            raise RuntimeError("AUTH_BACKEND=supabase needs SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY")
        return SupabaseAuth(s.supabase_url, s.supabase_publishable_key)
    return LocalAuth(s)


# --------------------------------------------------------------------------- cookies
def set_session_cookies(response: Response, session: AuthSession) -> None:
    s = get_settings()
    response.set_cookie(ACCESS_COOKIE, session.access_token, max_age=max(session.expires_in, 300), httponly=True,
                        secure=s.secure_cookies, samesite="lax", path="/")
    if session.refresh_token:
        response.set_cookie(REFRESH_COOKIE, session.refresh_token, max_age=30 * 86400, httponly=True,
                            secure=s.secure_cookies, samesite="lax", path="/")


def clear_session_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path="/")


def role_for(email: str, stored_role: str | None) -> str:
    """ADMIN_EMAILS decides who is staff, so removing an address takes effect on the next request.
    With no list configured (local dev), the stored role from the seed data is kept."""
    admins = get_settings().admins
    if email in admins:
        return "admin"
    return "user" if admins else (stored_role or "user")


def upsert_profile(db: Session, user_id: str, email: str, display_name: str | None = None) -> Profile:
    profile = db.get(Profile, uuid.UUID(user_id))
    if profile is None:
        profile = db.query(Profile).filter(Profile.email == email).one_or_none()
        if profile is not None and profile.id != uuid.UUID(user_id):
            profile.id = uuid.UUID(user_id)  # pragma: no cover - re-created auth user
    if profile is None:
        profile = Profile(id=uuid.UUID(user_id), email=email,
                          display_name=(display_name or email.split("@")[0])[:60])
        db.add(profile)
    if display_name:
        profile.display_name = display_name[:60]
    profile.role = role_for(email, profile.role)
    profile.last_seen_at = utcnow()
    db.flush()
    return profile


# --------------------------------------------------------------------------- dependencies
def get_actor_optional(request: Request, response: Response, db: Session = Depends(get_db)) -> Actor | None:
    token = request.cookies.get(ACCESS_COOKIE)
    refresh = request.cookies.get(REFRESH_COOKIE)
    if not token and not refresh:
        return None
    backend = get_auth_backend()
    claims = None
    if token:
        try:
            claims = backend.decode(token)
        except AuthError as exc:
            if exc.code != "expired" or not refresh:
                clear_session_cookies(response)
                return None
    if claims is None and refresh:
        try:
            session = backend.refresh(refresh)
        except AuthError:
            clear_session_cookies(response)
            return None
        set_session_cookies(response, session)
        claims = {"sub": session.user_id, "email": session.email}
    email = (claims.get("email") or "").lower()
    s = get_settings()
    if not email or not s.email_allowed(email):
        return None
    profile = db.get(Profile, uuid.UUID(claims["sub"]))
    if profile is None:
        profile = upsert_profile(db, claims["sub"], email)
        db.commit()
    return Actor(profile.id, email, role_for(email, profile.role), profile.display_name)


def get_actor(actor: Actor | None = Depends(get_actor_optional)) -> Actor:
    if actor is None:
        raise HTTPException(401, "login_required")
    return actor


def require_admin(actor: Actor = Depends(get_actor)) -> Actor:
    if not actor.is_admin:
        raise HTTPException(403, "admin_only")
    return actor


def csrf_guard(request: Request) -> None:
    """State-changing API calls must come from our own frontend (custom header + SameSite cookies)."""
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    if request.url.path.startswith("/api/cron/"):
        return
    if request.headers.get(CSRF_HEADER) != CSRF_VALUE:
        raise HTTPException(403, "csrf_header_missing")

"""Thin client for Supabase Auth (GoTrue) email OTP, called from our backend.

The browser never talks to supabase.co: the backend requests and verifies the 6-digit code and
keeps the session in httpOnly cookies.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

import httpx
import jwt


class AuthError(Exception):
    def __init__(self, code: str, status: int = 400):
        super().__init__(code)
        self.code = code
        self.status = status


@dataclass
class AuthSession:
    access_token: str
    refresh_token: str
    expires_in: int
    user_id: str
    email: str


class SupabaseAuth:
    def __init__(self, url: str, publishable_key: str):
        self.url = url.rstrip("/")
        self.key = publishable_key
        self._jwks: jwt.PyJWKClient | None = None
        self._user_cache: dict[str, tuple[float, dict]] = {}

    def _headers(self, token: str | None = None) -> dict[str, str]:
        h = {"apikey": self.key, "Content-Type": "application/json"}
        if token:
            h["Authorization"] = f"Bearer {token}"
        return h

    def _post(self, path: str, payload: dict, token: str | None = None) -> dict:
        try:
            resp = httpx.post(f"{self.url}/auth/v1{path}", json=payload, headers=self._headers(token), timeout=15)
        except httpx.HTTPError as exc:
            raise AuthError("auth_unreachable", 503) from exc
        if resp.status_code >= 400:
            body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
            code = body.get("error_code") or body.get("code") or "auth_failed"
            # The hourly email quota is shared by the whole school, so it gets its own message.
            if code == "over_email_send_rate_limit":
                raise AuthError("email_rate_limited", 429)
            if resp.status_code == 429:
                raise AuthError("rate_limited", 429)
            if code in ("otp_expired", "invalid_credentials") or "expired" in str(body).lower():
                raise AuthError("invalid_code", 400)
            if code == "email_address_not_authorized":
                raise AuthError("email_not_deliverable", 400)
            raise AuthError(str(code), 400 if resp.status_code < 500 else 502)
        return resp.json() if resp.content else {}

    def send_otp(self, email: str) -> None:
        self._post("/otp", {"email": email, "create_user": True})

    @staticmethod
    def _session(data: dict) -> AuthSession:
        user = data.get("user") or {}
        return AuthSession(data["access_token"], data["refresh_token"], int(data.get("expires_in", 3600)),
                           user.get("id", ""), (user.get("email") or "").lower())

    def verify(self, email: str, code: str) -> AuthSession:
        return self._session(self._post("/verify", {"type": "email", "email": email, "token": code}))

    def refresh(self, refresh_token: str) -> AuthSession:
        return self._session(self._post("/token?grant_type=refresh_token", {"refresh_token": refresh_token}))

    def logout(self, access_token: str) -> None:
        try:
            self._post("/logout", {}, token=access_token)
        except AuthError:
            pass

    def decode(self, token: str) -> dict:
        """Verify an access token. Asymmetric keys via JWKS; legacy projects fall back to /user."""
        try:
            header = jwt.get_unverified_header(token)
        except jwt.PyJWTError as exc:
            raise AuthError("invalid_token", 401) from exc
        if header.get("alg", "").startswith(("ES", "RS")):
            if self._jwks is None:
                self._jwks = jwt.PyJWKClient(f"{self.url}/auth/v1/.well-known/jwks.json", cache_keys=True,
                                             lifespan=600)
            try:
                key = self._jwks.get_signing_key_from_jwt(token)
                return jwt.decode(token, key.key, algorithms=[header["alg"]], audience="authenticated")
            except jwt.ExpiredSignatureError as exc:
                raise AuthError("expired", 401) from exc
            except jwt.PyJWTError as exc:
                raise AuthError("invalid_token", 401) from exc
        # HS256 (legacy JWT secret we don't hold): ask Supabase, cache briefly.
        cached = self._user_cache.get(token)
        if cached and cached[0] > time.time():
            return cached[1]
        try:
            claims = jwt.decode(token, options={"verify_signature": False})
        except jwt.PyJWTError as exc:
            raise AuthError("invalid_token", 401) from exc
        if claims.get("exp", 0) < time.time():
            raise AuthError("expired", 401)
        resp = httpx.get(f"{self.url}/auth/v1/user", headers=self._headers(token), timeout=10)
        if resp.status_code != 200:
            raise AuthError("invalid_token", 401)
        user = resp.json()
        claims = {"sub": user["id"], "email": user.get("email", ""), "exp": claims["exp"]}
        self._user_cache[token] = (time.time() + 60, claims)
        return claims

"""Settings from environment variables (see .env.example)."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: Literal["development", "test", "production"] = "development"
    database_url: str = "sqlite:///./data/findmy.sqlite3"

    # Auth: "local" prints codes to the console (dev/tests); "supabase" uses Supabase Auth email OTP.
    auth_backend: Literal["local", "supabase"] = "local"
    supabase_url: str = ""
    supabase_publishable_key: str = ""
    allowed_email_domains: str = ""   # e.g. "basischina.com,students.basischina.com"
    allowed_emails: str = ""          # explicit allow-list while the school domain is unknown
    admin_emails: str = ""            # front-desk staff and club officers
    superadmin_emails: str = ""       # may add / remove staff in the app; empty → everyone in ADMIN_EMAILS
    session_secret: str = "dev-only-session-secret-change-me"
    dev_show_code: bool = False       # local auth only: return the code in the API response

    storage_backend: Literal["local", "blob"] = "local"
    local_storage_dir: str = "./data/uploads"
    blob_read_write_token: str = Field(default="", validation_alias="BLOB_READ_WRITE_TOKEN")

    cron_secret: str = ""
    item_ttl_days: int = 60
    cookie_secure: bool | None = None

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def secure_cookies(self) -> bool:
        return self.is_production if self.cookie_secure is None else self.cookie_secure

    @staticmethod
    def _split(value: str) -> set[str]:
        return {v.strip().lower() for v in value.split(",") if v.strip()}

    @property
    def domains(self) -> set[str]:
        return {d.lstrip("@") for d in self._split(self.allowed_email_domains)}

    @property
    def admins(self) -> set[str]:
        return self._split(self.admin_emails)

    @property
    def superadmins(self) -> set[str]:
        return self._split(self.superadmin_emails) or self.admins

    def email_allowed(self, email: str) -> bool:
        """Who may sign in. Closed by default in production until a domain or allow-list is set."""
        email = email.strip().lower()
        if email in self.admins or email in self.superadmins or email in self._split(self.allowed_emails):
            return True
        if self.domains:
            return email.rsplit("@", 1)[-1] in self.domains
        return not self.is_production and not self.allowed_emails


@lru_cache
def get_settings() -> Settings:
    return Settings()

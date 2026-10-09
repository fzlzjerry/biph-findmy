"""Apply the BIPH FindMy Supabase Auth settings through the Management API.

    supabase login                                   # once; stores ~/.supabase/access-token
    uv run python scripts/configure_supabase_auth.py # idempotent, safe to re-run

Always applied: site URL, 6-digit codes valid for 10 minutes, the school-domain signup hook
(supabase/migrations/0002_signup_domain_hook.sql must be applied first) and rate limits sized for
a backend that sends every user's request from the same few IPs.

Supabase's free plan only allows custom email templates (and a higher email rate limit) once a
custom SMTP server is configured, so those are applied only when SMTP is set up
(see docs/supabase-auth-setup.md).
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
PROJECT_REF = os.environ.get("SUPABASE_PROJECT_REF", "vysbjwnojtbykmgmtrdo")
SITE_URL = os.environ.get("SITE_URL", "https://biph-findmy.vercel.app")
SUBJECT = "BIPH FindMy 登录验证码 · Your login code"
TEMPLATE = ROOT / "supabase" / "templates" / "otp-email.html"
SHOW = ["site_url", "mailer_otp_exp", "mailer_otp_length", "hook_before_user_created_enabled",
        "hook_before_user_created_uri", "rate_limit_otp", "rate_limit_verify", "rate_limit_email_sent",
        "smtp_host", "smtp_sender_name", "mailer_subjects_magic_link", "mailer_subjects_confirmation"]


def token() -> str:
    value = os.environ.get("SUPABASE_ACCESS_TOKEN")
    path = Path.home() / ".supabase" / "access-token"
    if not value and path.exists():
        value = path.read_text().strip()
    if not value:
        sys.exit("No Supabase access token: run `supabase login` or set SUPABASE_ACCESS_TOKEN.")
    return value


def main() -> int:
    url = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/config/auth"
    headers = {"Authorization": f"Bearer {token()}"}
    current = httpx.get(url, headers=headers, timeout=30).raise_for_status().json()

    body: dict = {
        "site_url": SITE_URL,
        "mailer_otp_exp": 600,
        "mailer_otp_length": 6,
        "hook_before_user_created_enabled": True,
        "hook_before_user_created_uri": "pg-functions://postgres/public/hook_restrict_signup_domain",
        "rate_limit_otp": 300,     # sign-ins per 5 minutes per IP (all users share our backend's IPs)
        "rate_limit_verify": 300,  # code verifications per 5 minutes per IP
    }
    if current.get("smtp_host"):
        html = TEMPLATE.read_text(encoding="utf-8")
        body |= {
            "mailer_subjects_magic_link": SUBJECT,
            "mailer_templates_magic_link_content": html,
            "mailer_subjects_confirmation": SUBJECT,
            "mailer_templates_confirmation_content": html,
            "rate_limit_email_sent": 100,  # per hour; keep below the SMTP provider's own limit
        }
    else:
        print("custom SMTP not configured yet: skipping email templates and the email rate limit")

    resp = httpx.patch(url, headers=headers, json=body, timeout=30)
    if resp.status_code >= 400:
        sys.exit(f"PATCH failed: HTTP {resp.status_code} {resp.text}")
    applied = resp.json()
    print(json.dumps({k: applied.get(k) for k in SHOW}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

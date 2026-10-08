import io
import os
import tempfile
from pathlib import Path

import pytest

_TMP = Path(tempfile.mkdtemp(prefix="findmy-test-"))
os.environ.update({
    "APP_ENV": "test",
    "DATABASE_URL": f"sqlite:///{_TMP / 'test.sqlite3'}",
    "AUTH_BACKEND": "local",
    "DEV_SHOW_CODE": "true",
    "ADMIN_EMAILS": "desk@school.test",
    "ALLOWED_EMAIL_DOMAINS": "",
    "ALLOWED_EMAILS": "",
    "STORAGE_BACKEND": "local",
    "LOCAL_STORAGE_DIR": str(_TMP / "uploads"),
    "CRON_SECRET": "test-cron-secret",
    "MATCHER_TEXT_BACKEND": "tfidf",
})

from fastapi.testclient import TestClient  # noqa: E402

from backend.app.config import get_settings  # noqa: E402
from backend.app.main import create_app  # noqa: E402

HEADERS = {"X-Requested-With": "findmy"}


@pytest.fixture()
def app():
    from backend.app import auth
    from backend.app.db import get_engine
    from backend.app.models import Base

    get_settings.cache_clear()
    auth.get_auth_backend.cache_clear()
    engine = get_engine()
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    return create_app()


def make_client(app) -> TestClient:
    client = TestClient(app)
    client.headers.update(HEADERS)
    return client


@pytest.fixture()
def client(app):
    with make_client(app) as c:
        yield c


def login(client: TestClient, email: str, name: str | None = None) -> dict:
    r = client.post("/api/auth/request-code", json={"email": email})
    assert r.status_code == 200, r.text
    code = r.json()["dev_code"]
    r = client.post("/api/auth/verify", json={"email": email, "code": code, "display_name": name})
    assert r.status_code == 200, r.text
    return r.json()["user"]


@pytest.fixture()
def users(app):
    """Three logged-in clients: owner, finder, desk (admin)."""
    clients = {}
    for key, email in {"owner": "owner@school.test", "finder": "finder@school.test", "desk": "desk@school.test"}.items():
        c = make_client(app)
        c.__enter__()
        login(c, email, key.title())
        clients[key] = c
    yield clients
    for c in clients.values():
        c.__exit__(None, None, None)


def jpeg_with_gps() -> bytes:
    from PIL import Image

    img = Image.new("RGB", (2400, 1800), (20, 30, 40))
    exif = Image.Exif()
    exif[0x8825] = {1: "N", 2: (22.0, 30.0, 0.0), 3: "E", 4: (114.0, 30.0, 0.0)}  # GPS IFD
    exif[0x0112] = 6  # orientation: rotate 90°
    buf = io.BytesIO()
    img.save(buf, "JPEG", exif=exif)
    return buf.getvalue()

from datetime import datetime, timedelta, timezone

from PIL import Image

from .conftest import jpeg_with_gps, login, make_client

NOW = datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat()


def post_item(client, files=None, **fields):
    data = {"kind": "found", "category": "water_bottle", "time_from": iso(NOW - timedelta(hours=20)), **fields}
    for key in ("colors", "locations"):
        if isinstance(data.get(key), list):
            data[key] = ",".join(data[key])
    return client.post("/api/items", data=data, files=files or [])


def test_health_and_meta(client):
    assert client.get("/api/health").json()["ok"] is True
    meta = client.get("/api/meta").json()
    assert any(c["id"] == "bottles_food" for c in meta["categories"])
    assert any(z["id"] == "sports" for z in meta["zones"])
    assert meta["auth"]["dev_show_code"] is True


def test_login_logout_and_me(client):
    assert client.get("/api/me").json()["user"] is None
    user = login(client, "Someone@School.test", "Someone")
    assert user["email"] == "someone@school.test" and user["role"] == "user"
    assert client.get("/api/me").json()["user"]["display_name"] == "Someone"
    client.post("/api/auth/logout")
    assert client.get("/api/me").json()["user"] is None


def test_wrong_code_is_rejected(client):
    client.post("/api/auth/request-code", json={"email": "a@school.test"})
    r = client.post("/api/auth/verify", json={"email": "a@school.test", "code": "000000"})
    assert r.status_code == 400 and r.json()["detail"] == "invalid_code"


def test_email_domain_allow_list(app, monkeypatch):
    from backend.app.config import get_settings

    monkeypatch.setenv("ALLOWED_EMAIL_DOMAINS", "basischina.com")
    get_settings.cache_clear()
    try:
        with make_client(app) as c:
            assert c.post("/api/auth/request-code", json={"email": "kid@gmail.com"}).status_code == 403
            assert c.post("/api/auth/request-code", json={"email": "kid@basischina.com"}).status_code == 200
            assert c.post("/api/auth/request-code", json={"email": "desk@school.test"}).status_code == 200  # admin
    finally:
        monkeypatch.delenv("ALLOWED_EMAIL_DOMAINS")
        get_settings.cache_clear()


def test_production_is_closed_by_default(app, monkeypatch):
    from backend.app.config import get_settings

    monkeypatch.setenv("APP_ENV", "production")
    get_settings.cache_clear()
    try:
        assert not get_settings().email_allowed("random@gmail.com")
        assert get_settings().email_allowed("desk@school.test")
    finally:
        monkeypatch.setenv("APP_ENV", "test")
        get_settings.cache_clear()


def test_csrf_header_required(app):
    from fastapi.testclient import TestClient

    with TestClient(app) as raw:
        r = raw.post("/api/auth/request-code", json={"email": "x@school.test"})
        assert r.status_code == 403 and r.json()["detail"] == "csrf_header_missing"


def test_posting_requires_login(client):
    assert post_item(client, description="black bottle").status_code == 401


def test_found_then_lost_produces_ranked_matches(users):
    finder, owner = users["finder"], users["owner"]
    sticker = post_item(finder, description="black thermos bottle with a dinosaur sticker, gym", colors=["black"],
                        locations=["gym"], private_detail="K.L. under the lid").json()["item"]
    post_item(finder, description="黑色水杯", colors=["black"], locations=["library"])
    r = post_item(owner, kind="lost", description="黑色保温杯 贴了恐龙贴纸，在体育馆丢的", colors=["black"],
                  locations=["gym"], time_from=iso(NOW - timedelta(days=2)), time_to=iso(NOW - timedelta(days=2, hours=-2)))
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["item"]["is_mine"] is True
    assert body["matches"][0]["item"]["id"] == sticker["id"]
    assert body["matches"][0]["band"] in ("strong", "possible")
    codes = {reason["code"] for reason in body["matches"][0]["reasons"]}
    assert "marks_shared" in codes
    # the private verification detail never leaks to the person who lost something
    assert "private_detail" not in body["matches"][0]["item"]
    assert "K.L." not in str(body)


def test_private_detail_visibility(users, client):
    found = post_item(users["finder"], description="grey umbrella", private_detail="initials Z.Y.").json()["item"]
    assert client.get(f"/api/items/{found['id']}").json()["item"].get("private_detail") is None
    assert users["owner"].get(f"/api/items/{found['id']}").json()["item"].get("private_detail") is None
    assert users["finder"].get(f"/api/items/{found['id']}").json()["item"]["private_detail"] == "initials Z.Y."
    admin_view = users["desk"].get(f"/api/items/{found['id']}").json()["item"]
    assert admin_view["private_detail"] == "initials Z.Y." and admin_view["reporter"]["email"] == "finder@school.test"


def test_photo_is_resized_rotated_and_stripped(users, tmp_path):
    r = post_item(users["finder"], description="black bottle", files=[("photos", ("p.jpg", jpeg_with_gps(), "image/jpeg"))])
    assert r.status_code == 201, r.text
    photo = r.json()["item"]["photos"][0]
    img_bytes = users["finder"].get(photo["url"]).content
    from io import BytesIO

    img = Image.open(BytesIO(img_bytes))
    assert max(img.size) == 1600
    assert img.size[1] > img.size[0]  # EXIF orientation applied (portrait)
    assert not img.getexif()           # GPS and everything else stripped
    thumb = Image.open(BytesIO(users["finder"].get(photo["thumb_url"]).content))
    assert max(thumb.size) == 480


def test_heic_upload_is_converted(users):
    import pillow_heif

    from io import BytesIO
    buf = BytesIO()
    try:
        pillow_heif.from_pillow(Image.new("RGB", (800, 600), (200, 0, 0))).save(buf, quality=80)
    except Exception:  # pragma: no cover - encoder not available on this platform
        import pytest

        pytest.skip("HEIF encoder unavailable")
    r = post_item(users["finder"], description="red phone", category="phone",
                  files=[("photos", ("IMG_0001.HEIC", buf.getvalue(), "application/octet-stream"))])
    assert r.status_code == 201, r.text
    data = users["finder"].get(r.json()["item"]["photos"][0]["url"]).content
    assert data[:3] == b"\xff\xd8\xff"  # JPEG


def test_sensitive_items_refuse_photos(users):
    r = post_item(users["desk"], description="student card", category="id_card",
                  files=[("photos", ("p.jpg", jpeg_with_gps(), "image/jpeg"))])
    assert r.status_code == 422 and r.json()["detail"] == "photos_not_allowed_for_sensitive_items"


def test_validation_errors(users):
    assert post_item(users["owner"], description="x bottle", category="spaceship").status_code == 422
    assert post_item(users["owner"], description="bottle", time_from=iso(NOW + timedelta(days=2))).status_code == 422
    assert post_item(users["owner"], description="bottle", locations=["mars"]).status_code == 422


def test_claim_approve_and_handover(users):
    finder, owner, desk = users["finder"], users["owner"], users["desk"]
    found = post_item(finder, description="navy nike hoodie size M", category="jacket", colors=["navy"],
                      locations=["locker_rooms"]).json()["item"]
    lost = post_item(owner, kind="lost", description="Navy Nike hoodie size M", category="jacket", colors=["navy"],
                     locations=["locker_rooms"], time_from=iso(NOW - timedelta(days=1))).json()["item"]
    assert finder.post(f"/api/items/{found['id']}/claims", json={"proof": "it's mine"}).status_code == 422
    r = owner.post(f"/api/items/{found['id']}/claims", json={"proof": "Size M, my name is inside the hood",
                                                           "lost_item_id": lost["id"]})
    assert r.status_code == 201, r.text
    claim = r.json()["claim"]
    assert owner.post(f"/api/items/{found['id']}/claims", json={"proof": "again again"}).status_code == 409
    queue = desk.get("/api/admin/claims").json()["claims"]
    assert queue[0]["id"] == claim["id"] and queue[0]["claimant"]["email"] == "owner@school.test"
    assert desk.post(f"/api/admin/claims/{claim['id']}/decide", json={"decision": "approve"}).status_code == 200
    assert owner.get(f"/api/items/{found['id']}").json()["item"]["status"] == "claimed"
    assert desk.post(f"/api/admin/items/{found['id']}/returned").json()["item"]["status"] == "returned"
    assert owner.get(f"/api/items/{lost['id']}").json()["item"]["status"] == "returned"
    assert owner.get("/api/me/claims").json()["claims"][0]["status"] == "completed"
    stats = desk.get("/api/admin/stats").json()
    assert stats["totals"]["returned"] == 1 and stats["return_rate"] == 1.0


def test_admin_only_routes(users, client):
    assert users["owner"].get("/api/admin/stats").status_code == 403
    assert client.get("/api/admin/stats").status_code == 401
    assert users["desk"].get("/api/admin/stats").status_code == 200
    csv_text = users["desk"].get("/api/admin/export/items.csv").text
    assert csv_text.startswith("﻿")


def test_feedback_marks_lost_item_matched(users):
    post_item(users["finder"], description="pink TI-84 calculator", category="calculator", colors=["pink"],
              locations=["library"])
    r = post_item(users["owner"], kind="lost", description="pink TI-84", category="calculator", colors=["pink"],
                  locations=["library"], time_from=iso(NOW - timedelta(days=1)))
    match = r.json()["matches"][0]
    assert users["finder"].post(f"/api/matches/{match['id']}/feedback", json={"verdict": "confirmed"}).status_code == 403
    assert users["owner"].post(f"/api/matches/{match['id']}/feedback", json={"verdict": "confirmed"}).status_code == 200
    assert users["owner"].get(f"/api/items/{r.json()['item']['id']}").json()["item"]["status"] == "matched"


def test_search_and_filters(users, client):
    post_item(users["finder"], description="black bottle with a dinosaur sticker", colors=["black"], locations=["gym"])
    post_item(users["finder"], description="white AirPods case", category="earbuds", colors=["white"], locations=["library"])
    hits = client.get("/api/items", params={"q": "dinosaur"}).json()["items"]
    assert len(hits) == 1 and "dinosaur" in hits[0]["description"]
    assert len(client.get("/api/items", params={"color": "white"}).json()["items"]) == 1
    assert len(client.get("/api/items", params={"zone": "sports"}).json()["items"]) == 1
    assert len(client.get("/api/items", params={"category": "electronics"}).json()["items"]) == 1


def test_owner_can_close_and_edit(users):
    item = post_item(users["owner"], kind="lost", description="blue umbrella", category="umbrella",
                     time_from=iso(NOW - timedelta(days=1))).json()["item"]
    r = users["owner"].patch(f"/api/items/{item['id']}", json={"description": "navy umbrella with a duck handle"})
    assert r.json()["item"]["description"].startswith("navy")
    assert users["finder"].patch(f"/api/items/{item['id']}", json={"status": "closed"}).status_code == 403
    assert users["owner"].patch(f"/api/items/{item['id']}", json={"status": "closed"}).json()["item"]["status"] == "closed"


def test_cron_expires_old_items(users, client):
    from backend.app.db import get_sessionmaker
    from backend.app.models import Item

    item = post_item(users["finder"], description="old bottle").json()["item"]
    with get_sessionmaker()() as db:
        row = db.get(Item, __import__("uuid").UUID(item["id"]))
        row.created_at = NOW - timedelta(days=90)
        db.commit()
    assert client.get("/api/cron/expire").status_code == 401
    r = client.get("/api/cron/expire", headers={"Authorization": "Bearer test-cron-secret"})
    assert r.json()["expired"] == 1
    assert client.get(f"/api/items/{item['id']}").json()["item"]["status"] == "expired"

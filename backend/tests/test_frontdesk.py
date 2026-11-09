"""Front desk feedback (2026-10): drop-off points, the open canteen shelf, close reasons, staff accounts."""

import uuid
from datetime import timedelta

from .conftest import login, make_client
from .test_api import NOW, post_item


def test_meta_lists_dropoff_points(client):
    meta = client.get("/api/meta").json()
    kinds = {p["id"]: p["kind"] for p in meta["dropoffs"]}
    assert kinds["desk_5f"] == "desk" and kinds["canteen_shelf"] == "shelf"
    assert "water_bottle" in meta["value_classes"]["low"] and "phone" in meta["value_classes"]["high"]


def test_found_item_holding_defaults_and_legacy(users):
    finder = users["finder"]
    r = post_item(finder, description="black phone", category="phone", locations=["library"])
    assert r.status_code == 201 and r.json()["item"]["holding"] == "desk_5f"
    r = post_item(finder, description="black phone", category="phone", holding="front_desk")
    assert r.json()["item"]["holding"] == "desk_5f"  # old value still accepted
    r = post_item(finder, description="black phone", category="phone", holding="desk_library")
    assert r.json()["item"]["holding"] == "desk_library"
    assert post_item(finder, description="black phone", category="phone", holding="moon").status_code == 422


def test_generic_items_are_flagged(users):
    finder = users["finder"]
    plain = post_item(finder, description="black water bottle", holding="canteen_shelf").json()["item"]
    marked = post_item(finder, description="black water bottle with a dinosaur sticker").json()["item"]
    secret = post_item(finder, description="black water bottle", private_detail="K.L. under the lid").json()["item"]
    phone = post_item(finder, description="black phone", category="phone").json()["item"]
    assert plain["generic"] is True
    assert not marked["generic"] and not secret["generic"] and not phone["generic"]


def test_shelf_items_are_self_service(users):
    owner, finder = users["owner"], users["finder"]
    shelf = post_item(finder, description="blue water bottle", colors=["blue"], locations=["cafeteria"],
                      holding="canteen_shelf").json()["item"]
    lost = post_item(owner, kind="lost", description="blue water bottle", colors=["blue"],
                     locations=["cafeteria"]).json()["item"]

    r = owner.post(f"/api/items/{shelf['id']}/claims", json={"proof": "it's mine, blue"})
    assert r.status_code == 422 and r.json()["detail"] == "shelf_item_self_service"

    r = owner.post(f"/api/items/{shelf['id']}/collected", json={"lost_item_id": lost["id"]})
    assert r.status_code == 200 and r.json()["item"]["status"] == "returned"
    assert owner.get(f"/api/items/{lost['id']}").json()["item"]["status"] == "returned"
    assert owner.post(f"/api/items/{shelf['id']}/collected", json={}).status_code == 409

    desk_item = post_item(finder, description="black phone", category="phone").json()["item"]
    assert owner.post(f"/api/items/{desk_item['id']}/collected", json={}).status_code == 422


def test_close_reason_is_kept_and_counted(users):
    owner, desk = users["owner"], users["desk"]
    lost = post_item(owner, kind="lost", description="red umbrella", category="umbrella").json()["item"]
    r = owner.patch(f"/api/items/{lost['id']}", json={"status": "closed", "close_reason": "found_myself"})
    assert r.status_code == 200
    assert r.json()["item"]["status"] == "closed" and r.json()["item"]["close_reason"] == "found_myself"
    assert owner.patch(f"/api/items/{lost['id']}", json={"close_reason": "nope"}).status_code == 422
    assert desk.get("/api/admin/stats").json()["close_reasons"] == {"found_myself": 1}
    r = owner.patch(f"/api/items/{lost['id']}", json={"status": "open"})
    assert r.json()["item"]["close_reason"] is None


def test_shelf_items_expire_sooner(users, client):
    from backend.app.db import get_sessionmaker
    from backend.app.models import Item

    finder = users["finder"]
    shelf = post_item(finder, description="green cup", holding="canteen_shelf").json()["item"]
    desk = post_item(finder, description="green cup with a name sticker", holding="desk_5f").json()["item"]
    with get_sessionmaker()() as db:
        for item_id in (shelf["id"], desk["id"]):
            row = db.get(Item, uuid.UUID(item_id))
            row.created_at = NOW - timedelta(days=20)
        db.commit()
    r = client.get("/api/cron/expire", headers={"Authorization": "Bearer test-cron-secret"})
    assert r.json()["expired"] == 1
    assert client.get(f"/api/items/{shelf['id']}").json()["item"]["status"] == "expired"
    assert client.get(f"/api/items/{desk['id']}").json()["item"]["status"] == "open"


def test_daily_check(users):
    finder, desk = users["finder"], users["desk"]
    a = post_item(finder, description="black phone", category="phone", holding="desk_library").json()["item"]
    b = post_item(finder, description="silver laptop", category="laptop", holding="desk_library").json()["item"]
    post_item(finder, description="grey tablet", category="tablet", holding="desk_dorm")

    listed = desk.get("/api/admin/inventory", params={"dropoff": "desk_library"}).json()["items"]
    assert {i["id"] for i in listed} == {a["id"], b["id"]}
    assert finder.get("/api/admin/inventory").status_code == 403

    r = desk.post(f"/api/admin/items/{a['id']}/check", json={"action": "present"})
    assert r.status_code == 200 and r.json()["item"]["checked_at"]
    listed = desk.get("/api/admin/inventory", params={"dropoff": "desk_library"}).json()["items"]
    assert listed[-1]["id"] == a["id"]  # just checked → bottom of the round

    r = desk.post(f"/api/admin/items/{b['id']}/check", json={"action": "move", "to": "desk_5f"})
    assert r.json()["item"]["holding"] == "desk_5f"
    assert desk.post(f"/api/admin/items/{b['id']}/check", json={"action": "move", "to": "with_finder"}).status_code == 422
    r = desk.post(f"/api/admin/items/{a['id']}/check", json={"action": "gone"})
    assert r.json()["item"]["status"] == "returned"
    assert desk.get("/api/admin/inventory", params={"dropoff": "desk_library"}).json()["items"] == []

    assert [i["id"] for i in desk.get("/api/admin/items", params={"dropoff": "desk_5f"}).json()["items"]] == [b["id"]]


def test_superadmin_manages_staff(app, users):
    desk, owner = users["desk"], users["owner"]
    assert desk.get("/api/me").json()["user"]["role"] == "superadmin"  # ADMIN_EMAILS without SUPERADMIN_EMAILS
    staff = desk.get("/api/admin/staff").json()
    assert staff["staff"][0] == {**staff["staff"][0], "email": "desk@school.test", "managed": "env"}

    r = desk.post("/api/admin/staff", json={"email": "Helen@School.test", "desk": "desk_library"})
    assert r.status_code == 201 and r.json()["staff"]["role"] == "admin"
    assert desk.post("/api/admin/staff", json={"email": "helen@school.test"}).status_code == 409
    assert desk.post("/api/admin/staff", json={"email": "x@school.test", "desk": "moon"}).status_code == 422

    with make_client(app) as helen:
        user = login(helen, "helen@school.test", "Helen")
        assert user["role"] == "admin" and user["desk"] == "desk_library"
        assert helen.get("/api/admin/items").status_code == 200
        assert helen.get("/api/admin/staff").status_code == 403
        # Quick add from Helen lands at her desk unless she picks another.
        r = post_item(helen, description="black phone", category="phone")
        assert r.json()["item"]["holding"] == "desk_library"

        assert desk.patch("/api/admin/staff/helen@school.test", json={"desk": "desk_dorm"}).status_code == 200
        assert helen.get("/api/me").json()["user"]["desk"] == "desk_dorm"
        assert desk.patch("/api/admin/staff/helen@school.test", json={"role": "superadmin"}).status_code == 200
        assert helen.get("/api/admin/staff").status_code == 200

        assert desk.delete("/api/admin/staff/helen@school.test").status_code == 200
        assert helen.get("/api/me").json()["user"]["role"] == "user"
        assert helen.get("/api/admin/items").status_code == 403

    assert desk.delete("/api/admin/staff/desk@school.test").json()["detail"] == "staff_env_managed"
    assert desk.patch("/api/admin/staff/desk@school.test", json={"role": "admin"}).status_code == 422
    r = desk.patch("/api/admin/staff/desk@school.test", json={"desk": "desk_5f"})
    assert r.status_code == 200 and desk.get("/api/me").json()["user"]["desk"] == "desk_5f"
    assert owner.get("/api/admin/staff").status_code == 403


def test_staff_need_a_school_address(app, users, monkeypatch):
    from backend.app.config import get_settings

    monkeypatch.setenv("ALLOWED_EMAIL_DOMAINS", "basischina.com")
    get_settings.cache_clear()
    try:
        desk = users["desk"]
        assert desk.post("/api/admin/staff", json={"email": "t@gmail.com"}).json()["detail"] == "staff_email_domain"
        assert desk.post("/api/admin/staff", json={"email": "t@basischina.com"}).status_code == 201
    finally:
        monkeypatch.delenv("ALLOWED_EMAIL_DOMAINS")
        get_settings.cache_clear()


def test_superadmin_list_narrows_admins(app, monkeypatch):
    from backend.app.config import get_settings

    monkeypatch.setenv("SUPERADMIN_EMAILS", "boss@school.test")
    get_settings.cache_clear()
    try:
        with make_client(app) as c:
            assert login(c, "desk@school.test")["role"] == "admin"
            assert c.get("/api/admin/staff").status_code == 403
        with make_client(app) as c:
            assert login(c, "boss@school.test")["role"] == "superadmin"
    finally:
        monkeypatch.delenv("SUPERADMIN_EMAILS")
        get_settings.cache_clear()


def test_works_before_the_staff_migration(app, users):
    """A deploy may land before supabase/migrations is re-applied: env staff keep working."""
    from backend.app import auth
    from backend.app.db import get_engine
    from backend.app.models import StaffAccount

    StaffAccount.__table__.drop(get_engine())
    auth._staff_table.update(ok=False, checked=0.0)
    try:
        desk = users["desk"]
        assert desk.get("/api/me").json()["user"]["role"] == "superadmin"
        assert desk.get("/api/admin/staff").json() == {"staff": [desk.get("/api/admin/staff").json()["staff"][0]],
                                                      "ready": False}
        assert desk.post("/api/admin/staff", json={"email": "a@school.test"}).status_code == 503
        with make_client(app) as c:
            assert login(c, "student@school.test")["role"] == "user"
    finally:
        StaffAccount.__table__.create(get_engine(), checkfirst=True)  # the client above re-runs init_db
        auth._staff_table.update(ok=False, checked=0.0)


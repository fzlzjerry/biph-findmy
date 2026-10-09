"""Demo data for local development, the Q1 presentation and end-to-end tests.

    python -m backend.app.seed --reset        # wipe local SQLite and load demo data
    python -m backend.app.seed                # add demo data to the configured database

All times are relative to *now*, so the demo never goes stale. Seed items carry attrs.demo=true
and can be removed later from the admin page ("Remove demo data").
"""

from __future__ import annotations

import argparse
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from matcher import get_matcher

from .auth import LOCAL_NAMESPACE
from .config import get_settings
from .db import get_engine, get_sessionmaker, init_db
from .models import Base, Item, Profile
from .services.matching import enrich, refresh_matches

CST = timezone(timedelta(hours=8))
DEMO_USERS = {
    "owner": ("student.demo@findmy.local", "Demo Student"),
    "finder": ("finder.demo@findmy.local", "Demo Finder"),
    "desk": ("desk.demo@findmy.local", "Front Desk"),
}

# (kind, reporter, days_ago, hour, description, category, colors, places, extra)
FOUND = [
    # six black bottles — the look-alike showcase
    ("found", "desk", 1, 8.5, "Black thermos bottle with a green dinosaur sticker, left on the gym bleachers",
     "water_bottle", ["black"], ["gym"], {}),
    ("found", "desk", 2, 13.5, "black Hydro Flask, dented near the bottom", "water_bottle", ["black"], ["cafeteria"],
     {"brand": "hydro_flask"}),
    ("found", "finder", 1, 14, "在化学实验室捡到一个黑色水杯", "water_bottle", ["black"], ["science_lab"],
     {"private_detail": "lid says K.L. in silver marker"}),
    ("found", "desk", 3, 7.8, "Stanley cup, black, with handle — found next to the track", "water_bottle", ["black"],
     ["field_track"], {"brand": "stanley"}),
    ("found", "finder", 2, 17, "图书馆二楼有个黑色的瓶子，没什么特征", "water_bottle", ["black"], ["library"], {}),
    ("found", "desk", 4, 8, "黑色吸管杯，盖子是透明的", "water_bottle", ["black"], ["dorm"], {}),
    # four AirPods cases
    ("found", "desk", 1, 15, "AirPods Pro case with a cat silicone cover, music room", "earbuds", ["white"],
     ["music_room"], {"brand": "apple"}),
    ("found", "finder", 3, 9, "白色苹果耳机盒，走廊储物柜旁边捡到的", "earbuds", ["white"], ["hallway_lockers"],
     {"private_detail": "case engraved J.W."}),
    ("found", "desk", 2, 16, "AirPods with a cracked case found on the school bus seat", "earbuds", ["white"],
     ["bus_stop"], {"brand": "apple"}),
    ("found", "desk", 5, 13, "white Huawei earbuds in the canteen", "earbuds", ["white"], ["cafeteria"],
     {"brand": "huawei"}),
    # three navy hoodies
    ("found", "desk", 1, 15, "深蓝色耐克卫衣 M码，更衣室捡到", "jacket", ["navy"], ["locker_rooms"], {"brand": "nike"}),
    ("found", "desk", 4, 8, "Navy school uniform jacket, name tag says CHEN", "uniform", ["navy"], ["classroom"], {}),
    ("found", "finder", 6, 14, "礼堂座位上有一件深蓝色北面抓绒外套", "jacket", ["navy"], ["auditorium"],
     {"brand": "north_face"}),
    # singletons
    ("found", "desk", 2, 9, "TI-84 calculator found in a classroom, masking tape on the back", "calculator", ["black"],
     ["classroom"], {"private_detail": "tape says LEO", "brand": "texas_instruments"}),
    ("found", "desk", 3, 17.5, "pink graphing calculator TI84 on a library desk", "calculator", ["pink"], ["library"],
     {"brand": "texas_instruments"}),
    ("found", "desk", 1, 7.6, "Student ID card in a blue holder with a panda charm on the lanyard, near the main gate",
     "id_card", ["blue"], ["main_gate"], {"private_detail": "name on the card: 周可欣"}),
    ("found", "desk", 0, 8, "游泳馆捡到蓝色泳镜", "swim_gear", ["blue"], ["pool"], {}),
    ("found", "desk", 2, 7.5, "clear umbrella with a wooden handle by the school gate", "umbrella", ["transparent"],
     ["main_gate"], {}),
    ("found", "finder", 1, 18, "自习区捡到一个棕色眼镜盒，里面有黑框眼镜", "glasses", ["brown"], ["study_hall"], {}),
    ("found", "desk", 3, 7, "keys with a panda keychain found in the dorm common room", "keys", [], ["dorm_common"], {}),
    ("found", "desk", 2, 10, "紫色条纹笔袋 无印良品 美术室", "pencil_case", ["purple"], ["art_room"], {"brand": "muji"}),
    ("found", "finder", 4, 12, "綠色筆記本 封面寫著 Algebra II", "notebook", ["green"], ["classroom"], {}),
    ("found", "desk", 1, 13.5, "pink zojirushi food jar left in the cafeteria", "lunch_box", ["pink"], ["cafeteria"],
     {"brand": "zojirushi"}),
    ("found", "desk", 2, 16, "机房捡到苹果笔，上面贴了个星星贴纸", "stylus", ["white"], ["computer_lab"], {"brand": "apple"}),
    ("found", "desk", 3, 8.2, "图书馆插座上有个白色充电头和数据线", "charger", ["white"], ["library"], {}),
    ("found", "desk", 1, 7.9, "red adidas track jacket with white stripes at the basketball courts", "jacket", ["red"],
     ["basketball_courts"], {"brand": "adidas"}),
    ("found", "desk", 5, 9, "黑盒剧场里有一把尤克里里，装在黑色琴包里", "instrument", ["black"], ["black_box"], {}),
    ("found", "desk", 2, 7.6, "米色渔夫帽 校车上", "hat", ["beige"], ["bus_stop"], {}),
    ("found", "desk", 6, 7, "黑色皮钱包，宿舍门口捡到", "wallet", ["black"], ["dorm"], {"private_detail": "has a bus card"}),
    ("found", "finder", 1, 16, "black xiaomi fitness band found on the field", "watch", ["black"], ["field_track"],
     {"brand": "xiaomi"}),
    ("found", "desk", 4, 10, "生物课本 Campbell，在实验室", "textbook", [], ["science_lab"],
     {"private_detail": "name inside: Mia"}),
    ("found", "desk", 2, 17, "更衣室有双白色耐克鞋 39码", "shoes", ["white"], ["locker_rooms"], {"brand": "nike"}),
    ("found", "desk", 0, 12, "black glasses case, empty, cafeteria", "glasses", ["black"], ["cafeteria"], {}),
    ("found", "desk", 3, 20, "钥匙一串 没有挂件 宿舍楼梯", "keys", [], ["dorm"], {}),
    ("found", "desk", 9, 12, "blue water bottle with stickers of planets", "water_bottle", ["blue"], ["classroom"], {}),
]
LOST = [
    ("lost", "owner", 2, 15, "黑色保温杯 贴了恐龙贴纸，周二体育课后在体育馆不见了", "water_bottle", ["black"], ["gym"],
     {"window_h": 2, "marks_text": "恐龙贴纸"}),
    ("lost", "owner", 4, 11, "my airpods (not pro) have J.W. engraved on the case!! lost around the hallway lockers",
     "earbuds", ["white"], ["hallway_lockers"], {"window_h": 3}),
    ("lost", "owner", 3, 14, "TI-84 Plus calculator, my name LEO is on masking tape on the back", "calculator",
     ["black"], ["classroom"], {"window_h": 2}),
    ("lost", "owner", 2, 10, "Navy Nike hoodie size M, left it in the gym changing room after PE", "jacket", ["navy"],
     ["locker_rooms", "gym"], {"window_h": 1}),
    ("lost", "owner", 3, 16.5, "透明雨伞，伞柄是木头的，校门口", "umbrella", ["transparent"], ["main_gate"], {"window_h": 1}),
    ("lost", "owner", 3, 15, "purple striped pencil case (muji) with all my pens, art room", "pencil_case", ["purple"],
     ["art_room"], {"window_h": 2}),
    ("lost", "finder", 0, 10, "银色的 iPad mini，带一个灰色的保护套，可能在图书馆", "tablet", ["silver"], ["library"],
     {"window_h": 3}),
    ("lost", "finder", 5, 16, "green Kanken backpack with a rocket keychain, school bus", "backpack", ["green"],
     ["bus_stop"], {"window_h": 1}),
]


def _profile(db, key: str) -> Profile:
    email, name = DEMO_USERS[key]
    uid = uuid.uuid5(LOCAL_NAMESPACE, email)
    profile = db.get(Profile, uid)
    if profile is None:
        profile = Profile(id=uid, email=email, display_name=name, role="admin" if key == "desk" else "user")
        db.add(profile)
        db.flush()
    return profile


def _when(days_ago: float, hour: float) -> datetime:
    today = datetime.now(CST).replace(hour=0, minute=0, second=0, microsecond=0)
    return (today - timedelta(days=days_ago) + timedelta(hours=hour)).astimezone(timezone.utc)


def seed(reset: bool = False) -> int:
    settings = get_settings()
    if reset:
        if not settings.database_url.startswith("sqlite"):
            raise SystemExit("--reset only works with the local SQLite database")
        Base.metadata.drop_all(get_engine())
    init_db() if settings.database_url.startswith("sqlite") else None
    now = datetime.now(timezone.utc)
    with get_sessionmaker()() as db:
        existing = {i.description for i in db.scalars(select(Item)).unique().all() if (i.attrs or {}).get("demo")}
        created = []
        for kind, who, days, hour, text, cat, colors, places, extra in FOUND + LOST:
            if text in existing:
                continue
            start = min(_when(days, hour), now - timedelta(minutes=5))
            item = Item(
                kind=kind, reporter_id=_profile(db, who).id, description=text, category=cat, colors=colors,
                locations=[get_matcher().vocab.canon_place(p) for p in places], time_from=start,
                time_to=start + timedelta(hours=extra.get("window_h", 0)) if kind == "lost" else None,
                marks_text=extra.get("marks_text", ""), private_detail=extra.get("private_detail", ""),
                brand=extra.get("brand"), holding="front_desk" if kind == "found" else None,
                holding_note="Front desk, main building" if kind == "found" and who == "desk" else "",
                created_at=start + timedelta(minutes=30) if start + timedelta(minutes=30) < now else now,
                attrs={"demo": True},
            )
            db.add(item)
            db.flush()
            enrich(item)
            item.attrs = {**item.attrs, "demo": True}
            created.append(item)
        db.flush()
        for item in created:
            if item.kind == "lost":
                refresh_matches(db, item)
        db.commit()
    return len(created)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="wipe the local SQLite database first")
    args = parser.parse_args()
    n = seed(reset=args.reset)
    print(f"seeded {n} demo items")
    print("demo accounts (local auth): " + ", ".join(e for e, _ in DEMO_USERS.values()))
    print("set ADMIN_EMAILS=desk.demo@findmy.local to use the front-desk account locally")


if __name__ == "__main__":
    main()

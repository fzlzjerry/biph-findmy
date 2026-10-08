"""Synthetic lost/found reports for fitting and stress-testing the matcher.

Each *object* (one real thing, e.g. "black Hydro Flask with a dinosaur sticker") produces a
lost report written "from memory" by its owner and a found report written by someone looking
at it. The generator deliberately makes this hard:

  * look-alike families — many objects share category + colour (the "six black bottles" problem)
  * 45% Chinese / 40% English / 15% mixed, some Chinese converted to Traditional characters
  * owners forget details, misremember colours (navy → blue) and places
  * ~35% of reports use held-out words (eval/heldout.yaml) the dictionary has never seen
  * typos, finders who keep identifying details private, reports with no true match

Everything is seeded, so the same seed always yields the same dataset.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path

import yaml

from ..api import ItemInput
from ..vocab import DATA_DIR

HERE = Path(__file__).resolve().parent
CST = timezone(timedelta(hours=8))
BASE_DAY = datetime(2026, 9, 1, tzinfo=CST)

CATEGORY_FREQ = {
    "water_bottle": 14, "jacket": 10, "earbuds": 9, "calculator": 6, "id_card": 5, "pencil_case": 5,
    "notebook": 5, "umbrella": 5, "charger": 5, "glasses": 4, "uniform": 4, "lunch_box": 4,
    "textbook": 3, "pen": 3, "keys": 3, "phone": 3, "stylus": 3, "hat": 3, "shoes": 3, "pe_kit": 3,
    "swim_gear": 3, "jewelry": 3, "backpack": 3, "wallet": 2, "tablet": 2, "watch": 2, "towel": 2,
    "ball": 2, "racket": 2, "tote_bag": 2, "scarf_gloves": 1, "laptop": 1, "headphones": 1,
    "instrument": 1, "art_supplies": 1, "utensils": 1,
}
CATEGORY_COLORS = {
    "water_bottle": ["black", "white", "navy", "pink", "green", "blue", "gray", "silver", "purple", "transparent"],
    "earbuds": ["white", "white", "black"],
    "jacket": ["navy", "black", "gray", "white", "green", "red", "beige"],
    "uniform": ["navy", "white", "gray"],
    "calculator": ["black", "navy", "white", "pink"],
    "id_card": ["white", "blue"],
    "phone": ["black", "white", "blue", "purple", "silver", "gold"],
    "glasses": ["black", "brown", "gold", "silver", "transparent"],
    "umbrella": ["black", "navy", "transparent", "pink", "yellow", "multicolor"],
    "charger": ["white", "black"],
    "stylus": ["white"],
}
DEFAULT_COLORS = ["black", "white", "gray", "navy", "blue", "red", "pink", "green", "purple",
                  "yellow", "orange", "brown", "beige", "multicolor"]
CATEGORY_BRANDS = {
    "water_bottle": ["hydro_flask", "stanley", "zojirushi"], "earbuds": ["apple", "huawei", "xiaomi", "samsung"],
    "phone": ["apple", "huawei", "xiaomi", "samsung"], "jacket": ["nike", "adidas", "uniqlo", "north_face", "under_armour", "lululemon", "anta", "li_ning"],
    "calculator": ["texas_instruments", "casio"], "backpack": ["jansport", "herschel", "kanken", "nike", "north_face"],
    "tablet": ["apple", "huawei", "lenovo"], "laptop": ["apple", "lenovo"], "watch": ["apple", "huawei", "xiaomi", "casio"],
    "headphones": ["sony", "beats", "apple"], "shoes": ["nike", "adidas", "anta", "li_ning", "puma"],
    "hat": ["nike", "adidas"], "pe_kit": ["nike", "adidas", "anta"], "stylus": ["apple"],
    "charger": ["apple", "xiaomi", "huawei"], "notebook": ["muji", "deli"], "pen": ["muji", "deli"],
    "pencil_case": ["muji", "deli"], "tote_bag": ["uniqlo", "muji"], "lunch_box": ["zojirushi", "muji"],
}
MODEL_CODES = {"texas_instruments": ["TI-84", "TI-84 Plus"], "casio": ["fx-991", "fx-82"]}
CATEGORY_PLACES = {
    "swim_gear": ["pool", "locker_rooms"], "towel": ["pool", "locker_rooms", "gym"],
    "ball": ["gym", "basketball_courts", "field_track"], "racket": ["gym", "tennis_courts"],
    "shoes": ["gym", "locker_rooms", "dorm", "field_track"], "pe_kit": ["gym", "locker_rooms", "field_track"],
    "lunch_box": ["cafeteria", "classroom"], "utensils": ["cafeteria"],
    "instrument": ["music_room", "auditorium", "black_box"], "art_supplies": ["art_room", "classroom"],
    "calculator": ["classroom", "library", "science_lab", "hallway_lockers"],
}
PLACE_WEIGHTS = {
    "classroom": 3, "hallway_lockers": 3, "cafeteria": 3, "library": 2, "gym": 2, "study_hall": 1.5,
    "dorm": 1.5, "field_track": 1, "bus_stop": 1, "auditorium": 1, "science_lab": 1, "computer_lab": 1,
    "main_gate": 0.5, "basketball_courts": 0.8, "dorm_common": 0.8, "art_room": 0.5, "music_room": 0.5,
    "pool": 0.5, "locker_rooms": 0.8, "black_box": 0.4, "tennis_courts": 0.3,
}
MARKS_FOR = {
    "sticker": {"water_bottle", "laptop", "tablet", "calculator", "notebook", "phone", "earbuds", "pencil_case", "lunch_box"},
    "keychain": {"keys", "backpack", "pencil_case", "earbuds", "id_card"},
    "name": None,  # any category
    "dent": {"water_bottle", "lunch_box", "laptop"},
    "scratch": {"phone", "tablet", "laptop", "watch", "glasses", "calculator", "water_bottle"},
    "case": {"phone", "earbuds", "tablet", "glasses", "calculator"},
    "pattern": {"jacket", "pe_kit", "hat", "tote_bag", "backpack", "notebook", "umbrella", "towel", "pencil_case", "scarf_gloves"},
    "tape": {"calculator", "notebook", "charger"},
    "strap": {"id_card", "watch"},
}
MOTIFS = ["dinosaur", "cat", "dog", "bear", "rabbit", "panda", "star", "heart", "flower", "shark",
          "rocket", "planet", "moon", "smiley", "anime", "fruit"]
INITIALS = ["K.L.", "J.W.", "M.C.", "A.Z.", "S.H.", "E.T.", "R.Y.", "L.Q.", "D.P.", "C.X."]
ZH_NAMES = ["王小明", "李思琪", "陈子豪", "张雨涵", "刘嘉怡", "黄梓轩", "周可欣", "吴俊杰"]
SIMILAR = {"navy": "blue", "blue": "navy", "gray": "silver", "silver": "gray", "gold": "yellow",
           "beige": "white", "pink": "red", "purple": "blue", "black": "navy"}
ZH_TYPO = {"杯": "悲", "色": "涩", "黑": "嘿", "蓝": "兰", "耳": "尔", "机": "几", "包": "报", "书": "输", "子": "字"}


@dataclass
class Obj:
    id: str
    category: str
    colors: list[str]
    brand: str | None
    marks: list[tuple[str, str | None]]  # (mark, motif / code / colour)
    model_code: str | None
    place: str
    lost_from: datetime
    lost_to: datetime
    found_at: datetime


@dataclass
class Report:
    id: str
    object_id: str
    kind: str
    text: str
    lang: str
    oov: bool
    time_from: datetime
    time_to: datetime | None
    category: str | None = None
    colors: list[str] | None = None
    locations: list[str] = field(default_factory=list)
    private_detail: str = ""

    def to_item(self, structured: bool = True) -> ItemInput:
        return ItemInput(
            id=self.id, kind=self.kind, description=self.text, time_from=self.time_from,
            time_to=self.time_to, private_detail=self.private_detail,
            category=self.category if structured else None,
            colors=self.colors if structured else None,
            locations=self.locations if structured else [],
        )


@dataclass
class Dataset:
    objects: dict[str, Obj]
    lost: list[Report]
    found: list[Report]
    split: dict[str, str]

    def reports(self, kind: str, split: str | None = None) -> list[Report]:
        pool = self.lost if kind == "lost" else self.found
        return [r for r in pool if split is None or self.split[r.object_id] == split]


class Generator:
    def __init__(self, seed: int = 7):
        self.rng = random.Random(seed)
        tax = yaml.safe_load((DATA_DIR / "taxonomy.yaml").read_text(encoding="utf-8"))
        loc = yaml.safe_load((DATA_DIR / "locations.yaml").read_text(encoding="utf-8"))
        held = yaml.safe_load((HERE / "heldout.yaml").read_text(encoding="utf-8"))
        self.cat_words = {c["id"]: {"en": c.get("en") or [], "zh": c.get("zh") or []}
                          for p in tax["categories"] for c in p["children"]}
        self.weak = {c["id"]: set(c.get("weak") or []) for p in tax["categories"] for c in p["children"]}
        self.parent = {c["id"]: p["id"] for p in tax["categories"] for c in p["children"]}
        self.color_words = {c["id"]: {"en": c["en"][:2], "zh": c["zh"][:2]} for c in tax["colors"]}
        self.brand_words = {b["id"]: {"en": b["label"], "zh": (b.get("zh") or [b["label"]])[0]} for b in tax["brands"]}
        self.motif_words = {m["id"]: {"en": m["en"][0], "zh": m["zh"][0]} for m in tax["motifs"]}
        self.place_words = {p["id"]: {"en": [a for a in p["aliases"] if a.isascii()][:3],
                                      "zh": [a for a in p["aliases"] if not a.isascii()][:3]}
                            for z in loc["zones"] for p in z["places"] if p["aliases"]}
        self.zone = {p["id"]: z["id"] for z in loc["zones"] for p in z["places"]}
        self.held_cats = held["categories"]
        self.held_marks = held["marks"]
        import opencc

        self.s2t = opencc.OpenCC("s2t")
        self._n = 0

    # ------------------------------------------------------------------ objects
    def _choice_w(self, weights: dict[str, float]) -> str:
        keys = list(weights)
        return self.rng.choices(keys, weights=[weights[k] for k in keys])[0]

    def _place_for(self, category: str) -> str:
        options = CATEGORY_PLACES.get(category)
        if options and self.rng.random() < 0.8:
            return self.rng.choice(options)
        return self._choice_w(PLACE_WEIGHTS)

    def new_object(self, like: Obj | None = None) -> Obj:
        rng = self.rng
        self._n += 1
        if like is not None:
            category, colors = like.category, list(like.colors)
        else:
            category = self._choice_w(CATEGORY_FREQ)
            palette = CATEGORY_COLORS.get(category, DEFAULT_COLORS)
            colors = [rng.choice(palette)]
            if rng.random() < 0.15:
                second = rng.choice(DEFAULT_COLORS)
                if second != colors[0]:
                    colors.append(second)
        brands = CATEGORY_BRANDS.get(category, [])
        brand = rng.choice(brands) if brands and rng.random() < 0.5 else None
        marks: list[tuple[str, str | None]] = []
        possible = [m for m, cats in MARKS_FOR.items() if cats is None or category in cats]
        n_marks = rng.choices([0, 1, 2], weights=[0.35, 0.45, 0.2])[0]
        for mark in rng.sample(possible, min(n_marks, len(possible))):
            if mark in ("sticker", "keychain"):
                marks.append((mark, rng.choice(MOTIFS)))
            elif mark == "name":
                marks.append((mark, rng.choice(INITIALS) if rng.random() < 0.7 else rng.choice(ZH_NAMES)))
            elif mark == "case":
                marks.append((mark, rng.choice(DEFAULT_COLORS)))
            else:
                marks.append((mark, None))
        model_code = rng.choice(MODEL_CODES[brand]) if brand in MODEL_CODES and rng.random() < 0.6 else None
        day = BASE_DAY + timedelta(days=rng.randint(0, 36), hours=rng.uniform(7.5, 17))
        window = timedelta(hours=rng.choice([0, 0.5, 1, 2, 3, 6, 9]))
        delay = timedelta(days=min(20.0, rng.expovariate(1 / 1.5)), hours=rng.uniform(0, 4))
        found_at = day + window * rng.random() + delay
        if rng.random() < 0.05:  # finder rounds the time down — still inside the gate tolerance
            found_at = day - timedelta(hours=rng.uniform(0, 12))
        return Obj(f"o{self._n:04d}", category, colors, brand, marks, model_code,
                   self._place_for(category), day, day + window, found_at)

    # ------------------------------------------------------------------ text
    def _lang(self) -> str:
        return self.rng.choices(["zh", "en", "mixed"], weights=[45, 40, 15])[0]

    def _cat_word(self, category: str, lang: str) -> tuple[str, bool]:
        held = self.held_cats.get(category, {}).get(lang if lang != "mixed" else "zh")
        if held and self.rng.random() < 0.35:
            return self.rng.choice(held), True
        words = [w for w in self.cat_words[category][lang if lang != "mixed" else "zh"]
                 if w not in self.weak[category]] or self.cat_words[category]["en"] or [category]
        return self.rng.choice(words[:4]), False

    def _color_word(self, color: str, lang: str) -> str:
        return self.rng.choice(self.color_words[color][lang])

    def _mark_phrase(self, mark: str, extra: str | None, lang: str) -> str:
        rng = self.rng
        motif = self.motif_words.get(extra, {}).get(lang) if extra in self.motif_words else None
        if lang == "en":
            if mark == "sticker":
                if rng.random() < 0.25:
                    return f"{rng.choice(self.held_marks['sticker']['en'])} {motif}"
                return rng.choice([f"with a {motif} sticker", f"with {motif} stickers on it", f"has a {motif} sticker"])
            if mark == "keychain":
                if rng.random() < 0.25:
                    return f"with a {motif} {rng.choice(self.held_marks['keychain']['en'])}"
                return rng.choice([f"with a {motif} keychain", f"a little {motif} charm attached"])
            if mark == "name":
                return rng.choice([f"with '{extra}' written on it", f"my initials {extra} are on the bottom",
                                   f"has the name {extra} on it"])
            if mark == "case":
                return f"in a {self._color_word(extra, 'en')} case"
            return {"dent": rng.choice(["with a dent", "dented on one side"]),
                    "scratch": rng.choice(["a bit scratched", "with scratches on the back"]),
                    "pattern": rng.choice(["with stripes", "with a floral print"]),
                    "tape": "with some tape on it", "strap": "with a lanyard"}[mark]
        if mark == "sticker":
            if rng.random() < 0.25:
                return f"{rng.choice(self.held_marks['sticker']['zh'])}{motif}"
            return rng.choice([f"贴了{motif}贴纸", f"上面有{motif}的贴纸", f"有个{motif}贴画"])
        if mark == "keychain":
            if rng.random() < 0.25:
                return f"{rng.choice(self.held_marks['keychain']['zh'])}{motif}"
            return rng.choice([f"挂着{motif}挂件", f"有个{motif}钥匙扣"])
        if mark == "name":
            return rng.choice([f"上面写着{extra}", f"底部有名字缩写{extra}", f"刻着{extra}"])
        if mark == "case":
            return f"套着{self._color_word(extra, 'zh')}的壳"
        return {"dent": rng.choice(["有个凹痕", "侧面磕瘪了"]), "scratch": rng.choice(["有划痕", "背面有点刮花"]),
                "pattern": rng.choice(["有条纹", "有印花"]), "tape": "贴了胶带", "strap": "有挂绳"}[mark]

    def _typos(self, text: str, lang: str) -> str:
        rng = self.rng
        if lang == "en":
            words = text.split(" ")
            for i, w in enumerate(words):
                if len(w) > 4 and w.isalpha() and rng.random() < 0.06:
                    j = rng.randrange(1, len(w) - 1)
                    words[i] = rng.choice([w[:j] + w[j + 1:], w[:j] + w[j + 1] + w[j] + w[j + 2:], w[:j] + w[j] + w[j:]])
            return " ".join(words)
        if rng.random() < 0.08:
            chars = [i for i, ch in enumerate(text) if ch in ZH_TYPO]
            if chars:
                i = rng.choice(chars)
                text = text[:i] + ZH_TYPO[text[i]] + text[i + 1:]
        return text

    def describe(self, obj: Obj, role: str, *, place: str | None, colors: list[str],
                 include_brand: bool, marks: list[tuple[str, str | None]], code: str | None) -> tuple[str, str, bool]:
        rng = self.rng
        lang = self._lang()
        base = "en" if lang == "en" else "zh"
        mix = lang == "mixed"

        def word_lang() -> str:
            return "en" if mix and rng.random() < 0.5 else base

        cat_lang = word_lang()
        cat, oov = self._cat_word(obj.category, cat_lang)
        color = " ".join(self._color_word(c, word_lang()) for c in colors[:2])
        brand = self.brand_words[obj.brand][word_lang()] if include_brand and obj.brand else ""
        mark_lang = "en" if base == "en" else "zh"
        mark_txt = [self._mark_phrase(m, x, mark_lang) for m, x in marks]
        place_txt = ""
        if place and place in self.place_words:
            pl_lang = word_lang()
            options = self.place_words[place][pl_lang] or self.place_words[place]["en"]
            place_txt = rng.choice(options) if options else ""

        if base == "en":
            np_ = " ".join(p for p in (color, brand, code or "", cat) if p)
            np_ = f"a {np_}" if rng.random() < 0.6 else f"my {np_}" if role == "lost" else f"a {np_}"
            if mark_txt:
                np_ += " " + ", ".join(mark_txt)
            where = f" {rng.choice(['in the', 'at the', 'near the'])} {place_txt}" if place_txt else ""
            when = rng.choice(["", "", "this morning.", "yesterday.", "after PE.", "at lunch."])
            if role == "lost":
                tpl = rng.choice(["Lost {np}{where}. {when}", "Has anyone seen {np}? I think I left it{where}.",
                                  "{NP}, lost{where} {when} Please contact me!", "Missing: {np}. Last seen{where}."])
            else:
                tpl = rng.choice(["Found {np}{where}.", "Found {np}{where}, handed it to the front desk.",
                                  "{NP} found{where}. {when}", "Picked up {np}{where}."])
            text = tpl.format(np=np_, NP=np_[0].upper() + np_[1:], where=where, when=when)
        else:
            parts = [color + ("的" if color and rng.random() < 0.5 else ""), brand, code or "", cat]
            np_ = "".join(p for p in parts if p)
            if mark_txt:
                np_ += "，" + "，".join(mark_txt)
            when = rng.choice(["", "今天上午", "昨天下午", "午饭后", "体育课后"])
            if role == "lost":
                tpl = rng.choice(["我在{place}丢了{np}，{when}有人看到吗？", "{when}在{place}弄丢了{np}",
                                  "求助！丢了{np}，可能在{place}", "丢失：{np}，最后一次见是在{place}"]
                                 if place_txt else ["丢了{np}，有人看到吗？", "求助！{when}丢了{np}"])
            else:
                tpl = rng.choice(["在{place}捡到{np}，已交到前台", "{place}发现{np}", "捡到{np}，在{place}",
                                  "{when}在{place}捡到一个{np}"] if place_txt else ["捡到{np}，已交到前台", "捡到一个{np}"])
            text = tpl.format(np=np_, place=place_txt, when=when)
            if lang == "zh" and rng.random() < 0.2:
                text = self.s2t.convert(text)
                lang = "zh-hant"
        return self._typos(text.strip(), base), lang, oov

    # ------------------------------------------------------------------ reports
    def _report_id(self, prefix: str) -> str:
        self._n += 1
        return f"{prefix}{self._n:05d}"

    def _confirmed_category(self, true_cat: str) -> str | None:
        r = self.rng.random()
        if r < 0.85:
            return true_cat
        if r < 0.93:
            siblings = [c for c, p in self.parent.items() if p == self.parent[true_cat] and c != true_cat]
            return self.rng.choice(siblings) if siblings else true_cat
        return None

    def found_report(self, obj: Obj) -> Report:
        rng = self.rng
        shown = [m for m in obj.marks if rng.random() < 0.8]
        private = ""
        code = obj.model_code if rng.random() < 0.6 else None
        names = [m for m in shown if m[0] == "name"]
        if names and rng.random() < 0.3:  # finder keeps the written name private for verification
            shown = [m for m in shown if m[0] != "name"]
            private = f"inside: {names[0][1]}" if rng.random() < 0.5 else f"里面写着{names[0][1]}"
        r = rng.random()
        if r < 0.65:
            found_place = obj.place
        elif r < 0.85:
            same_zone = [p for p, z in self.zone.items() if z == self.zone[obj.place] and p != obj.place]
            found_place = rng.choice(same_zone) if same_zone else obj.place
        elif r < 0.95:
            found_place = self._choice_w(PLACE_WEIGHTS)
        else:
            found_place = None
        colors = obj.colors if rng.random() < 0.95 else []
        text, lang, oov = self.describe(obj, "found", place=found_place, colors=colors,
                                        include_brand=rng.random() < 0.7, marks=shown, code=code)
        return Report(self._report_id("f"), obj.id, "found", text, lang, oov, obj.found_at.astimezone(timezone.utc), None,
                      category=self._confirmed_category(obj.category),
                      colors=list(obj.colors) if rng.random() < 0.6 else None,
                      locations=[found_place] if found_place else [], private_detail=private)

    def lost_report(self, obj: Obj) -> Report:
        rng = self.rng
        recalled = [m for m in obj.marks if rng.random() < 0.7]
        colors = list(obj.colors)
        if rng.random() < 0.12 and colors[0] in SIMILAR:
            colors[0] = SIMILAR[colors[0]]
        if rng.random() < 0.12:
            colors = []
        r = rng.random()
        if r < 0.6:
            places = [obj.place] + ([self._choice_w(PLACE_WEIGHTS)] if rng.random() < 0.3 else [])
        elif r < 0.8:
            same_zone = [p for p, z in self.zone.items() if z == self.zone[obj.place] and p != obj.place]
            places = [rng.choice(same_zone)] if same_zone else [obj.place]
        elif r < 0.9:
            places = [self._choice_w(PLACE_WEIGHTS)]
        else:
            places = []
        places = list(dict.fromkeys(places))
        code = obj.model_code if rng.random() < 0.5 else None
        text, lang, oov = self.describe(obj, "lost", place=places[0] if places else None, colors=colors,
                                        include_brand=rng.random() < 0.55, marks=recalled, code=code)
        return Report(self._report_id("l"), obj.id, "lost", text, lang, oov,
                      obj.lost_from.astimezone(timezone.utc), obj.lost_to.astimezone(timezone.utc),
                      category=self._confirmed_category(obj.category),
                      colors=colors or None if rng.random() < 0.6 else None, locations=places)

    def lookalikes(self, obj: Obj, k: int) -> list[Report]:
        """k found reports of *different* objects with the same category and colour, near in time."""
        out = []
        for _ in range(k):
            twin = self.new_object(like=obj)
            twin.found_at = obj.lost_from + timedelta(days=self.rng.uniform(0, 4))
            twin.place = obj.place if self.rng.random() < 0.4 else twin.place
            out.append(self.found_report(twin))
        return out


def generate(n_objects: int = 600, seed: int = 7, found_only: float = 0.35, lost_only: float = 0.1,
             family_rate: float = 0.45) -> Dataset:
    gen = Generator(seed)
    rng = gen.rng
    objects: dict[str, Obj] = {}
    lost: list[Report] = []
    found: list[Report] = []
    roles: dict[str, str] = {}
    previous: list[Obj] = []
    for _ in range(n_objects):
        like = rng.choice(previous) if previous and rng.random() < family_rate else None
        obj = gen.new_object(like=like)
        objects[obj.id] = obj
        previous.append(obj)
        r = rng.random()
        roles[obj.id] = "found_only" if r < found_only else "lost_only" if r < found_only + lost_only else "pair"
    ids = list(objects)
    rng.shuffle(ids)
    split = {}
    for i, oid in enumerate(ids):
        split[oid] = "train" if i < 0.6 * len(ids) else "val" if i < 0.8 * len(ids) else "test"
    for oid in sorted(objects):
        obj = objects[oid]
        if roles[oid] in ("pair", "lost_only"):
            lost.append(gen.lost_report(obj))
        if roles[oid] in ("pair", "found_only"):
            found.append(gen.found_report(obj))
    return Dataset(objects, lost, found, split)


def background_corpus(n: int = 3000, seed: int = 1234) -> list[Report]:
    """Unlabelled descriptions used only to compute IDF statistics."""
    data = generate(n_objects=n // 2, seed=seed, found_only=0.0, lost_only=0.0)
    return data.lost + data.found

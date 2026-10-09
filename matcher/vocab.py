"""Loads taxonomy.yaml / locations.yaml into lookup tables and phrase patterns."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import yaml

from .normalize import normalize

DATA_DIR = Path(__file__).resolve().parent / "data"

# Lower number wins when two phrases of equal length compete for the same text.
KIND_PRIORITY = {"stop": 0, "location": 1, "category": 2, "mark": 3, "motif": 4, "color": 5}


@dataclass(frozen=True)
class Phrase:
    text: str
    kind: str
    id: str
    weak: bool
    pattern: re.Pattern


@dataclass(frozen=True)
class Category:
    id: str
    parent: str
    label: dict
    sensitive: bool = False


@dataclass(frozen=True)
class Place:
    id: str
    zone: str
    label: dict


@dataclass
class Vocab:
    categories: dict[str, Category] = field(default_factory=dict)
    parents: dict[str, dict] = field(default_factory=dict)
    colors: dict[str, dict] = field(default_factory=dict)
    color_sim: dict[tuple[str, str], float] = field(default_factory=dict)
    brands: dict[str, str] = field(default_factory=dict)
    marks: dict[str, dict] = field(default_factory=dict)
    motifs: dict[str, dict] = field(default_factory=dict)
    places: dict[str, Place] = field(default_factory=dict)
    zones: dict[str, dict] = field(default_factory=dict)
    legacy_places: dict[str, str] = field(default_factory=dict)  # old draft id -> current place id
    stopwords_en: frozenset[str] = frozenset()
    stopwords_zh: tuple[str, ...] = ()
    span_phrases: list[Phrase] = field(default_factory=list)  # competing kinds, longest first
    brand_phrases: list[Phrase] = field(default_factory=list)  # may overlap other spans

    def color_similarity(self, a: str, b: str) -> float:
        if a == b:
            return 1.0
        return self.color_sim.get((a, b), self.color_sim.get((b, a), 0.0))

    def canon_place(self, place_id: str) -> str:
        """Current id for a place, mapping ids from the first campus draft (seed / eval data) onto today's."""
        return self.legacy_places.get(place_id, place_id)

    def zone_of(self, place_id: str) -> str | None:
        place = self.places.get(self.canon_place(place_id))
        return place.zone if place else None

    def parent_of(self, category_id: str) -> str | None:
        cat = self.categories.get(category_id)
        return cat.parent if cat else None


def _compile(text: str) -> re.Pattern:
    """Word boundaries only where the phrase starts/ends with a Latin letter or digit.

    Single English words may also take a plural suffix ("sticker" matches "stickers").
    """
    body = re.escape(text)
    left = r"(?<![a-z0-9])" if re.match(r"[a-z0-9]", text) else ""
    plural = r"(?:s|es)?" if re.fullmatch(r"[a-z]+", text) and len(text) >= 3 else ""
    right = r"(?![a-z0-9])" if re.search(r"[a-z0-9]$", text) else ""
    return re.compile(left + body + plural + right)


def _phrases(words, kind, ident, weak_words=()) -> list[Phrase]:
    weak = {normalize(w) for w in weak_words}
    out = []
    for word in words or []:
        if not isinstance(word, str):  # YAML turns bare on/off/yes/no into booleans — quote them
            raise ValueError(f"{kind} {ident}: synonym {word!r} must be a quoted string")
        text = normalize(word)
        if text:
            out.append(Phrase(text, kind, ident, text in weak, _compile(text)))
    return out


@lru_cache(maxsize=4)
def load_vocab(data_dir: str | None = None) -> Vocab:
    base = Path(data_dir) if data_dir else DATA_DIR
    tax = yaml.safe_load((base / "taxonomy.yaml").read_text(encoding="utf-8"))
    loc = yaml.safe_load((base / "locations.yaml").read_text(encoding="utf-8"))
    vocab = Vocab()
    span: list[Phrase] = []
    brands: list[Phrase] = []

    for parent in tax["categories"]:
        vocab.parents[parent["id"]] = parent["label"]
        for child in parent["children"]:
            vocab.categories[child["id"]] = Category(
                child["id"], parent["id"], child["label"], bool(child.get("sensitive"))
            )
            words = (child.get("en") or []) + (child.get("zh") or [])
            span += _phrases(words, "category", child["id"], child.get("weak") or [])

    for color in tax["colors"]:
        vocab.colors[color["id"]] = {"label": color["label"], "hex": color.get("hex")}
        span += _phrases((color.get("en") or []) + (color.get("zh") or []), "color", color["id"])
    for a, b, sim in tax.get("color_similarity", []):
        vocab.color_sim[(a, b)] = float(sim)
    stops = tax.get("color_stop_compounds", {})
    span += _phrases((stops.get("en") or []) + (stops.get("zh") or []), "stop", "stop")

    for brand in tax["brands"]:
        vocab.brands[brand["id"]] = brand["label"]
        brands += _phrases((brand.get("en") or []) + (brand.get("zh") or []), "brand", brand["id"])

    for mark in tax["marks"]:
        vocab.marks[mark["id"]] = mark["label"]
        span += _phrases((mark.get("en") or []) + (mark.get("zh") or []), "mark", mark["id"])
    for motif in tax["motifs"]:
        vocab.motifs[motif["id"]] = {"en": (motif.get("en") or [motif["id"]])[0],
                                     "zh": (motif.get("zh") or [motif["id"]])[0]}
        span += _phrases((motif.get("en") or []) + (motif.get("zh") or []), "motif", motif["id"])

    for zone in loc["zones"]:
        vocab.zones[zone["id"]] = zone["label"]
        for place in zone["places"]:
            vocab.places[place["id"]] = Place(place["id"], zone["id"], place["label"])
            span += _phrases(place.get("aliases") or [], "location", place["id"])
    vocab.legacy_places = {old: new for old, new in (loc.get("legacy") or {}).items() if new in vocab.places}

    stop = tax.get("stopwords", {})
    vocab.stopwords_en = frozenset(normalize(w) for w in stop.get("en") or [])
    vocab.stopwords_zh = tuple(sorted({normalize(w) for w in stop.get("zh") or []}, key=len, reverse=True))

    span.sort(key=lambda p: (-len(p.text), KIND_PRIORITY[p.kind]))
    brands.sort(key=lambda p: -len(p.text))
    vocab.span_phrases = span
    vocab.brand_phrases = brands
    return vocab

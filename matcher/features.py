"""Turns a (lost, found) pair into evidence features.

Design rule: **missing information counts as 0** — it neither helps nor hurts. Positive values
are evidence for "same object", negative values evidence against. That keeps a sparse found
report ("水杯") from automatically scoring well against every bottle on campus.

    feature    range        meaning
    text       ~[-0.3, 0.7] description similarity, centred so unrelated pairs ≈ 0
    detail     ~[-0.3, 0.7] similarity of what is left after removing category/colour/place words
    marks      [0, 2]       shared distinguishing marks/motifs, weighted by rarity (IDF)
    code       {-0.5, 0, 1} shared initials / model numbers / written names
    category   [-1, 1]      same type +1, related +0.3, different −1 (× confidence)
    color      [-1, 1]      same +1, similar (navy≈blue) partial, different −1 (× confidence)
    brand      {-1, 0, 1}
    location   [-0.5, 1]    same place +1, same area +0.5, elsewhere −0.5
    time       [0.3, 1]     1 if found inside the lost window, then decays (gate: not before)
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

import numpy as np

from .extract import Extraction
from .textsim import SparseVec, Tfidf

FEATURES = ["text", "detail", "marks", "code", "category", "color", "brand", "location", "time"]

GATE_TOLERANCE = timedelta(hours=24)  # found this long *before* the loss window → impossible
WINDOW_SLACK = timedelta(hours=6)
TIME_DECAY_DAYS = 7.0
TIME_FLOOR = 0.3


@dataclass
class Prepared:
    id: str
    kind: str
    time_from: datetime
    time_to: datetime | None
    ex: Extraction
    category: str | None
    category_conf: float
    colors: list[str]
    color_conf: float
    brands: set[str]
    places: list[str]
    place_conf: float
    canon_public: set[str]
    canon_all: set[str]
    codes_public: set[str]
    codes_all: set[str]
    tf_text: SparseVec
    tf_detail: SparseVec
    emb_text: np.ndarray | None = None
    emb_detail: np.ndarray | None = None
    sensitive: bool = False
    extra: dict = field(default_factory=dict)

    @property
    def has_detail(self) -> bool:
        return bool(self.tf_detail) or self.emb_detail is not None


def utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def time_feature(lost: Prepared, found: Prepared) -> tuple[float | None, float]:
    """Returns (x_time, days_between) or (None, …) when the pair is impossible."""
    start = utc(lost.time_from)
    end = utc(lost.time_to) if lost.time_to else start
    if end < start:
        start, end = end, start
    found_at = utc(found.time_from)
    if found_at < start - GATE_TOLERANCE:
        return None, (found_at - start).total_seconds() / 86400
    if found_at <= end + WINDOW_SLACK:
        return 1.0, max(0.0, (found_at - start).total_seconds() / 86400)
    days = (found_at - end).total_seconds() / 86400
    return max(TIME_FLOOR, math.exp(-days / TIME_DECAY_DAYS)), days


def _code_kind(code: str) -> str:
    if re.fullmatch(r"[a-z]{2,3}", code):
        return "initials"
    if re.search(r"\d", code):
        return "model"
    return "name"


def pair_features(a: Prepared, b: Prepared, vocab, tfidf: Tfidf, centers: dict[str, float],
                  use_embeddings: bool) -> tuple[dict[str, float], dict] | None:
    lost, found = (a, b) if a.kind == "lost" else (b, a)
    x_time, days = time_feature(lost, found)
    if x_time is None:
        return None
    x: dict[str, float] = dict.fromkeys(FEATURES, 0.0)
    info: dict = {"days": round(days, 1)}
    x["time"] = x_time

    if use_embeddings and lost.emb_text is not None and found.emb_text is not None:
        text_sim = float(np.dot(lost.emb_text, found.emb_text))
    else:
        text_sim = tfidf.cosine(lost.tf_text, found.tf_text)
    x["text"] = text_sim - centers.get("text", 0.0)
    info["text_sim"] = round(text_sim, 3)

    if lost.has_detail and found.has_detail:
        if use_embeddings and lost.emb_detail is not None and found.emb_detail is not None:
            detail_sim = float(np.dot(lost.emb_detail, found.emb_detail))
        else:
            detail_sim = tfidf.cosine(lost.tf_detail, found.tf_detail)
        x["detail"] = detail_sim - centers.get("detail", 0.0)
        info["detail_sim"] = round(detail_sim, 3)

    shared_canon = lost.canon_all & found.canon_all
    if shared_canon:
        x["marks"] = min(2.0, sum(tfidf.canon_weight(t) for t in shared_canon) / 4.0)
    info["marks_public"] = sorted(lost.canon_public & found.canon_public)

    if lost.codes_all and found.codes_all:
        shared = lost.codes_all & found.codes_all
        if shared:
            x["code"] = 1.0
        elif {_code_kind(c) for c in lost.codes_all} & {_code_kind(c) for c in found.codes_all}:
            x["code"] = -0.5
        info["codes_public"] = sorted(lost.codes_public & found.codes_public)

    if lost.category and found.category:
        conf = min(lost.category_conf, found.category_conf)
        if lost.category == found.category:
            value = 1.0
        elif vocab.parent_of(lost.category) == vocab.parent_of(found.category):
            value = 0.3
        else:
            value = -1.0
        x["category"] = value * conf
        info["categories"] = (lost.category, found.category)

    if lost.colors and found.colors:
        best, pair = 0.0, (lost.colors[0], found.colors[0])
        for ca in lost.colors:
            for cb in found.colors:
                sim = vocab.color_similarity(ca, cb)
                if sim > best:
                    best, pair = sim, (ca, cb)
        x["color"] = (2 * best - 1) * min(lost.color_conf, found.color_conf)
        info["colors"] = pair

    if lost.brands and found.brands:
        x["brand"] = 1.0 if lost.brands & found.brands else -1.0
        info["brands"] = (sorted(lost.brands)[0], sorted(found.brands)[0])

    lost_places = [p for p in lost.places if p != "other"]
    found_places = [p for p in found.places if p != "other"]
    if lost_places and found_places:
        conf = min(lost.place_conf, found.place_conf)
        shared_place = next((p for p in found_places if p in lost_places), None)
        if shared_place:
            x["location"] = 1.0 * conf
            info["place"] = shared_place
        else:
            lost_zones = {vocab.zone_of(p) for p in lost_places}
            zone = next((vocab.zone_of(p) for p in found_places if vocab.zone_of(p) in lost_zones), None)
            if zone:
                x["location"] = 0.5 * conf
                info["zone"] = zone
            else:
                x["location"] = -0.5 * conf
                info["places"] = (lost_places[0], found_places[0])
    return x, info

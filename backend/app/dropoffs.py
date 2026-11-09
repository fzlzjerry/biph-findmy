"""Drop-off points (front desks and open shelves) from data/dropoffs.yaml, and which categories go where."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import yaml

PATH = Path(__file__).resolve().parent / "data" / "dropoffs.yaml"
# Not drop-off points, but still valid answers to "where is the item now?".
OTHER_HOLDINGS = ("with_finder", "other")


@dataclass(frozen=True)
class Point:
    id: str
    kind: str  # desk | shelf
    label: dict
    ttl_days: int | None = None


@dataclass(frozen=True)
class Dropoffs:
    points: dict[str, Point]
    legacy: dict[str, str]
    high: frozenset[str]
    low: frozenset[str]

    @property
    def desks(self) -> list[str]:
        return [p.id for p in self.points.values() if p.kind == "desk"]

    @property
    def shelves(self) -> list[str]:
        return [p.id for p in self.points.values() if p.kind == "shelf"]

    def canon(self, holding: str | None) -> str | None:
        return self.legacy.get(holding, holding) if holding else holding

    def stored_as(self, point: str) -> list[str]:
        """Every value an item at this point may carry in the database (its id plus legacy ids)."""
        return [point] + [old for old, new in self.legacy.items() if new == point]

    def valid(self, holding: str) -> bool:
        return holding in self.points or holding in OTHER_HOLDINGS

    def is_shelf(self, holding: str | None) -> bool:
        point = self.points.get(self.canon(holding) or "")
        return point is not None and point.kind == "shelf"

    def is_point(self, holding: str | None) -> bool:
        return (self.canon(holding) or "") in self.points


@lru_cache
def get_dropoffs() -> Dropoffs:
    raw = yaml.safe_load(PATH.read_text(encoding="utf-8"))
    points = {p["id"]: Point(p["id"], p["kind"], p["label"], p.get("ttl_days")) for p in raw["points"]}
    value = raw.get("value") or {}
    return Dropoffs(points, raw.get("legacy") or {}, frozenset(value.get("high") or []), frozenset(value.get("low") or []))


def is_generic(item) -> bool:
    """A low-value found item with nothing that tells it apart (no marks, codes or private detail):
    the matcher can't say which of several look-alikes is yours, so it's shown as "go and have a look"."""
    if item.kind != "found" or item.category not in get_dropoffs().low:
        return False
    attrs = item.attrs or {}
    return not ((item.marks_text or "").strip() or (item.private_detail or "").strip()
                or attrs.get("marks") or attrs.get("motifs") or attrs.get("codes"))

"""Evaluation sets: synthetic (generated), hand-written (LLM-written posts) and real (club activity)."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

import yaml

from ..vocab import DATA_DIR
from .generate import CST, Report

REAL_CSV = DATA_DIR / "real_pairs.csv"


@dataclass
class EvalSet:
    name: str
    queries: list[Report]   # lost reports
    pool: list[Report]      # found reports (true matches + distractors)

    @property
    def truth(self) -> dict[str, str]:
        """lost report id → found report id of the same object (if any).

        Assumes one found report per object; sets with several (two finders describing the same
        object) must be evaluated through `finder_splits()`, or the other finders' reports would be
        scored as wrong candidates.
        """
        found_by_obj = {r.object_id: r.id for r in self.pool}
        return {q.id: found_by_obj[q.object_id] for q in self.queries if q.object_id in found_by_obj}

    def finder_splits(self) -> list[EvalSet]:
        """One set per finder: each keeps exactly one found report per object.

        Split i takes the i-th found report of every object (its last one if it has fewer), so every
        finder's description is ranked once against the same distractors. Queries keep their order
        in every split, so rank lists line up query by query.
        """
        by_obj: dict[str, list[Report]] = {}
        for r in self.pool:
            by_obj.setdefault(r.object_id, []).append(r)
        n = max((len(v) for v in by_obj.values()), default=1)
        if n <= 1:
            return [self]
        return [EvalSet(f"{self.name}-f{i + 1}", self.queries, [v[min(i, len(v) - 1)] for v in by_obj.values()])
                for i in range(n)]


def _when(day0: datetime, day: float, hour: float) -> datetime:
    return (day0 + timedelta(days=day, hours=hour)).astimezone(timezone.utc)


def load_handwritten(path: Path | None = None) -> EvalSet:
    data = yaml.safe_load((path or DATA_DIR / "handwritten_pairs.yaml").read_text(encoding="utf-8"))
    y, m, d = (int(x) for x in str(data["reference_day"]).split("-"))
    day0 = datetime(y, m, d, tzinfo=CST)
    queries, pool = [], []
    for obj in data["objects"]:
        lost, found = obj["lost"], obj["found"]
        start = _when(day0, lost["day"], lost["hour"])
        queries.append(Report(f"{obj['id']}-L", obj["id"], "lost", lost["text"], "", False, start,
                              start + timedelta(hours=lost.get("window_h", 0)), category=lost.get("category"),
                              colors=lost.get("colors") or None, locations=lost.get("places") or []))
        pool.append(Report(f"{obj['id']}-F", obj["id"], "found", found["text"], "", False,
                           _when(day0, found["day"], found["hour"]), None, category=found.get("category"),
                           colors=found.get("colors") or None, locations=found.get("places") or [],
                           private_detail=found.get("private", "")))
    for i, dis in enumerate(data.get("distractors", [])):
        pool.append(Report(f"hd{i:02d}-F", f"hd{i:02d}", "found", dis["text"], "", False,
                           _when(day0, dis["day"], dis["hour"]), None, category=dis.get("category"),
                           colors=dis.get("colors") or None, locations=dis.get("places") or []))
    return EvalSet("handwritten", queries, pool)


def load_real(path: Path = REAL_CSV) -> EvalSet | None:
    """Real pairs from the club's describe-an-object activity (CSV, see docs/data-collection.md).

    Optional labelling columns: `lang` (en / zh / zh-hant / mixed), `writer`, `group`,
    `distinguishable` (yes / no) and `pair_ok` (rows marked `no` are skipped).
    """
    if not path.exists():
        return None
    queries, pool = [], []
    with path.open(encoding="utf-8-sig") as fh:
        for i, row in enumerate(csv.DictReader(fh)):
            if not (row.get("text") or "").strip():
                continue
            if (row.get("pair_ok") or "").strip().lower() == "no":
                continue
            when = datetime.fromisoformat(f"{row['date']}T{row.get('time') or '12:00'}").replace(tzinfo=CST)
            places = [p.strip() for p in (row.get("places") or "").split(";") if p.strip()]
            colors = [c.strip() for c in (row.get("colors") or "").split(";") if c.strip()] or None
            kind = row["kind"].strip().lower()
            meta = {k: (row.get(k) or "").strip().lower() for k in ("writer", "group", "distinguishable")
                    if (row.get(k) or "").strip()}
            report = Report(f"r{i:04d}-{kind[0]}", row["object_id"].strip(), kind, row["text"].strip(),
                            (row.get("lang") or "").strip().lower(), False,
                            when.astimezone(timezone.utc),
                            (when + timedelta(hours=float(row.get("window_hours") or 0))).astimezone(timezone.utc)
                            if kind == "lost" else None,
                            category=(row.get("category") or "").strip() or None, colors=colors, locations=places,
                            private_detail=(row.get("private_detail") or "").strip(), meta=meta)
            (queries if kind == "lost" else pool).append(report)
    return EvalSet("real", queries, pool) if queries and pool else None

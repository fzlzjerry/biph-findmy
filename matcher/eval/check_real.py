"""Check matcher/data/real_pairs.csv before evaluating it.

    python -m matcher.eval.check_real                 # the default CSV
    python -m matcher.eval.check_real path/to.csv

Prints one line per problem and a summary; exits 1 if any errors were found. Warnings (legacy
place ids, owner-only objects without a note, etc.) do not fail the check.
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path

from ..vocab import load_vocab
from .datasets import REAL_CSV

REQUIRED = ("object_id", "kind", "text", "date")
LANGS = {"en", "zh", "zh-hant", "mixed"}
GATE = timedelta(hours=24)  # matcher drops found reports this long before the loss (features.GATE_TOLERANCE)
PII = [
    (re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)"), "looks like a mobile number"),
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+"), "looks like an email address"),
    (re.compile(r"(?<![A-Za-z])A\d{2}(?!\d)"), "contains a sticker number"),
    (re.compile(r"(?<![A-Za-z])M\d{2}(?!\d)"), "contains a member code"),
]


def _split(value: str | None) -> list[str]:
    return [v.strip() for v in (value or "").split(";") if v.strip()]


def check(path: Path) -> tuple[list[str], list[str], dict]:
    vocab = load_vocab()
    errors: list[str] = []
    warnings: list[str] = []
    with path.open(encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        missing = [c for c in REQUIRED if c not in (reader.fieldnames or [])]
        if missing:
            return [f"header: missing column(s) {', '.join(missing)}"], [], {}
        rows = list(reader)

    lost_at: dict[str, datetime] = {}
    found: dict[str, list[tuple[int, datetime]]] = {}
    kinds: Counter = Counter()
    langs: Counter = Counter()
    groups: Counter = Counter()
    texts: Counter = Counter()
    for n, row in enumerate(rows, start=2):  # line 1 is the header
        where = f"line {n} ({(row.get('object_id') or '?').strip()})"
        if (row.get("pair_ok") or "").strip().lower() == "no":
            continue
        text = (row.get("text") or "").strip()
        if not text:
            warnings.append(f"{where}: empty text, row will be skipped")
            continue
        kind = (row.get("kind") or "").strip().lower()
        if kind not in ("lost", "found"):
            errors.append(f"{where}: kind must be lost or found, got {row.get('kind')!r}")
            continue
        obj = (row.get("object_id") or "").strip()
        if not obj:
            errors.append(f"{where}: empty object_id")
            continue
        try:
            when = datetime.fromisoformat(f"{(row.get('date') or '').strip()}T{(row.get('time') or '').strip() or '12:00'}")
        except ValueError:
            errors.append(f"{where}: date/time must be YYYY-MM-DD and HH:MM, got {row.get('date')!r} {row.get('time')!r}")
            continue
        if kind == "lost" and (row.get("window_hours") or "").strip():
            try:
                float(row["window_hours"])
            except ValueError:
                errors.append(f"{where}: window_hours must be a number, got {row['window_hours']!r}")
        for place in _split(row.get("places")):
            if place in vocab.legacy_places:
                warnings.append(f"{where}: place {place!r} is a legacy id (now {vocab.legacy_places[place]!r})")
            elif place not in vocab.places:
                errors.append(f"{where}: unknown place {place!r} (see matcher/data/locations.yaml)")
        for color in _split(row.get("colors")):
            if color not in vocab.colors:
                errors.append(f"{where}: unknown colour {color!r}")
        category = (row.get("category") or "").strip()
        if category and category not in vocab.categories:
            errors.append(f"{where}: unknown category {category!r} (see matcher/data/taxonomy.yaml)")
        lang = (row.get("lang") or "").strip().lower()
        if lang and lang not in LANGS:
            errors.append(f"{where}: lang must be one of {', '.join(sorted(LANGS))}, got {lang!r}")
        dist = (row.get("distinguishable") or "").strip().lower()
        if dist and dist not in ("yes", "no"):
            errors.append(f"{where}: distinguishable must be yes or no, got {dist!r}")
        for pattern, why in PII:
            if pattern.search(text) or pattern.search(row.get("private_detail") or ""):
                warnings.append(f"{where}: text {why}, check it before committing")
        texts[text] += 1

        kinds[kind] += 1
        if kind == "lost":
            if obj in lost_at:
                errors.append(f"{where}: second lost report for {obj} (one per object)")
            lost_at[obj] = when
            langs[lang or "unlabelled"] += 1
            if (row.get("group") or "").strip():
                groups[row["group"].strip().upper()] += 1
        else:
            found.setdefault(obj, []).append((n, when))

    for obj, entries in found.items():
        if obj not in lost_at:
            continue  # a found report with no owner is a distractor, which is fine
        for n, when in entries:
            if when < lost_at[obj] - GATE:
                errors.append(f"line {n} ({obj}): found more than 24 h before the owner lost it; the matcher "
                              "would never show it")
    for text, count in texts.items():
        if count > 1:
            warnings.append(f"same text appears {count} times: {text[:50]!r}")

    owner_only = sorted(o for o in lost_at if o not in found)
    summary = {
        "lost": kinds["lost"], "found": kinds["found"], "objects": len(set(lost_at) | set(found)),
        "matched_objects": len([o for o in lost_at if o in found]), "owner_only": len(owner_only),
        "distractors": len([o for o in found if o not in lost_at]),
        "finders_per_object": dict(sorted(Counter(len(v) for o, v in found.items() if o in lost_at).items())),
        "languages": dict(langs), "look_alike_groups": dict(sorted(groups.items())),
    }
    return errors, warnings, summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("path", nargs="?", type=Path, default=REAL_CSV)
    args = parser.parse_args()
    if not args.path.exists():
        sys.exit(f"{args.path} not found")
    errors, warnings, summary = check(args.path)
    for e in errors:
        print(f"ERROR   {e}")
    for w in warnings:
        print(f"warning {w}")
    if summary:
        print("\n" + "\n".join(f"{k:20s} {v}" for k, v in summary.items()))
    print(f"\n{len(errors)} error(s), {len(warnings)} warning(s)")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()

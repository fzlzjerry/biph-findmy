"""Turn the Owner / Finder questionnaire exports into matcher/data/real_pairs.csv.

    uv run python scripts/form_to_csv.py --owner owner.csv --finder finder.csv
    uv run python scripts/form_to_csv.py --owner owner.csv --finder finder.csv --out other.csv --force

Works with CSV exports from Tencent Questionnaire, Jinshuju or a typed-up paper sheet. Columns are
found by the words in each question (English or Chinese, as written in the evaluation plan), so
question numbering and extra columns (submit time, consent) do not matter. Choice answers may be
either the stored ID (`water_bottle`) or the shown label (`Water bottle 水杯`). The result is then
checked with `python -m matcher.eval.check_real`.
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from matcher.eval.check_real import check
from matcher.eval.datasets import REAL_CSV
from matcher.vocab import load_vocab

COLUMNS = ["object_id", "kind", "text", "date", "time", "window_hours", "places", "colors", "category",
           "private_detail", "writer", "lang", "group", "distinguishable", "pair_ok"]
# field → words that identify its question; checked in this order, each export column used once
QUESTIONS = [
    ("text", ["write the post", "describe it", "帖子", "描述一下"]),
    ("private_detail", ["only the owner", "只有失主"]),
    ("window_hours", ["how long", "多久"]),
    ("when", ["when did you", "什么时候"]),
    ("object_id", ["sticker", "贴纸"]),
    ("writer", ["member code", "成员编号"]),
    ("places", ["where", "哪里"]),
    ("colors", ["colour", "color", "颜色"]),
    ("category", ["what kind", "类型"]),
]
WINDOWS = [(("under 1", "1 小时内", "1小时内"), "1"), (("2 to 3", "2-3", "2–3", "两三"), "3"),
           (("half a day", "半天"), "6"), (("not sure", "不确定"), "12")]
SEPARATORS = re.compile(r"[┋|;,，、；\n]+")


def find_columns(header: list[str]) -> dict[str, str]:
    found: dict[str, str] = {}
    for field, words in QUESTIONS:
        for col in header:
            if col not in found.values() and any(w in col.lower() for w in words):
                found[field] = col
                break
    return found


def label_index(items: dict) -> dict[str, str]:
    """Lower-cased id, English label and Chinese label → id."""
    out = {}
    for ident, item in items.items():
        label = item.label if hasattr(item, "label") else item.get("label", {})
        out[ident.lower()] = ident
        for text in (label or {}).values():
            out[str(text).lower()] = ident
    return out


def to_ids(value: str, index: dict[str, str], multi: bool) -> str:
    """Map an answer (ids or 'English 中文' labels, one or several) to ;-joined ids; unknown text is kept
    as-is so the checker reports it."""
    value = (value or "").strip()
    parts = SEPARATORS.split(value) if multi else [value]
    ids = []
    for part in (p.strip() for p in parts if p.strip()):
        key = part.lower()
        if "not sure" in key or "不确定" in key:
            continue
        # exact id or label first, else the longest label inside the answer ("headphones" must not become "phone")
        hits = [k for k in index if k and k in key]
        ident = index.get(key) or (index[max(hits, key=len)] if hits else None)
        ids.append(ident or part)
    return ";".join(dict.fromkeys(ids))


def split_when(value: str) -> tuple[str, str]:
    m = re.search(r"(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?(?:[ T]+(\d{1,2}):(\d{2}))?", value or "")
    if not m:
        return (value or "").strip(), ""
    y, mo, d, hh, mm = m.groups()
    return f"{y}-{int(mo):02d}-{int(d):02d}", (f"{int(hh):02d}:{mm}" if hh else "")


def window(value: str) -> str:
    v = (value or "").strip().lower()
    if re.fullmatch(r"\d+(\.\d+)?", v):
        return v
    return next((hours for keys, hours in WINDOWS if any(k in v for k in keys)), v)


def convert(path: Path, kind: str) -> list[dict[str, str]]:
    vocab = load_vocab()
    places, colors, cats = label_index(vocab.places), label_index(vocab.colors), label_index(vocab.categories)
    with path.open(encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        cols = find_columns(reader.fieldnames or [])
        for need in ("text", "when", "object_id"):
            if need not in cols:
                sys.exit(f"{path}: could not find the {need} question in the header {reader.fieldnames}")
        rows = []
        for raw in reader:
            def get(f: str, raw: dict = raw) -> str:
                return (raw.get(cols[f]) or "").strip() if f in cols else ""

            if not get("text"):
                continue
            day, time = split_when(get("when"))
            rows.append({
                "object_id": get("object_id").upper(), "kind": kind, "text": get("text"), "date": day, "time": time,
                "window_hours": window(get("window_hours")) if kind == "lost" else "",
                "places": to_ids(get("places"), places, multi=True),
                "colors": to_ids(get("colors"), colors, multi=True),
                "category": to_ids(get("category"), cats, multi=False),
                "private_detail": get("private_detail") if kind == "found" else "",
                "writer": get("writer").upper(),
            })
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--owner", type=Path, required=True, help="Owner form export (lost reports)")
    parser.add_argument("--finder", type=Path, required=True, help="Finder form export (found reports)")
    parser.add_argument("--out", type=Path, default=REAL_CSV)
    parser.add_argument("--force", action="store_true", help="overwrite --out if it exists")
    args = parser.parse_args()
    if args.out.exists() and not args.force:
        sys.exit(f"{args.out} exists; pass --force to overwrite it")
    rows = convert(args.owner, "lost") + convert(args.finder, "found")
    rows.sort(key=lambda r: (r["object_id"], r["kind"] != "lost"))
    with args.out.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows({c: r.get(c, "") for c in COLUMNS} for r in rows)
    print(f"wrote {len(rows)} rows to {args.out}\n")
    errors, warnings, summary = check(args.out)
    for e in errors:
        print(f"ERROR   {e}")
    for w in warnings:
        print(f"warning {w}")
    print("\n" + "\n".join(f"{k:20s} {v}" for k, v in summary.items()))
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()

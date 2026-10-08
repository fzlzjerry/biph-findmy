"""Command-line playground for the matcher.

    python -m matcher analyze "黑色保温杯 贴了恐龙贴纸"
    python -m matcher match --lost "black bottle with a dinosaur sticker" \
        --found "黑色保温杯 贴了恐龙贴纸" --found "黑色水杯"
    python -m matcher demo          # the six-black-bottles scenario
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta, timezone

from .api import ItemInput, Matcher


def _print_results(matcher: Matcher, lost: ItemInput, found: list[ItemInput]) -> None:
    texts = {f.id: f.description for f in found}
    results = matcher.rank(lost, found, top_k=None, min_band="weak")
    print(f"\nmodel: {matcher.model_version}\nlost:  {lost.description}\n")
    for r in results:
        print(f"  {r.probability:6.1%}  [{r.band:8s}]  {texts[r.candidate_id]}")
        for reason in r.reasons[:4]:
            print(f"           {reason['contribution']:+.2f}  {reason['en']}  ·  {reason['zh']}")
    gated = set(texts) - {r.candidate_id for r in results}
    for fid in gated:
        print(f"       —  [excluded]  {texts[fid]}  (found before it was lost)")


def demo(matcher: Matcher) -> None:
    now = datetime.now(timezone.utc).replace(microsecond=0)
    lost = ItemInput("lost", "lost", "黑色保温杯 贴了恐龙贴纸，体育课后在体育馆丢的",
                     now - timedelta(days=2), now - timedelta(days=2, hours=-2), locations=["gym"])
    found = [
        ItemInput("f1", "found", "black thermos bottle with a dinosaur sticker, gym bleachers", now - timedelta(days=1), locations=["gym"]),
        ItemInput("f2", "found", "black Hydro Flask, dented near the bottom", now - timedelta(days=1), locations=["gym"]),
        ItemInput("f3", "found", "black water bottle, K.L. written on the lid", now - timedelta(days=1), locations=["cafeteria"]),
        ItemInput("f4", "found", "Black Stanley tumbler with a handle", now - timedelta(hours=30), locations=["field_track"]),
        ItemInput("f5", "found", "黑色水杯", now - timedelta(days=1), locations=["gym"]),
        ItemInput("f6", "found", "a black bottle", now - timedelta(days=1), locations=["library"]),
        ItemInput("f7", "found", "black bottle with dinosaur sticker", now - timedelta(days=9), locations=["gym"]),
    ]
    _print_results(matcher, lost, found)


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m matcher")
    sub = parser.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("analyze")
    a.add_argument("text")
    m = sub.add_parser("match")
    m.add_argument("--lost", required=True)
    m.add_argument("--found", action="append", required=True)
    sub.add_parser("demo")
    parser.add_argument("--backend", choices=["auto", "onnx", "tfidf"], default="auto")
    args = parser.parse_args()
    matcher = Matcher(backend=args.backend)
    if args.cmd == "analyze":
        print(json.dumps(matcher.analyze(args.text), ensure_ascii=False, indent=2))
    elif args.cmd == "match":
        now = datetime.now(timezone.utc)
        lost = ItemInput("lost", "lost", args.lost, now - timedelta(days=1))
        found = [ItemInput(f"f{i}", "found", t, now) for i, t in enumerate(args.found)]
        _print_results(matcher, lost, found)
    else:
        demo(matcher)


if __name__ == "__main__":
    main()

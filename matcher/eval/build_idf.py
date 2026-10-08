"""Builds data/idf.json from an unlabelled background corpus of generated descriptions.

    python -m matcher.eval.build_idf
"""

from __future__ import annotations

import json

from ..extract import extract
from ..textsim import build_idf
from ..vocab import DATA_DIR, load_vocab
from .generate import background_corpus


def main() -> None:
    vocab = load_vocab()
    reports = background_corpus()
    docs, canon = [], []
    for r in reports:
        ex = extract(r.text, vocab)
        docs.append(ex.text)
        canon.append(ex.canon)
    data = build_idf(docs, canon, vocab.stopwords_en)
    path = DATA_DIR / "idf.json"
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {path} — {data['N']} docs, {len(data['tokens'])} tokens, {len(data['canon'])} canonical marks")


if __name__ == "__main__":
    main()

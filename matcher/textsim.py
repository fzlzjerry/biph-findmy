"""TF-IDF text similarity — the no-model baseline and the offline fallback.

Tokens are language-aware so one vector space works for Chinese, English and mixed text:
  * Chinese runs → single characters and character bigrams ("保温杯" → 保, 温, 杯, 保温, 温杯)
  * English words → the word itself plus character trigrams, which tolerate typos
    ("botle" still shares <bo, bot, otl… with "bottle").
IDF weights come from a fixed background corpus (data/idf.json) so a brand-new site with
three items still knows that "sticker" is more informative than "black".
"""

from __future__ import annotations

import json
import math
import re
from collections import Counter
from functools import lru_cache
from pathlib import Path

from .vocab import DATA_DIR

_SEG = re.compile(r"[㐀-䶿一-鿿豈-﫿]+|[a-z0-9]+(?:['\-][a-z0-9]+)*")
_IS_CJK = re.compile(r"[㐀-䶿一-鿿豈-﫿]")


def text_tokens(norm_text: str, stop_en: frozenset[str] = frozenset()) -> list[str]:
    tokens: list[str] = []
    for m in _SEG.finditer(norm_text):
        seg = m.group()
        if _IS_CJK.match(seg):
            tokens += ["z:" + ch for ch in seg]
            tokens += ["z:" + seg[i : i + 2] for i in range(len(seg) - 1)]
            continue
        word = seg.replace("'", "")
        if len(word) < 2 or word in stop_en:
            continue
        tokens.append("w:" + word)
        if len(word) >= 4:
            padded = f"<{word}>"
            tokens += ["c:" + padded[i : i + 3] for i in range(len(padded) - 2)]
    return tokens


SparseVec = dict[str, float]


class Tfidf:
    def __init__(self, idf: dict[str, float], default_idf: float, canon_idf: dict[str, float] | None = None,
                 canon_default: float = 1.0):
        self.idf = idf
        self.default_idf = default_idf
        self.canon_idf = canon_idf or {}
        self.canon_default = canon_default

    @classmethod
    def load(cls, path: Path | None = None) -> "Tfidf":
        path = path or DATA_DIR / "idf.json"
        if not path.exists():
            return cls({}, 1.0)
        data = json.loads(path.read_text(encoding="utf-8"))
        return cls(data["tokens"], data["default"], data.get("canon", {}), data.get("canon_default", 1.0))

    def vector(self, tokens: list[str]) -> SparseVec:
        counts = Counter(tokens)
        vec = {t: (1.0 + math.log(c)) * self.idf.get(t, self.default_idf) for t, c in counts.items()}
        norm = math.sqrt(sum(v * v for v in vec.values()))
        return {t: v / norm for t, v in vec.items()} if norm else {}

    def canon_weight(self, token: str) -> float:
        return self.canon_idf.get(token, self.canon_default)

    @staticmethod
    def cosine(a: SparseVec, b: SparseVec) -> float:
        if not a or not b:
            return 0.0
        if len(a) > len(b):
            a, b = b, a
        return sum(v * b.get(t, 0.0) for t, v in a.items())


@lru_cache(maxsize=1)
def default_tfidf() -> Tfidf:
    return Tfidf.load()


def build_idf(documents: list[str], canon_docs: list[set[str]], stop_en: frozenset[str]) -> dict:
    """Smoothed IDF (same formula as scikit-learn): log((1 + N) / (1 + df)) + 1."""
    n = len(documents)
    df: Counter[str] = Counter()
    for doc in documents:
        df.update(set(text_tokens(doc, stop_en)))
    cdf: Counter[str] = Counter()
    for toks in canon_docs:
        cdf.update(toks)
    idf = {t: round(math.log((1 + n) / (1 + c)) + 1, 4) for t, c in df.items() if c >= 2}
    canon = {t: round(math.log((1 + n) / (1 + c)) + 1, 4) for t, c in cdf.items()}
    return {
        "N": n,
        "default": round(math.log((1 + n) / 1) + 1, 4),
        "tokens": dict(sorted(idf.items())),
        "canon": dict(sorted(canon.items())),
        "canon_default": round(math.log((1 + n) / 1) + 1, 4),
    }

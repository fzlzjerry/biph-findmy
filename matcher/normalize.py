"""Text normalisation shared by extraction, TF-IDF and the evaluation tools.

Every description goes through the same steps so that "黑色保溫杯", "黑色保温杯" and
"ＢＬＡＣＫ bottle" all end up comparable:

1. NFKC — folds full-width characters (Ｂ → B, ２ → 2) and compatibility forms.
2. Traditional → Simplified Chinese (OpenCC), because students from Hong Kong / Taiwan
   often type Traditional characters.
3. Lower-case and collapse whitespace.
"""

from __future__ import annotations

import re
import unicodedata
from functools import lru_cache

_WS = re.compile(r"\s+")
_CJK = re.compile(r"[㐀-䶿一-鿿豈-﫿]")
_LATIN = re.compile(r"[a-zA-Z]")


@lru_cache(maxsize=1)
def _t2s():
    try:
        import opencc

        return opencc.OpenCC("t2s")
    except Exception:  # pragma: no cover - opencc is a hard dependency, but stay usable without it
        return None


def to_simplified(text: str) -> str:
    converter = _t2s()
    return converter.convert(text) if converter and _CJK.search(text) else text


def normalize(text: str | None) -> str:
    """Return the canonical form used for matching (lower-case, Simplified, NFKC)."""
    text = unicodedata.normalize("NFKC", text or "")
    text = to_simplified(text)
    text = text.lower().replace("’", "'").replace("‘", "'")
    return _WS.sub(" ", text).strip()


def has_cjk(text: str) -> bool:
    return bool(_CJK.search(text))


def detect_language(text: str) -> str:
    """Rough language label for analytics: 'zh', 'en' or 'mixed'."""
    cjk = len(_CJK.findall(text))
    latin = len(_LATIN.findall(text))
    if cjk and latin >= 3:
        return "mixed"
    if cjk:
        return "zh"
    return "en"

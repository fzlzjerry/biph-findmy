"""Rule-based attribute extraction: category, colours, brand, places, marks, codes.

Approach (explainable on a poster):
  * All dictionary phrases compete for the text, **longest phrase first** — so "pencil case"
    beats "pencil", "钥匙扣" (keychain) beats "钥匙" (keys) and "蓝牙耳机" beats the colour "蓝".
  * Brands are matched separately because "AirPods" is both a category and a brand.
  * "Codes" are exact identifiers — initials like "K.L.", model numbers like "TI-84",
    quoted text — which are the strongest evidence that two reports describe the same object.
  * The *residual* is what is left after removing category/colour/brand/place words and
    filler words: it carries the distinctive details ("dinosaur sticker, dent on the lid").
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

from .normalize import detect_language, normalize
from .vocab import Vocab, load_vocab


@dataclass(frozen=True)
class Span:
    kind: str
    id: str
    start: int
    end: int
    text: str
    weak: bool = False


@dataclass
class Extraction:
    text: str
    category: str | None = None
    category_conf: float = 0.0
    category_candidates: list[tuple[str, float]] = field(default_factory=list)
    colors: list[str] = field(default_factory=list)
    brands: list[str] = field(default_factory=list)
    places: list[str] = field(default_factory=list)
    marks: list[str] = field(default_factory=list)
    motifs: list[str] = field(default_factory=list)
    codes: list[str] = field(default_factory=list)
    residual: str = ""
    spans: list[Span] = field(default_factory=list)
    language: str = "en"

    @property
    def canon(self) -> set[str]:
        """Language-independent tokens for distinguishing marks ("mark:sticker", "motif:dinosaur")."""
        return {f"mark:{m}" for m in self.marks} | {f"motif:{m}" for m in self.motifs}

    def span_text(self, kind: str, ident: str) -> str | None:
        for span in self.spans:
            if span.kind == kind and span.id == ident:
                return span.text
        return None


_CJK_RUN = re.compile(r"[㐀-䶿一-鿿豈-﫿]+")
_LATIN_WORD = re.compile(r"[a-z0-9]+(?:['\-][a-z0-9]+)*")

_INITIALS_DOTTED = re.compile(r"(?<![A-Za-z])((?:[A-Z]\s?\.\s?){2,3})")
_INITIALS_BARE = re.compile(r"(?<![A-Za-z0-9])([A-Z]{2,3})(?![A-Za-z0-9])")
_MODEL = re.compile(r"(?<![a-z0-9])([a-z]{1,6})-?(\d{2,4})([a-z]{0,3})(?![a-z0-9])")
_QUOTED = re.compile(r"[\"“”「『]([^\"“”「」『』]{2,24})[\"“”」』]|'([^']{2,24})'")
_ZH_NAME = re.compile(r"(?:写着|写了|名字是|名字叫|签名是|刻着|刻了)[:：\s]*([一-鿿]{2,3}|[a-z][a-z\.]{1,15})")

ACRONYM_STOP = {
    "ID", "PE", "TI", "USB", "BIPH", "IB", "AP", "OK", "TV", "PC", "UK", "US", "USA", "LED", "NBA",
    "PS", "MP", "GB", "TB", "ML", "CM", "MM", "HK", "CN", "IT", "AM", "PM", "DS", "CEO", "AI", "TNF",
    "PRO", "MAX", "SE", "XL", "XS", "XXL", "UA", "BBQ", "ASAP", "PLS", "THX", "LOL", "OMG", "NO",
    "MAC", "IOS", "DIY", "GPS", "MIT", "NYC", "BTW", "IDK",
}
MODEL_PREFIX_STOP = {"grade", "room", "gate", "floor", "bus", "class", "year", "y", "g", "f", "no",
                     "page", "pg", "ch", "unit", "level", "lvl", "block", "bldg", "door", "seat",
                     "gen", "size", "ios", "v", "p"}
MODEL_SUFFIX_STOP = {"ml", "l", "gb", "tb", "mb", "cm", "mm", "kg", "g", "mah", "w", "v", "hz",
                     "pm", "am", "th", "st", "nd", "rd", "oz"}


def _codes(raw: str, norm: str) -> list[str]:
    nfkc = unicodedata.normalize("NFKC", raw or "")
    found: list[str] = []

    def add(code: str) -> None:
        code = re.sub(r"[\s\.\-]", "", code.lower())
        if len(code) >= 2 and code not in found:
            found.append(code)

    for m in _INITIALS_DOTTED.finditer(nfkc):
        add(m.group(1))
    for m in _INITIALS_BARE.finditer(nfkc):
        if m.group(1) not in ACRONYM_STOP:
            add(m.group(1))
    for m in _MODEL.finditer(norm):
        prefix, digits, suffix = m.groups()
        if prefix in MODEL_PREFIX_STOP or suffix in MODEL_SUFFIX_STOP:
            continue
        add(prefix + digits + suffix)
    for m in _QUOTED.finditer(norm):
        add(m.group(1) or m.group(2))
    for m in _ZH_NAME.finditer(norm):
        add(m.group(1))
    return found


def _residual(norm: str, removed: list[tuple[int, int]], vocab: Vocab) -> str:
    chars = list(norm)
    for start, end in removed:
        for i in range(start, end):
            chars[i] = " "
    rest = "".join(chars)
    parts: list[str] = []
    for m in re.finditer(r"[㐀-䶿一-鿿豈-﫿]+|[a-z0-9]+(?:['\-][a-z0-9]+)*", rest):
        seg = m.group()
        if _CJK_RUN.fullmatch(seg):
            for stop in vocab.stopwords_zh:
                seg = seg.replace(stop, " ")
            parts += [p for p in seg.split() if p]
        elif seg not in vocab.stopwords_en and len(seg) > 1:
            parts.append(seg)
    return " ".join(parts)


def extract(raw: str, vocab: Vocab | None = None) -> Extraction:
    vocab = vocab or load_vocab()
    norm = normalize(raw)
    occupied = bytearray(len(norm))
    spans: list[Span] = []

    for phrase in vocab.span_phrases:
        if phrase.text not in norm:
            continue
        for m in phrase.pattern.finditer(norm):
            start, end = m.span()
            if any(occupied[start:end]):
                continue
            occupied[start:end] = b"\x01" * (end - start)
            spans.append(Span(phrase.kind, phrase.id, start, end, m.group(), phrase.weak))

    brand_spans: list[Span] = []
    for phrase in vocab.brand_phrases:
        if phrase.text in norm:
            for m in phrase.pattern.finditer(norm):
                brand_spans.append(Span("brand", phrase.id, m.start(), m.end(), m.group()))

    spans.sort(key=lambda s: s.start)
    ex = Extraction(text=norm, spans=spans + sorted(brand_spans, key=lambda s: s.start))
    ex.language = detect_language(norm)

    # Category: strong mentions beat weak ones; earlier mentions win ties ("my backpack with a laptop").
    scores: dict[str, float] = {}
    strong: set[str] = set()
    for rank, span in enumerate(s for s in spans if s.kind == "category"):
        weight = (0.4 if span.weak else 1.0) * (1.0 if span.id not in scores else 0.5) * (1.0 - 0.05 * rank)
        scores[span.id] = scores.get(span.id, 0.0) + weight
        if not span.weak:
            strong.add(span.id)
    if scores:
        ranked = sorted(scores.items(), key=lambda kv: -kv[1])
        ex.category_candidates = [(k, round(v, 3)) for k, v in ranked]
        ex.category = ranked[0][0]
        if ex.category in strong:
            ex.category_conf = 0.9 if len(strong) == 1 else 0.65
        else:
            ex.category_conf = 0.5

    def unique(kind: str, source: list[Span]) -> list[str]:
        out: list[str] = []
        for span in source:
            if span.kind == kind and span.id not in out:
                out.append(span.id)
        return out

    ex.colors = unique("color", spans)[:3]
    ex.places = unique("location", spans)
    ex.marks = unique("mark", spans)
    ex.motifs = unique("motif", spans)
    ex.brands = unique("brand", sorted(brand_spans, key=lambda s: s.start))
    ex.codes = _codes(raw, norm)

    removed = [(s.start, s.end) for s in spans if s.kind in {"category", "color", "location", "stop"}]
    removed += [(s.start, s.end) for s in brand_spans]
    ex.residual = _residual(norm, removed, vocab)
    return ex

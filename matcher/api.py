"""Public interface between the Data Science Club's matcher and the Coding Club's platform.

The backend only ever calls:
    matcher.analyze(text)                 → attributes for the live "chips" on the report form
    matcher.embed(item)                   → vectors to store with a new report
    matcher.rank(query, candidates)       → ranked MatchResults with probability, band, reasons
"""

from __future__ import annotations

import hashlib
import os
from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

import numpy as np

from .embed import load_embedder
from .extract import Extraction, extract
from .explain import build_reasons
from .features import Prepared, pair_features
from .scoring import WeightSet, load_weights, sigmoid
from .textsim import Tfidf, default_tfidf, text_tokens
from .vocab import Vocab, load_vocab


@dataclass
class ItemInput:
    id: str
    kind: str  # "lost" | "found"
    description: str
    time_from: datetime
    time_to: datetime | None = None
    title: str = ""
    marks_text: str = ""
    private_detail: str = ""
    category: str | None = None        # confirmed by the user (overrides extraction)
    colors: list[str] | None = None    # confirmed by the user
    brand: str | None = None
    locations: list[str] = field(default_factory=list)
    emb_text: np.ndarray | None = None
    emb_detail: np.ndarray | None = None

    @property
    def public_text(self) -> str:
        return " ".join(p for p in (self.title, self.description, self.marks_text) if p)

    def fingerprint(self) -> str:
        key = "|".join([self.id, self.kind, self.public_text, self.private_detail, str(self.category),
                        ",".join(self.colors or []), str(self.brand), ",".join(self.locations),
                        self.time_from.isoformat(), self.time_to.isoformat() if self.time_to else ""])
        return hashlib.sha1(key.encode()).hexdigest()


@dataclass
class MatchResult:
    candidate_id: str
    probability: float
    logit: float
    band: str
    features: dict[str, float]
    contributions: dict[str, float]
    reasons: list[dict]

    def to_json(self) -> dict:
        return {"candidate_id": self.candidate_id, "probability": round(self.probability, 4),
                "logit": round(self.logit, 3), "band": self.band,
                "features": {k: round(v, 3) for k, v in self.features.items()},
                "contributions": {k: round(v, 3) for k, v in self.contributions.items()},
                "reasons": self.reasons}


class Matcher:
    def __init__(self, backend: str | None = None, weights: WeightSet | None = None,
                 weights_path: Path | None = None, vocab: Vocab | None = None, tfidf: Tfidf | None = None):
        backend = backend or os.environ.get("MATCHER_TEXT_BACKEND", "auto")
        self.vocab = vocab or load_vocab()
        self.tfidf = tfidf or default_tfidf()
        self.embedder = load_embedder() if backend in ("auto", "onnx") else None
        if backend == "onnx" and self.embedder is None:
            raise RuntimeError("ONNX backend requested but the model is not available")
        self.backend = "onnx" if self.embedder is not None else "tfidf"
        self.weights = weights or load_weights(self.backend, weights_path)
        self._cache: OrderedDict[str, Prepared] = OrderedDict()

    @property
    def model_version(self) -> str:
        return f"{self.backend}/{self.weights.version}"

    # ---------------------------------------------------------------- analysis
    def analyze(self, text: str, marks_text: str = "") -> dict:
        ex = extract(" ".join(p for p in (text, marks_text) if p), self.vocab)
        v = self.vocab

        def span(kind: str, ident: str) -> str | None:
            return ex.span_text(kind, ident)

        category = None
        if ex.category:
            cat = v.categories[ex.category]
            category = {"id": cat.id, "parent": cat.parent, "label": cat.label,
                        "confidence": ex.category_conf, "span": span("category", cat.id),
                        "sensitive": cat.sensitive}
        return {
            "category": category,
            "category_candidates": [{"id": cid, "score": s, "label": v.categories[cid].label}
                                    for cid, s in ex.category_candidates[:4]],
            "colors": [{"id": c, "label": v.colors[c]["label"], "hex": v.colors[c]["hex"],
                        "span": span("color", c)} for c in ex.colors],
            "brands": [{"id": b, "label": v.brands[b], "span": span("brand", b)} for b in ex.brands],
            "places": [{"id": p, "zone": v.places[p].zone, "label": v.places[p].label,
                        "span": span("location", p)} for p in ex.places],
            "marks": [{"id": m, "label": v.marks[m], "span": span("mark", m)} for m in ex.marks],
            "motifs": [{"id": m, "label": v.motifs[m], "span": span("motif", m)} for m in ex.motifs],
            "codes": ex.codes,
            "language": ex.language,
            "sensitive": bool(category and category["sensitive"]),
        }

    # ---------------------------------------------------------------- embeddings
    def _detail_text(self, ex: Extraction, ex_private: Extraction | None) -> str:
        return " ".join(p for p in (ex.residual, ex_private.residual if ex_private else "") if p)

    def embed(self, item: ItemInput) -> tuple[np.ndarray | None, np.ndarray | None]:
        """Vectors to store with a report (None, None when running TF-IDF only)."""
        if self.embedder is None:
            return None, None
        ex = extract(item.public_text, self.vocab)
        ex_private = extract(item.private_detail, self.vocab) if item.private_detail else None
        detail = self._detail_text(ex, ex_private)
        texts = [ex.text or " "] + ([detail] if detail else [])
        vecs = self.embedder.encode(texts)
        return vecs[0], (vecs[1] if detail else None)

    def embed_many(self, items: list[ItemInput], batch_size: int = 64) -> None:
        """Batch-compute embeddings in place (much faster than one item at a time)."""
        if self.embedder is None:
            return
        todo = [it for it in items if it.emb_text is None]
        texts, details = [], []
        for it in todo:
            ex = extract(it.public_text, self.vocab)
            ex_private = extract(it.private_detail, self.vocab) if it.private_detail else None
            texts.append(ex.text or " ")
            details.append(self._detail_text(ex, ex_private))
        if not todo:
            return
        text_vecs = self.embedder.encode(texts, batch_size)
        detail_idx = [i for i, d in enumerate(details) if d]
        detail_vecs = self.embedder.encode([details[i] for i in detail_idx], batch_size) if detail_idx else []
        for i, it in enumerate(todo):
            it.emb_text = text_vecs[i]
        for row, i in enumerate(detail_idx):
            todo[i].emb_detail = detail_vecs[row]

    # ---------------------------------------------------------------- preparation
    def prepare(self, item: ItemInput) -> Prepared:
        key = item.fingerprint()
        cached = self._cache.get(key)
        if cached is not None:
            self._cache.move_to_end(key)
            if item.emb_text is not None:
                cached.emb_text, cached.emb_detail = item.emb_text, item.emb_detail
            return cached

        v = self.vocab
        ex = extract(item.public_text, v)
        ex_private = extract(item.private_detail, v) if item.private_detail else None
        detail_text = self._detail_text(ex, ex_private)

        if item.category and item.category in v.categories:
            category, category_conf = item.category, 1.0
        else:
            category, category_conf = ex.category, ex.category_conf
        if item.colors:
            colors, color_conf = [c for c in item.colors if c in v.colors], 1.0
        else:
            colors, color_conf = ex.colors, 0.8
        brands = {item.brand} if item.brand else set(ex.brands)
        if item.locations:
            places, place_conf = list(dict.fromkeys(v.canon_place(p) for p in item.locations)), 1.0
        else:
            places, place_conf = ex.places, 0.7

        canon_public = ex.canon
        codes_public = set(ex.codes)
        stop = v.stopwords_en
        emb_text, emb_detail = item.emb_text, item.emb_detail
        if self.embedder is not None and emb_text is None:
            emb_text, emb_detail = self.embed(item)

        prepared = Prepared(
            id=item.id, kind=item.kind, time_from=item.time_from, time_to=item.time_to, ex=ex,
            category=category, category_conf=category_conf, colors=colors, color_conf=color_conf,
            brands=brands, places=places, place_conf=place_conf,
            canon_public=canon_public,
            canon_all=canon_public | (ex_private.canon if ex_private else set()),
            codes_public=codes_public,
            codes_all=codes_public | (set(ex_private.codes) if ex_private else set()),
            tf_text=self.tfidf.vector(text_tokens(ex.text, stop)),
            tf_detail=self.tfidf.vector(text_tokens(detail_text, stop)) if detail_text else {},
            emb_text=emb_text, emb_detail=emb_detail,
            sensitive=bool(category and v.categories[category].sensitive),
        )
        self._cache[key] = prepared
        if len(self._cache) > 4000:
            self._cache.popitem(last=False)
        return prepared

    # ---------------------------------------------------------------- scoring
    def features(self, a: Prepared, b: Prepared) -> tuple[dict[str, float], dict] | None:
        return pair_features(a, b, self.vocab, self.tfidf, self.weights.centers,
                             use_embeddings=self.embedder is not None)

    def score(self, a: Prepared, b: Prepared) -> MatchResult | None:
        result = self.features(a, b)
        if result is None:
            return None
        x, info = result
        logit = self.weights.logit(x)
        p = sigmoid(logit)
        contrib = self.weights.contributions(x)
        return MatchResult(b.id, p, logit, self.weights.band(p), x, contrib,
                           build_reasons(contrib, info, self.vocab))

    def rank(self, query: ItemInput | Prepared, candidates: list[ItemInput | Prepared],
             top_k: int | None = 10, min_band: str = "possible") -> list[MatchResult]:
        """Score `query` against candidates of the opposite kind, best first."""
        q = query if isinstance(query, Prepared) else self.prepare(query)
        order = {"weak": 0, "possible": 1, "strong": 2}
        results = []
        for cand in candidates:
            c = cand if isinstance(cand, Prepared) else self.prepare(cand)
            if c.kind == q.kind or c.id == q.id:
                continue
            res = self.score(q, c)
            if res is not None and order[res.band] >= order[min_band]:
                results.append(res)
        results.sort(key=lambda r: -r.logit)
        return results[:top_k] if top_k else results


_default: Matcher | None = None


def get_matcher() -> Matcher:
    """Process-wide matcher (loading the ONNX model takes ~1 s, so do it once)."""
    global _default
    if _default is None:
        _default = Matcher()
    return _default

"""Bridge between database rows and the Data Science Club's matcher."""

from __future__ import annotations

import uuid

import numpy as np
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from matcher import ItemInput, get_matcher
from matcher.embed import from_bytes, to_bytes
from matcher.normalize import normalize
from matcher.textsim import text_tokens

from ..models import Item, Match

MATCHABLE = ("open", "matched")
ACTIVE = ("open", "matched", "claimed")


def to_input(item: Item, use_embeddings: bool = True) -> ItemInput:
    m = get_matcher()
    emb_ok = use_embeddings and m.embedder is not None and item.emb_model == m.embedder.name
    return ItemInput(
        id=str(item.id), kind=item.kind, description=item.description, title=item.title or "",
        marks_text=item.marks_text or "",
        private_detail=item.private_detail if item.kind == "found" else "",
        time_from=item.time_from, time_to=item.time_to if item.kind == "lost" else None,
        category=item.category if item.category and item.category != "other" else None,
        colors=list(item.colors) or None, brand=item.brand,
        locations=[p for p in item.locations or [] if p != "other"],
        emb_text=from_bytes(item.emb_text) if emb_ok else None,
        emb_detail=from_bytes(item.emb_detail) if emb_ok else None,
    )


def enrich(item: Item) -> dict:
    """Run NLP analysis + embeddings for a new or edited report."""
    m = get_matcher()
    inp = to_input(item, use_embeddings=False)
    analysis = m.analyze(inp.public_text)
    item.attrs = {
        **(item.attrs or {}),
        "language": analysis["language"],
        "codes": analysis["codes"],
        "marks": [x["id"] for x in analysis["marks"]],
        "motifs": [x["id"] for x in analysis["motifs"]],
        "extracted": {
            "category": analysis["category"]["id"] if analysis["category"] else None,
            "colors": [c["id"] for c in analysis["colors"]],
            "places": [p["id"] for p in analysis["places"]],
            "brands": [b["id"] for b in analysis["brands"]],
        },
    }
    text_vec, detail_vec = m.embed(inp)
    item.emb_text, item.emb_detail = to_bytes(text_vec), to_bytes(detail_vec)
    item.emb_model = m.embedder.name if m.embedder else None
    return analysis


def refresh_matches(db: Session, item: Item, top_k: int = 20) -> list[Match]:
    """Recompute this report's candidate list and upsert Match rows (feedback is preserved)."""
    m = get_matcher()
    existing = {(row.lost_id, row.found_id): row for row in db.scalars(
        select(Match).where(or_(Match.lost_id == item.id, Match.found_id == item.id)))}
    results = []
    if item.status in MATCHABLE and not item.is_hidden:
        other = "found" if item.kind == "lost" else "lost"
        candidates = db.scalars(
            select(Item).where(Item.kind == other, Item.status.in_(MATCHABLE), Item.is_hidden.is_(False))
            .order_by(Item.created_at.desc()).limit(1000)).unique().all()
        results = m.rank(to_input(item), [to_input(c) for c in candidates], top_k=top_k, min_band="possible")
    keep = set()
    rows = []
    for r in results:
        cid = uuid.UUID(r.candidate_id)
        key = (item.id, cid) if item.kind == "lost" else (cid, item.id)
        row = existing.get(key) or Match(lost_id=key[0], found_id=key[1])
        row.probability, row.logit, row.band = r.probability, r.logit, r.band
        row.contributions = {k: round(v, 3) for k, v in r.contributions.items()}
        row.reasons = r.reasons
        row.model_version = m.model_version
        db.add(row)
        keep.add(key)
        rows.append(row)
    for key, row in existing.items():
        if key not in keep and row.feedback is None:
            db.delete(row)
    db.flush()
    return rows


def rematch_all(db: Session) -> int:
    m = get_matcher()
    items = db.scalars(select(Item).where(Item.status.in_(ACTIVE))).unique().all()
    for item in items:
        if m.embedder is not None and item.emb_model != m.embedder.name:
            enrich(item)
    db.flush()
    for item in items:
        if item.kind == "lost":
            refresh_matches(db, item)
    return len(items)


def search_scores(query: str, items: list[Item]) -> dict[uuid.UUID, float]:
    """Hybrid search: keyword hits + semantic similarity (embeddings, or TF-IDF fallback)."""
    m = get_matcher()
    q = normalize(query)
    if not q:
        return {}
    words = [w for w in q.split() if w]
    scores: dict[uuid.UUID, float] = {}
    if m.embedder is not None:
        qv = m.embedder.encode_one(q)
    else:
        qv = m.tfidf.vector(text_tokens(q, m.vocab.stopwords_en))
    for item in items:
        text = normalize(" ".join([item.title or "", item.description, item.marks_text or ""]))
        keyword = sum(1 for w in words if w in text) / len(words)
        if m.embedder is not None and item.emb_text and item.emb_model == m.embedder.name:
            semantic = float(np.dot(qv, from_bytes(item.emb_text)))
        else:
            semantic = m.tfidf.cosine(qv if isinstance(qv, dict) else {},
                                      m.tfidf.vector(text_tokens(text, m.vocab.stopwords_en)))
        scores[item.id] = 0.6 * keyword + semantic
    return scores

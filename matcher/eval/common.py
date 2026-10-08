"""Shared helpers for fitting and evaluating: feature tables, ranking metrics, logistic fit."""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from ..api import Matcher
from ..features import FEATURES, Prepared
from .generate import Report


def prepare(matcher: Matcher, reports: list[Report], structured: bool = True) -> dict[str, Prepared]:
    items = [r.to_item(structured) for r in reports]
    matcher.embed_many(items)
    return {it.id: matcher.prepare(it) for it in items}


@dataclass
class PairTable:
    """Feature rows for every time-plausible (query, candidate) pair."""

    qids: list[str]
    cids: list[str]
    X: np.ndarray
    y: np.ndarray
    n_candidates: dict[str, int]  # per query, after the time gate

    def rows_for(self, qid: str) -> np.ndarray:
        return np.array([i for i, q in enumerate(self.qids) if q == qid], dtype=int)


def pair_table(matcher: Matcher, queries: dict[str, Prepared], pool: dict[str, Prepared],
               truth: dict[str, str]) -> PairTable:
    qids, cids, rows, labels = [], [], [], []
    counts: dict[str, int] = {}
    for qid, q in queries.items():
        counts[qid] = 0
        for cid, c in pool.items():
            res = matcher.features(q, c)
            if res is None:
                continue
            x, _ = res
            qids.append(qid)
            cids.append(cid)
            rows.append([x[f] for f in FEATURES])
            labels.append(1 if truth.get(qid) == cid else 0)
            counts[qid] += 1
    return PairTable(qids, cids, np.array(rows, dtype=float).reshape(-1, len(FEATURES)),
                     np.array(labels, dtype=float), counts)


def ranks_from_scores(table: PairTable, scores: np.ndarray, truth: dict[str, str],
                      queries: list[str], rng: np.random.Generator | None = None) -> list[float | None]:
    """1-based rank of the true match per query (None = not retrievable, e.g. no true match)."""
    jitter = rng.random(len(scores)) * 1e-9 if rng is not None else np.zeros(len(scores))
    s = scores + jitter
    by_query: dict[str, list[int]] = {}
    for i, q in enumerate(table.qids):
        by_query.setdefault(q, []).append(i)
    out: list[float | None] = []
    for qid in queries:
        true = truth.get(qid)
        if true is None:
            continue
        idx = by_query.get(qid, [])
        true_rows = [i for i in idx if table.cids[i] == true]
        if not true_rows:
            out.append(None)  # gated out — counts as a miss
            continue
        t = s[true_rows[0]]
        out.append(1 + sum(1 for i in idx if s[i] > t))
    return out


def metrics(ranks: list[float | None]) -> dict[str, float]:
    n = len(ranks)
    if n == 0:
        return {"n": 0}
    def at(k: int) -> float:
        return sum(1 for r in ranks if r is not None and r <= k) / n
    mrr = sum(1.0 / r for r in ranks if r is not None) / n
    return {"n": n, "R@1": at(1), "R@3": at(3), "R@5": at(5), "MRR": mrr}


def bootstrap(ranks: list[float | None], n_boot: int = 1000, seed: int = 0) -> dict[str, tuple[float, float]]:
    rng = np.random.default_rng(seed)
    arr = np.array([r if r is not None else math.inf for r in ranks], dtype=float)
    out = {}
    for name, fn in {"R@1": lambda a: np.mean(a <= 1), "R@3": lambda a: np.mean(a <= 3),
                     "MRR": lambda a: np.mean(np.where(np.isinf(a), 0, 1 / a))}.items():
        samples = [fn(arr[rng.integers(0, len(arr), len(arr))]) for _ in range(n_boot)]
        out[name] = (float(np.percentile(samples, 2.5)), float(np.percentile(samples, 97.5)))
    return out


def fit_logistic(X: np.ndarray, y: np.ndarray, l2: float | None = None, nonneg: bool = True) -> tuple[float, np.ndarray]:
    """Logistic regression with optional non-negative weights (more evidence never lowers a score).

    The default L2 strength 1/n matches scikit-learn's C=1 on the summed log-loss.
    """
    from scipy.optimize import minimize

    n, d = X.shape
    l2 = 1.0 / n if l2 is None else l2

    def objective(params: np.ndarray) -> tuple[float, np.ndarray]:
        b, w = params[0], params[1:]
        z = b + X @ w
        p = 1 / (1 + np.exp(-z))
        loss = np.mean(np.logaddexp(0, z) - y * z) + 0.5 * l2 * np.dot(w, w)
        g = p - y
        grad = np.concatenate([[g.mean()], X.T @ g / n + l2 * w])
        return loss, grad

    bounds = [(None, None)] + [((0.0, None) if nonneg else (None, None))] * d
    init = np.zeros(d + 1)
    init[0] = math.log(max(y.mean(), 1e-6) / max(1 - y.mean(), 1e-6))
    res = minimize(objective, init, jac=True, method="L-BFGS-B", bounds=bounds)
    return float(res.x[0]), res.x[1:]


def pick_thresholds(probs: np.ndarray, y: np.ndarray, strong_precision: float = 0.85,
                    possible_recall: float = 0.9) -> dict[str, float]:
    """Choose band cut-offs on validation pairs."""
    order = np.argsort(-probs)
    p_sorted, y_sorted = probs[order], y[order]
    tp = np.cumsum(y_sorted)
    precision = tp / np.arange(1, len(y_sorted) + 1)
    strong = 0.9
    for i in range(len(p_sorted) - 1, -1, -1):
        if precision[i] >= strong_precision and tp[i] >= 3:
            strong = float(p_sorted[i])
            break
    strong = min(max(strong, 0.7), 0.95)
    positives = np.sort(probs[y == 1])
    possible = float(positives[int((1 - possible_recall) * len(positives))]) if len(positives) else 0.2
    possible = min(max(possible, 0.15), strong - 0.1)
    return {"strong": round(strong, 3), "possible": round(possible, 3)}

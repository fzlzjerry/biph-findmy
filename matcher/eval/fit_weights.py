"""Fit the scoring weights on synthetic training data and save data/weights.json.

    python -m matcher.eval.fit_weights

Trains one weight set per text backend (TF-IDF and ONNX embeddings): train split → weights,
validation split → band thresholds. The test split is never touched here.
"""

from __future__ import annotations

import json
from datetime import date

import numpy as np

from ..api import Matcher
from ..features import FEATURES
from ..scoring import MANUAL, WeightSet, sigmoid
from ..vocab import DATA_DIR
from .common import fit_logistic, pair_table, pick_thresholds, prepare
from .generate import generate

N_OBJECTS = 900
SEED = 7


def fit_backend(backend: str, data) -> WeightSet:
    matcher = Matcher(backend=backend)
    centers = dict(MANUAL["centers"][backend])
    matcher.weights.centers = centers
    train_q = prepare(matcher, data.reports("lost", "train"))
    train_p = prepare(matcher, data.reports("found", "train"))
    truth = {q.id: f.id for q in data.reports("lost") for f in data.reports("found") if q.object_id == f.object_id}

    # Centre the similarity features on what unrelated pairs look like.
    table = pair_table(matcher, train_q, train_p, truth)
    neg = table.y == 0
    for f in ("text", "detail"):
        j = FEATURES.index(f)
        col = table.X[neg, j] + centers[f]
        nonzero = col[table.X[neg, j] != 0] if f == "detail" else col
        centers[f] = float(np.median(nonzero)) if len(nonzero) else centers[f]
    matcher.weights.centers = centers
    matcher._cache.clear()
    train_q = prepare(matcher, data.reports("lost", "train"))
    train_p = prepare(matcher, data.reports("found", "train"))
    table = pair_table(matcher, train_q, train_p, truth)

    bias, w = fit_logistic(table.X, table.y)
    weights = WeightSet(backend, f"synthetic-{date.today().isoformat()}", bias,
                        {f: float(v) for f, v in zip(FEATURES, w)}, centers)

    val_q = prepare(matcher, data.reports("lost", "val"))
    val_p = prepare(matcher, data.reports("found", "val"))
    val = pair_table(matcher, val_q, val_p, truth)
    probs = np.array([sigmoid(bias + float(x @ w)) for x in val.X])
    weights.thresholds = pick_thresholds(probs, val.y)
    print(f"[{backend}] pairs train={len(table.y)} (pos {int(table.y.sum())}), val={len(val.y)}")
    print(f"[{backend}] bias={bias:.2f} " + " ".join(f"{f}={v:.2f}" for f, v in weights.weights.items()))
    print(f"[{backend}] centers={centers} thresholds={weights.thresholds}")
    return weights


def main() -> None:
    data = generate(N_OBJECTS, seed=SEED)
    out = {"version": f"synthetic-{date.today().isoformat()}",
           "trained_on": {"generator_seed": SEED, "objects": N_OBJECTS, "split": "train (60%)",
                          "thresholds_on": "val (20%)"},
           "features": FEATURES, "backends": {}}
    for backend in ("tfidf", "onnx"):
        try:
            out["backends"][backend] = fit_backend(backend, data).to_json()
        except RuntimeError as exc:
            print(f"[{backend}] skipped: {exc}")
    path = DATA_DIR / "weights.json"
    path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {path}")


if __name__ == "__main__":
    main()

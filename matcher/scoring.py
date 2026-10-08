"""Logistic scoring: probability = sigmoid(bias + Σ weightᵢ · featureᵢ).

Each weight is a log-odds contribution, so an explanation like "colour matches +1.1" is
literally how much that piece of evidence moved the score. Weights are fitted with logistic
regression (matcher/eval/fit_weights.py) and saved to data/weights.json; the hand-set values
below are the starting point and the comparison baseline in the evaluation report.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from pathlib import Path

from .features import FEATURES
from .vocab import DATA_DIR

MANUAL = {
    "bias": -4.0,
    "weights": {"text": 3.0, "detail": 2.0, "marks": 1.5, "code": 2.0, "category": 2.5,
                "color": 1.5, "brand": 1.5, "location": 1.0, "time": 1.5},
    "centers": {"onnx": {"text": 0.3, "detail": 0.25}, "tfidf": {"text": 0.05, "detail": 0.03}},
    "thresholds": {"strong": 0.8, "possible": 0.3},
}


@dataclass
class WeightSet:
    backend: str
    version: str
    bias: float
    weights: dict[str, float]
    centers: dict[str, float]
    thresholds: dict[str, float] = field(default_factory=lambda: dict(MANUAL["thresholds"]))

    def logit(self, x: dict[str, float]) -> float:
        return self.bias + sum(self.weights.get(f, 0.0) * x.get(f, 0.0) for f in FEATURES)

    def contributions(self, x: dict[str, float]) -> dict[str, float]:
        return {f: self.weights.get(f, 0.0) * x.get(f, 0.0) for f in FEATURES}

    def band(self, probability: float) -> str:
        if probability >= self.thresholds["strong"]:
            return "strong"
        if probability >= self.thresholds["possible"]:
            return "possible"
        return "weak"

    def to_json(self) -> dict:
        return {"version": self.version, "bias": round(self.bias, 4),
                "weights": {k: round(v, 4) for k, v in self.weights.items()},
                "centers": {k: round(v, 4) for k, v in self.centers.items()},
                "thresholds": self.thresholds}


def sigmoid(z: float) -> float:
    if z >= 0:
        return 1.0 / (1.0 + math.exp(-z))
    ez = math.exp(z)
    return ez / (1.0 + ez)


def manual_weights(backend: str) -> WeightSet:
    return WeightSet(backend, "manual", MANUAL["bias"], dict(MANUAL["weights"]),
                     dict(MANUAL["centers"][backend]), dict(MANUAL["thresholds"]))


def load_weights(backend: str, path: Path | None = None) -> WeightSet:
    path = path or DATA_DIR / "weights.json"
    if path.exists():
        data = json.loads(path.read_text(encoding="utf-8"))
        entry = data.get("backends", {}).get(backend)
        if entry:
            return WeightSet(backend, entry.get("version", data.get("version", "fitted")),
                             entry["bias"], entry["weights"], entry["centers"],
                             entry.get("thresholds", dict(MANUAL["thresholds"])))
    return manual_weights(backend)

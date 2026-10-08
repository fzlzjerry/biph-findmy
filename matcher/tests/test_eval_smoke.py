"""Regression guard: the fitted model must keep beating the simple baselines."""

import pytest

from matcher.eval.common import metrics, pair_table, prepare, ranks_from_scores
from matcher.eval.datasets import load_handwritten
from matcher.eval.generate import generate
from matcher.eval.run import Evaluator, methods_table


@pytest.fixture(scope="module")
def evaluator():
    data = generate(300, seed=2026)
    from matcher.eval.datasets import EvalSet

    return Evaluator(EvalSet("synthetic", data.reports("lost", "test"), data.reports("found", "test")))


def test_full_model_beats_baselines(evaluator):
    rows = methods_table(evaluator, with_onnx=False)
    full = rows["Full model — TF-IDF"]
    assert full["R@3"] >= 0.85
    assert full["R@1"] > rows["Category + colour filter"]["R@1"] + 0.1
    assert full["R@1"] > rows["Text only — TF-IDF"]["R@1"]


def test_handwritten_set_loads_and_scores():
    hw = load_handwritten()
    assert len(hw.queries) == 32 and len(hw.pool) == 42
    rows = methods_table(Evaluator(hw), with_onnx=False)
    assert rows["Full model — TF-IDF"]["R@3"] >= 0.9


def test_generator_is_deterministic():
    a, b = generate(50, seed=11), generate(50, seed=11)
    assert [r.text for r in a.lost] == [r.text for r in b.lost]

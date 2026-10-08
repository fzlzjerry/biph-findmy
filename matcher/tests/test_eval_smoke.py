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


def test_real_csv_loads_and_scores(tmp_path):
    """The format documented in docs/data-collection.md parses and ranks the true pair first."""
    from matcher.eval.common import bootstrap
    from matcher.eval.datasets import load_real

    csv_path = tmp_path / "real_pairs.csv"
    csv_path.write_text(
        "object_id,kind,text,date,time,window_hours,places,colors,category,private_detail\n"
        'A01,lost,"我的黑色保温杯不见了 上面贴了个恐龙贴纸，周二体育课之后",2026-10-20,14:30,2,gym,black,water_bottle,\n'
        'A01,found,"Black thermos, green dinosaur sticker, gym bleachers",2026-10-20,16:00,,gym,black;green,'
        "water_bottle,lid says K.L.\n"
        'A02,lost,"white airpods case with a cat sticker, lost near the lockers",2026-10-21,,4,hallway_lockers,white,earbuds,\n'
        'A02,found,"白色耳机盒 有猫咪贴纸 在走廊储物柜旁边",2026-10-21,17:00,,hallway_lockers,white,earbuds,\n'
        'A03,found,"black water bottle, no stickers, library 2F",2026-10-21,10:00,,library,black,water_bottle,\n',
        encoding="utf-8",
    )
    real = load_real(csv_path)
    assert real is not None and len(real.queries) == 2 and len(real.pool) == 3
    ev = Evaluator(real)
    assert methods_table(ev, with_onnx=False)["Full model — TF-IDF"]["R@1"] == 1.0
    ci = bootstrap(ev.model_ranks("tfidf"), n_boot=50)
    assert ci["R@1"] == (1.0, 1.0)

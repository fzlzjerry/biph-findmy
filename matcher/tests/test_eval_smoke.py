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


TWO_FINDERS = (
    "object_id,kind,text,date,time,window_hours,places,colors,category,private_detail,lang,distinguishable\n"
    'A01,lost,"我的黑色保温杯不见了 上面贴了个恐龙贴纸，周二体育课之后",2026-10-20,14:30,2,lower_gym,black,water_bottle,,zh,yes\n'
    'A01,found,"Black thermos, green dinosaur sticker, gym bleachers",2026-10-20,16:00,,lower_gym,black;green,water_bottle,,,\n'
    'A01,found,"黑色水杯 有恐龙贴纸 在体育馆看台捡到",2026-10-20,17:00,,lower_gym,black,water_bottle,,,\n'
    'A02,lost,"white airpods case with a cat sticker, lost it near the lockers",2026-10-21,,4,a_1f,white,earbuds,,en,\n'
    'A02,found,"AirPods case white, cat sticker, A building 1F",2026-10-21,15:00,,a_1f,white,earbuds,,,\n'
    'A02,found,"white earbuds case w/ cat sticker found by lockers",2026-10-21,16:00,,a_1f,white,earbuds,,,\n'
    'A03,lost,"lost my blue umbrella in the library",2026-10-21,09:00,3,library,blue,umbrella,,en,\n'
)


def test_second_finder_is_not_a_wrong_answer(tmp_path):
    """Two finders describing the same object: neither report may count against the other."""
    from matcher.eval.datasets import load_real
    from matcher.eval.run import evaluate_real

    path = tmp_path / "real_pairs.csv"
    path.write_text(TWO_FINDERS, encoding="utf-8")
    real = load_real(path)
    splits = real.finder_splits()
    assert len(splits) == 2 and all(len(s.pool) == 2 for s in splits)
    assert all(Evaluator(s).model_ranks("tfidf") == [1, 1] for s in splits)

    out = evaluate_real(real, with_onnx=False, backend="tfidf")
    assert out["queries"] == 2 and out["owner_only"] == 1 and out["finder_splits"] == 2
    assert out["methods"]["Full model — TF-IDF"]["R@1"] == 1.0
    assert out["false_alarms"]["queries"] == 1
    assert set(out["by_language"]) == {"en", "zh"}
    assert "look-alike, distinguishable" in out["by_distinguishable"]


def test_check_real_reports_problems(tmp_path):
    from matcher.eval.check_real import check

    good = tmp_path / "good.csv"
    good.write_text(TWO_FINDERS, encoding="utf-8")
    errors, _, summary = check(good)
    assert errors == []
    assert summary["matched_objects"] == 2 and summary["owner_only"] == 1
    assert summary["finders_per_object"] == {2: 2}

    bad = tmp_path / "bad.csv"
    bad.write_text(
        "object_id,kind,text,date,time,window_hours,places,colors,category,private_detail\n"
        "A01,lost,black bottle,2026-10-20,14:30,2,moon_base,black,water_bottle,\n"
        "A01,found,black bottle call 13812345678,2026-10-18,10:00,,library,blak,bottle,\n"
        "A02,lost,umbrella,20/10/2026,,,library,blue,umbrella,\n",
        encoding="utf-8",
    )
    errors, warnings, _ = check(bad)
    text = "\n".join(errors)
    assert "unknown place 'moon_base'" in text
    assert "unknown colour 'blak'" in text
    assert "unknown category 'bottle'" in text
    assert "found more than 24 h before" in text
    assert "date/time must be" in text
    assert any("mobile number" in w for w in warnings)


def test_form_export_converts(tmp_path):
    import importlib.util
    from pathlib import Path

    spec = importlib.util.spec_from_file_location(
        "form_to_csv", Path(__file__).resolve().parents[2] / "scripts" / "form_to_csv.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    owner = tmp_path / "owner.csv"
    owner.write_text(
        "提交时间,I agree / 我同意,Your member code / 你的成员编号,Sticker number on this item / 物品上的贴纸编号,"
        "Imagine you just lost this. Write the post / 帖子,When did you last have it? / 什么时候,"
        "How long before you noticed it was gone? / 多久,Where might you have lost it? / 哪里,"
        "Main colours / 主要颜色,What kind of thing is it? / 类型\n"
        "2026-10-20 15:00,是,m07,a01,黑色耳机不见了,2026/10/20 14:30,2 to 3 h,Library 图书馆┋Lower Gym 下体育馆,"
        "Black 黑┋Not sure 不确定,Headphones 耳机\n",
        encoding="utf-8",
    )
    rows = mod.convert(owner, "lost")
    assert rows == [{"object_id": "A01", "kind": "lost", "text": "黑色耳机不见了", "date": "2026-10-20",
                     "time": "14:30", "window_hours": "3", "places": "library;lower_gym", "colors": "black",
                     "category": "headphones", "private_detail": "", "writer": "M07"}]

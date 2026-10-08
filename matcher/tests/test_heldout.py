"""The evaluation's held-out vocabulary must stay unknown to the dictionary."""

from pathlib import Path

import yaml

from matcher.extract import extract

HELDOUT = Path(__file__).resolve().parents[1] / "eval" / "heldout.yaml"


def test_heldout_category_words_are_not_recognised():
    data = yaml.safe_load(HELDOUT.read_text(encoding="utf-8"))
    leaks = [(cat, w, extract(w).category)
             for cat, langs in data["categories"].items() for words in langs.values() for w in words
             if extract(w).category]
    assert leaks == [], f"held-out words leaked into taxonomy.yaml: {leaks}"

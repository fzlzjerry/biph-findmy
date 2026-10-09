from matcher import ItemInput

from .conftest import ago

LOST = ItemInput("lost", "lost", "黑色保温杯 贴了恐龙贴纸，体育课后在体育馆丢的",
                 ago(days=2), ago(days=2, hours=-2), locations=["gym"])


def six_black_bottles():
    return [
        ItemInput("dino", "found", "black thermos bottle with a dinosaur sticker", ago(days=1), locations=["gym"]),
        ItemInput("dent", "found", "black Hydro Flask, dented near the bottom", ago(days=1), locations=["gym"]),
        ItemInput("kl", "found", "black water bottle, K.L. written on the lid", ago(days=1), locations=["cafeteria"]),
        ItemInput("stanley", "found", "Black Stanley tumbler with a handle", ago(hours=30), locations=["field_track"]),
        ItemInput("plain1", "found", "黑色水杯", ago(days=1), locations=["gym"]),
        ItemInput("plain2", "found", "a black bottle", ago(days=1), locations=["library"]),
    ]


def test_sticker_bottle_ranks_first_among_six_lookalikes(any_matcher):
    results = any_matcher.rank(LOST, six_black_bottles(), top_k=None, min_band="weak")
    assert results[0].candidate_id == "dino"
    assert results[0].band == "strong"


def test_cross_lingual_reasons_mention_shared_marks(any_matcher):
    best = any_matcher.rank(LOST, six_black_bottles(), top_k=1, min_band="weak")[0]
    codes = {r["code"] for r in best.reasons}
    assert {"category_same", "marks_shared", "location_same"} <= codes
    shared = next(r for r in best.reasons if r["code"] == "marks_shared")
    assert "恐龙" in shared["zh"] and "dinosaur" in shared["en"]


def test_found_before_lost_is_excluded(any_matcher):
    early = ItemInput("early", "found", "black bottle with dinosaur sticker", ago(days=9), locations=["gym"])
    assert any_matcher.rank(LOST, [early], min_band="weak") == []


def test_different_category_scores_low(any_matcher):
    airpods = ItemInput("air", "found", "white AirPods case", ago(days=1), locations=["gym"])
    result = any_matcher.rank(LOST, [airpods], min_band="weak")[0]
    assert result.probability < 0.05


def test_private_detail_raises_score_but_never_appears_in_reasons(any_matcher):
    lost = ItemInput("l2", "lost", "black water bottle, my initials K.L. on the lid", ago(days=1), locations=["cafeteria"])
    public = ItemInput("f-pub", "found", "黑色水杯，食堂捡到", ago(hours=20), locations=["cafeteria"])
    private = ItemInput("f-priv", "found", "黑色水杯，食堂捡到", ago(hours=20), locations=["cafeteria"],
                        private_detail="lid says K.L.")
    r_pub = any_matcher.rank(lost, [public], min_band="weak")[0]
    r_priv = any_matcher.rank(lost, [private], min_band="weak")[0]
    assert r_priv.probability > r_pub.probability
    text = " ".join(r["en"] + r["zh"] for r in r_priv.reasons)
    assert "K.L" not in text and "KL" not in text


def test_user_confirmed_fields_override_extraction(tfidf_matcher):
    lost = ItemInput("l3", "lost", "my thing", ago(days=1), category="calculator", colors=["pink"], locations=["library"])
    found = ItemInput("f3", "found", "pink TI-84", ago(hours=10), category="calculator", colors=["pink"], locations=["library"])
    result = tfidf_matcher.rank(lost, [found], min_band="weak")[0]
    assert result.contributions["category"] > 0 and result.contributions["color"] > 0


def test_analyze_payload_for_form_chips(tfidf_matcher):
    out = tfidf_matcher.analyze("Found white AirPods Pro with a cat case in A402")
    assert out["category"]["id"] == "earbuds"
    assert out["colors"][0]["id"] == "white"
    assert out["places"][0]["id"] == "a_4f"
    assert out["brands"][0]["id"] == "apple"
    assert not out["sensitive"]
    assert tfidf_matcher.analyze("捡到一张学生卡")["sensitive"] is True

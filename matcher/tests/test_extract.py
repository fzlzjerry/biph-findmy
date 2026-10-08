import pytest

from matcher.extract import extract


@pytest.mark.parametrize(
    "text, category, colors, places",
    [
        ("黑色保温杯 贴了恐龙贴纸，在体育馆丢的", "water_bottle", ["black"], ["gym"]),
        ("Found a black Thermos bottle near the gym", "water_bottle", ["black"], ["gym"]),
        ("在gym丢了black水杯", "water_bottle", ["black"], ["gym"]),
        ("藍色耳機 在圖書館", "earbuds", ["blue"], ["library"]),
        ("purple pencil case with stripes, cafeteria", "pencil_case", ["purple"], ["cafeteria"]),
        ("navy blue hoodie left in the changing room", "jacket", ["navy"], ["locker_rooms"]),
    ],
)
def test_bilingual_attributes(text, category, colors, places):
    ex = extract(text)
    assert ex.category == category
    assert ex.colors == colors
    assert ex.places == places


def test_longest_phrase_wins():
    assert extract("钥匙扣上有小熊挂件的钥匙串").marks == ["keychain"]   # 钥匙扣 is a mark, not "keys"
    assert extract("pencil case").category == "pencil_case"               # not "pen"
    assert extract("笔记本电脑").category == "laptop"                        # not "notebook"


def test_colour_words_inside_other_words_are_ignored():
    assert extract("蓝牙耳机").colors == []          # 蓝牙 = Bluetooth, not blue
    assert extract("银行卡").colors == []            # 银行 = bank, not silver
    assert extract("left it at the black box theater").colors == []


def test_marks_motifs_and_codes():
    ex = extract("TI-84 calculator, navy case, my initials K.L. and a dinosaur sticker")
    assert ex.brands == ["texas_instruments"]
    assert {"ti84", "kl"} <= set(ex.codes)
    assert "sticker" in ex.marks and "case" in ex.marks
    assert ex.motifs == ["dinosaur"]


def test_chinese_dinosaur_sticker_matches_english_canon():
    assert extract("贴了恐龙贴纸").canon == extract("with a dinosaur sticker").canon == {"mark:sticker", "motif:dinosaur"}


def test_written_chinese_name_is_a_code():
    assert "王小明" in extract("写着王小明的学生卡").codes


def test_brand_and_category_can_share_a_word():
    ex = extract("white AirPods Pro")
    assert ex.category == "earbuds" and ex.brands == ["apple"]


def test_residual_keeps_only_distinctive_words():
    ex = extract("Lost my black water bottle in the gym, it has a dinosaur sticker")
    assert ex.residual == "dinosaur sticker"

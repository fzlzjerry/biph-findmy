from matcher.normalize import detect_language, normalize


def test_fullwidth_and_case_are_folded():
    assert normalize("ＢＬＡＣＫ　Bottle") == "black bottle"


def test_traditional_becomes_simplified():
    assert normalize("黑色保溫杯 藍色耳機") == "黑色保温杯 蓝色耳机"


def test_language_detection():
    assert detect_language("黑色保温杯") == "zh"
    assert detect_language("black bottle") == "en"
    assert detect_language("在gym丢了black水杯") == "mixed"

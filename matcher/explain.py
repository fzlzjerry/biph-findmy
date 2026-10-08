"""Human-readable, bilingual reasons for a match score.

Reasons only ever mention information from the *public* descriptions. A finder's private
verification detail can raise the score, but it is never echoed back to the person claiming.
"""

from __future__ import annotations

MIN_CONTRIBUTION = 0.25


def _label(table: dict, key: str, lang: str) -> str:
    entry = table.get(key)
    if entry is None:
        return key
    if isinstance(entry, dict):
        if isinstance(entry.get("label"), dict):
            entry = entry["label"]
        return entry.get(lang) or entry.get("en") or key
    label = getattr(entry, "label", None)
    if isinstance(label, dict):
        return label.get(lang) or label.get("en") or key
    return str(entry)


def build_reasons(contrib: dict[str, float], info: dict, vocab) -> list[dict]:
    reasons: list[dict] = []

    def add(code: str, feature: str, en: str, zh: str) -> None:
        value = contrib.get(feature, 0.0)
        reasons.append({"code": code, "feature": feature, "en": en, "zh": zh,
                        "contribution": round(value, 2)})

    c = contrib
    if abs(c.get("category", 0)) >= MIN_CONTRIBUTION and "categories" in info:
        a, b = info["categories"]
        la, lb = _label(vocab.categories, a, "en"), _label(vocab.categories, b, "en")
        za, zb = _label(vocab.categories, a, "zh"), _label(vocab.categories, b, "zh")
        if a == b:
            add("category_same", "category", f"Same type: {la}", f"同类物品：{za}")
        elif c["category"] > 0:
            add("category_related", "category", f"Related types: {la} / {lb}", f"相近类别：{za} / {zb}")
        else:
            add("category_diff", "category", f"Different type: {la} vs {lb}", f"类别不同：{za} vs {zb}")

    if abs(c.get("color", 0)) >= MIN_CONTRIBUTION and "colors" in info:
        a, b = info["colors"]
        la, lb = _label(vocab.colors, a, "en"), _label(vocab.colors, b, "en")
        za, zb = _label(vocab.colors, a, "zh"), _label(vocab.colors, b, "zh")
        if a == b:
            add("color_same", "color", f"Color matches: {la.lower()}", f"颜色一致：{za}")
        elif c["color"] > 0:
            add("color_similar", "color", f"Similar color: {la.lower()} ≈ {lb.lower()}", f"颜色相近：{za}≈{zb}")
        else:
            add("color_diff", "color", f"Different color: {la.lower()} vs {lb.lower()}", f"颜色不同：{za} vs {zb}")

    if abs(c.get("brand", 0)) >= MIN_CONTRIBUTION and "brands" in info:
        a, b = info["brands"]
        la, lb = vocab.brands.get(a, a), vocab.brands.get(b, b)
        if c["brand"] > 0:
            add("brand_same", "brand", f"Same brand: {la}", f"品牌相同：{la}")
        else:
            add("brand_diff", "brand", f"Different brand: {la} vs {lb}", f"品牌不同：{la} vs {lb}")

    shared = info.get("marks_public") or []
    if c.get("marks", 0) >= MIN_CONTRIBUTION and shared:
        en_parts, zh_parts = [], []
        for token in shared:
            kind, ident = token.split(":", 1)
            if kind == "mark":
                en_parts.append(_label(vocab.marks, ident, "en"))
                zh_parts.append(_label(vocab.marks, ident, "zh"))
            else:
                motif = vocab.motifs.get(ident, {"en": ident, "zh": ident})
                en_parts.append(motif["en"])
                zh_parts.append(motif["zh"])
        add("marks_shared", "marks", "Shared details: " + ", ".join(en_parts), "共同特征：" + "、".join(zh_parts))

    codes = info.get("codes_public") or []
    if c.get("code", 0) >= MIN_CONTRIBUTION and codes:
        shown = ", ".join(code.upper() if code.isascii() else code for code in codes)
        add("code_shared", "code", f"Same name / initials / model: {shown}", f"相同的名字/缩写/型号：{shown}")
    elif c.get("code", 0) <= -MIN_CONTRIBUTION:
        add("code_diff", "code", "Different initials or model number", "名字缩写或型号不同")

    if abs(c.get("location", 0)) >= MIN_CONTRIBUTION:
        if "place" in info:
            add("location_same", "location", f"Same place: {_label(vocab.places, info['place'], 'en')}",
                f"同一地点：{_label(vocab.places, info['place'], 'zh')}")
        elif "zone" in info:
            add("location_zone", "location", f"Same area: {_label(vocab.zones, info['zone'], 'en')}",
                f"同一区域：{_label(vocab.zones, info['zone'], 'zh')}")
        elif "places" in info:
            add("location_diff", "location", "Reported in different parts of campus", "地点相距较远")

    days = info.get("days")
    if days is not None:
        if days <= 3:
            d = max(0, round(days))
            en = "Found the same day it was lost" if d == 0 else f"Found {d} day{'s' if d > 1 else ''} after it was lost"
            zh = "丢失当天就被捡到" if d == 0 else f"丢失 {d} 天后被捡到"
            add("time_close", "time", en, zh)
        elif days > 14:
            add("time_far", "time", f"Found {round(days)} days after it was lost", f"丢失 {round(days)} 天后才被捡到")

    if c.get("text", 0) >= MIN_CONTRIBUTION:
        add("text_similar", "text", "Descriptions are similar", "描述相似")
    if c.get("detail", 0) >= MIN_CONTRIBUTION:
        add("detail_similar", "detail", "Specific details match", "细节描述吻合")

    # Time is shared context for most candidates, so it goes last; the rest by impact.
    reasons.sort(key=lambda r: (r["feature"] == "time", -abs(r["contribution"])))
    return reasons[:6]

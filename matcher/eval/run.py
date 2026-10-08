"""Full evaluation → docs/eval_report.md, docs/eval_results.json and charts in docs/img/.

    python -m matcher.eval.run            # full report (a minute or two)
    python -m matcher.eval.run --quick    # smaller synthetic set, no charts (used by tests/CI)
"""

from __future__ import annotations

import argparse
import json
import math
from datetime import date
from pathlib import Path

import numpy as np

from ..api import Matcher
from ..features import FEATURES
from ..scoring import manual_weights, sigmoid
from .common import bootstrap, fit_logistic, metrics, pair_table, prepare, ranks_from_scores
from .datasets import EvalSet, load_handwritten, load_real
from .generate import Generator, generate

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs"
IMG = DOCS / "img"
TEST_SEED = 2026  # different from the training seed (7): a fresh synthetic world
ABLATION = [
    ("Text only", ["text"]),
    ("+ category & colour", ["text", "category", "color"]),
    ("+ brand, codes, marks", ["text", "category", "color", "brand", "code", "marks"]),
    ("+ detail residual", ["text", "category", "color", "brand", "code", "marks", "detail"]),
    ("+ place & time (full)", FEATURES),
]
DISTRACTOR_KS = [0, 1, 3, 5, 10, 20]


def synthetic_test(n_objects: int) -> tuple[EvalSet, object]:
    data = generate(n_objects, seed=TEST_SEED)
    return EvalSet("synthetic", data.reports("lost", "test"), data.reports("found", "test")), data


class Evaluator:
    """Caches prepared reports and feature tables per backend."""

    def __init__(self, eval_set: EvalSet, structured: bool = True):
        self.set = eval_set
        self.truth = eval_set.truth
        self.structured = structured
        self.tables: dict[str, object] = {}
        self.matchers: dict[str, Matcher] = {}

    def matcher(self, backend: str) -> Matcher:
        if backend not in self.matchers:
            self.matchers[backend] = Matcher(backend=backend)
        return self.matchers[backend]

    def table(self, backend: str):
        if backend not in self.tables:
            m = self.matcher(backend)
            q = prepare(m, self.set.queries, self.structured)
            p = prepare(m, self.set.pool, self.structured)
            self.tables[backend] = (pair_table(m, q, p, self.truth), q, p)
        return self.tables[backend][0]

    def ranks(self, backend: str, scorer) -> list:
        table = self.table(backend)
        scores = np.array([scorer(x) for x in table.X]) if len(table.X) else np.array([])
        return ranks_from_scores(table, scores, self.truth, [q.id for q in self.set.queries],
                                 np.random.default_rng(0))

    def model_ranks(self, backend: str, manual: bool = False) -> list:
        w = manual_weights(backend) if manual else self.matcher(backend).weights
        vec = np.array([w.weights.get(f, 0.0) for f in FEATURES])
        if manual:
            # manual weights use their own centring; re-centre the similarity columns
            m = self.matcher(backend)
            shift = np.array([m.weights.centers.get(f, 0) - w.centers.get(f, 0) if f in ("text", "detail") else 0
                              for f in FEATURES])
            return self.ranks(backend, lambda x: float((x + shift * (x != 0)) @ vec))
        return self.ranks(backend, lambda x: float(x @ vec))

    def random_ranks(self) -> list:
        table = self.table("tfidf")
        out = []
        for qid in (q.id for q in self.set.queries):
            if qid not in self.truth:
                continue
            n = table.n_candidates.get(qid, 0)
            out.append((n + 1) / 2 if n else None)  # expected rank of a uniformly random order
        return out

    def catcolor_ranks(self, seeds: int = 10) -> list[list]:
        ci, co = FEATURES.index("category"), FEATURES.index("color")
        runs = []
        for s in range(seeds):
            table = self.table("tfidf")
            scores = np.array([2 * (x[ci] > 0.5) + (x[co] > 0.5) for x in table.X], dtype=float)
            runs.append(ranks_from_scores(table, scores, self.truth, [q.id for q in self.set.queries],
                                          np.random.default_rng(100 + s)))
        return runs


def random_metrics(ranks: list) -> dict:
    """Expected metrics for a random ordering (ranks hold the candidate count)."""
    n = len(ranks)
    def at(k):
        return sum(min(1.0, k / (2 * r - 1)) for r in ranks if r) / n
    mrr = sum((sum(1 / i for i in range(1, int(2 * r - 1) + 1)) / (2 * r - 1)) for r in ranks if r) / n
    return {"n": n, "R@1": at(1), "R@3": at(3), "R@5": at(5), "MRR": mrr}


def mean_metrics(runs: list[list]) -> dict:
    ms = [metrics(r) for r in runs]
    return {k: (float(np.mean([m[k] for m in ms])) if k != "n" else ms[0]["n"]) for k in ms[0]}


def methods_table(ev: Evaluator, with_onnx: bool) -> dict[str, dict]:
    rows = {"Random (time-plausible)": random_metrics(ev.random_ranks()),
            "Category + colour filter": mean_metrics(ev.catcolor_ranks()),
            "Text only — TF-IDF": metrics(ev.ranks("tfidf", lambda x: x[0])),
            "Full model — TF-IDF": metrics(ev.model_ranks("tfidf"))}
    if with_onnx:
        rows["Text only — multilingual embeddings"] = metrics(ev.ranks("onnx", lambda x: x[0]))
        rows["Full model — embeddings, hand-set weights"] = metrics(ev.model_ranks("onnx", manual=True))
        rows["Full model — embeddings, fitted weights"] = metrics(ev.model_ranks("onnx"))
    return rows


def ablation(ev: Evaluator, train_tables, backend: str) -> dict[str, dict]:
    train = train_tables[backend]
    out = {}
    for name, feats in ABLATION:
        cols = [FEATURES.index(f) for f in feats]
        bias, w = fit_logistic(train.X[:, cols], train.y)
        full = np.zeros(len(FEATURES))
        full[cols] = w
        out[name] = metrics(ev.ranks(backend, lambda x, full=full: float(x @ full)))
    return out


def distractor_curve(data, backend_list: list[str], n_queries: int = 120, seed: int = 99) -> dict:
    """R@1 when the true match hides among k look-alikes (+ 20 random other items)."""
    gen = Generator(seed)
    rng = np.random.default_rng(seed)
    test_lost = [r for r in data.reports("lost", "test")]
    found_by_obj = {r.object_id: r for r in data.found}
    queries = [q for q in test_lost if q.object_id in found_by_obj][:n_queries]
    others = [r for r in data.reports("found", "val")]
    results = {b: {k: [] for k in DISTRACTOR_KS} for b in backend_list + ["catcolor"]}
    split = {g: {k: [] for k in DISTRACTOR_KS} for g in ("with_marks", "without_marks")}
    matchers = {b: Matcher(backend=b) for b in backend_list}
    for qi, q in enumerate(queries):
        pq_main = matchers[backend_list[0]].prepare(q.to_item())
        group = "with_marks" if (pq_main.canon_public or pq_main.codes_public) else "without_marks"
        obj = data.objects[q.object_id]
        twins = gen.lookalikes(obj, max(DISTRACTOR_KS))
        background = list(rng.choice(others, size=min(20, len(others)), replace=False))
        true = found_by_obj[q.object_id]
        for k in DISTRACTOR_KS:
            pool = [true] + twins[:k] + background
            truth = {q.id: true.id}
            for b, m in matchers.items():
                pq, pp = prepare(m, [q]), prepare(m, pool)
                table = pair_table(m, pq, pp, truth)
                vec = np.array([m.weights.weights[f] for f in FEATURES])
                scores = table.X @ vec if len(table.X) else np.array([])
                ranks = ranks_from_scores(table, scores, truth, [q.id], np.random.default_rng(10_000 * k + qi))
                results[b][k] += ranks
                if b == backend_list[0]:
                    split[group][k] += ranks
                if b == backend_list[0]:
                    ci, co = FEATURES.index("category"), FEATURES.index("color")
                    cc = np.array([2 * (x[ci] > 0.5) + (x[co] > 0.5) for x in table.X], dtype=float)
                    results["catcolor"][k] += ranks_from_scores(table, cc, truth, [q.id],
                                                                np.random.default_rng(20_000 * k + qi))
    out = {b: {k: metrics(r)["R@1"] for k, r in per_k.items()} for b, per_k in results.items()}
    for g, per_k in split.items():
        if per_k[0]:
            out[f"{backend_list[0]}_{g}"] = {k: metrics(r)["R@1"] for k, r in per_k.items()}
            out[f"{backend_list[0]}_{g}"]["n"] = len(per_k[0])
    return out


def false_alarms(ev: Evaluator, backend: str) -> dict:
    """Queries whose true match is NOT in the pool: how often would we still show a match?"""
    m = ev.matcher(backend)
    table = ev.table(backend)
    vec = np.array([m.weights.weights[f] for f in FEATURES])
    probs = np.array([sigmoid(m.weights.bias + float(x @ vec)) for x in table.X])
    strong = possible = total = 0
    by_q: dict[str, list[int]] = {}
    for i, q in enumerate(table.qids):
        by_q.setdefault(q, []).append(i)
    for qid, idx in by_q.items():
        true = ev.truth.get(qid)
        rest = [probs[i] for i in idx if table.cids[i] != true]
        total += 1
        top = max(rest) if rest else 0.0
        strong += top >= m.weights.thresholds["strong"]
        possible += top >= m.weights.thresholds["possible"]
    return {"queries": total, "strong_rate": strong / max(total, 1), "shown_rate": possible / max(total, 1)}


def breakdown(ev: Evaluator, backend: str, key) -> dict[str, dict]:
    ranks = ev.model_ranks(backend)
    queries = [q for q in ev.set.queries if q.id in ev.truth]
    groups: dict[str, list] = {}
    for q, r in zip(queries, ranks):
        groups.setdefault(key(q), []).append(r)
    return {g: metrics(r) for g, r in sorted(groups.items())}


# ------------------------------------------------------------------------- report
def fmt(m: dict, keys=("R@1", "R@3", "MRR")) -> str:
    return " | ".join(f"{m[k] * 100:.1f}%" if k != "MRR" else f"{m[k]:.3f}" for k in keys)


def table_md(rows: dict[str, dict], keys=("R@1", "R@3", "MRR")) -> str:
    head = "| Method | " + " | ".join(keys) + " |\n|---|" + "---|" * len(keys) + "\n"
    return head + "".join(f"| {name} | {fmt(m, keys)} |\n" for name, m in rows.items())


def charts(results: dict) -> list[str]:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    indigo, cyan, muted, ink = "#3b3fb6", "#2bb5c4", "#9aa0b4", "#1d1f2e"
    plt.rcParams.update({"font.size": 10, "axes.spines.top": False, "axes.spines.right": False,
                         "axes.edgecolor": muted, "axes.labelcolor": ink, "xtick.color": ink, "ytick.color": ink})
    IMG.mkdir(parents=True, exist_ok=True)
    files = []

    rows = results["synthetic"]["methods"]
    names = list(rows)
    fig, ax = plt.subplots(figsize=(8, 4.2))
    y = np.arange(len(names))
    ax.barh(y + 0.2, [rows[n]["R@1"] * 100 for n in names], 0.4, color=indigo, label="Top-1 correct (R@1)")
    ax.barh(y - 0.2, [rows[n]["R@3"] * 100 for n in names], 0.4, color=cyan, label="In top 3 (R@3)")
    ax.set_yticks(y, names)
    ax.invert_yaxis()
    ax.set_xlim(0, 100)
    ax.set_xlabel("% of lost reports whose true found item is ranked at the top")
    ax.legend(loc="upper center", bbox_to_anchor=(0.35, -0.13), ncol=2, frameon=False)
    ax.set_title("Synthetic test set — methods compared", loc="left", fontweight="bold")
    fig.tight_layout()
    fig.savefig(IMG / "methods.png", dpi=160)
    files.append("img/methods.png")
    plt.close(fig)

    curve = results.get("distractors")
    if curve:
        fig, ax = plt.subplots(figsize=(7, 4))
        labels = {"onnx": ("Full model (embeddings)", indigo, "-"), "tfidf": ("Full model (TF-IDF)", cyan, "-"),
                  "catcolor": ("Category + colour filter", muted, "--"),
                  "onnx_with_marks": ("…lost report names a distinguishing mark", indigo, ":"),
                  "onnx_without_marks": ("…lost report has no distinguishing mark", "#c2410c", ":")}
        for key, series in curve.items():
            label, color, style = labels.get(key, (key, ink, ":"))
            ks = sorted(int(k) for k in series if str(k) != "n")
            ax.plot(ks, [series[k if k in series else str(k)] * 100 for k in ks], style, marker="o",
                    color=color, label=label, linewidth=2)
        ax.set_xlabel("Number of look-alike items in the pool (same type and colour)")
        ax.set_ylabel("Top-1 correct (%)")
        ax.set_ylim(0, 100)
        ax.legend(frameon=False)
        ax.set_xticks(DISTRACTOR_KS)
        ax.set_title("Can it find your black bottle among look-alikes?", loc="left", fontweight="bold")
        fig.tight_layout()
        fig.savefig(IMG / "distractor_curve.png", dpi=160)
        files.append("img/distractor_curve.png")
        plt.close(fig)

    abl = results["synthetic"].get("ablation")
    if abl:
        fig, ax = plt.subplots(figsize=(7.5, 3.8))
        names = list(abl)
        x = np.arange(len(names))
        ax.bar(x - 0.2, [abl[n]["R@1"] * 100 for n in names], 0.4, color=indigo, label="R@1")
        ax.bar(x + 0.2, [abl[n]["R@3"] * 100 for n in names], 0.4, color=cyan, label="R@3")
        ax.set_xticks(x, names, rotation=12, ha="right")
        ax.set_ylim(0, 100)
        ax.set_ylabel("%")
        ax.legend(frameon=False)
        ax.set_title("Ablation — what each kind of evidence adds", loc="left", fontweight="bold")
        fig.tight_layout()
        fig.savefig(IMG / "ablation.png", dpi=160)
        files.append("img/ablation.png")
        plt.close(fig)

    w = results.get("weights", {}).get("onnx")
    if w:
        fig, ax = plt.subplots(figsize=(6.5, 3.6))
        feats = sorted(w, key=lambda f: w[f])
        ax.barh(feats, [w[f] for f in feats], color=indigo)
        ax.set_xlabel("Learned weight (log-odds per unit of evidence)")
        ax.set_title("What the model learned to trust", loc="left", fontweight="bold")
        fig.tight_layout()
        fig.savefig(IMG / "weights.png", dpi=160)
        files.append("img/weights.png")
        plt.close(fig)
    return files


def write_report(results: dict) -> None:
    syn = results["synthetic"]
    best = syn["methods"].get("Full model — embeddings, fitted weights") or syn["methods"]["Full model — TF-IDF"]
    ci = syn.get("ci", {})
    lines = [
        "# Matching engine evaluation · 匹配引擎评估报告",
        "",
        f"_Generated {results['generated']} by `python -m matcher.eval.run` — Data Science Club, BIPH._",
        "",
        "## Summary · 结论",
        "",
        f"- On a synthetic test campus the full model puts the right found item **first for "
        f"{best['R@1'] * 100:.0f}%** of lost reports and **in the top 3 for {best['R@3'] * 100:.0f}%** "
        f"(95% CI R@1 {ci.get('R@1', [0, 0])[0] * 100:.0f}–{ci.get('R@1', [0, 0])[1] * 100:.0f}%).",
        f"- 在合成测试集上，完整模型把正确的物品排在第 1 位的比例是 **{best['R@1'] * 100:.0f}%**，"
        f"排进前 3 的比例是 **{best['R@3'] * 100:.0f}%**。",
        f"- A plain \"same category + same colour\" filter gets {syn['methods']['Category + colour filter']['R@1'] * 100:.0f}% "
        "— the extra evidence (descriptions, distinguishing marks, place, time) is what separates look-alikes.",
    ]
    hw = results.get("handwritten")
    if hw:
        hb = hw["methods"].get("Full model — embeddings, fitted weights") or hw["methods"]["Full model — TF-IDF"]
        lines.append(f"- On the hand-written (LLM-authored, not template) set: R@1 **{hb['R@1'] * 100:.0f}%**, "
                     f"R@3 **{hb['R@3'] * 100:.0f}%** over {hw['pool']} found items.")
    if results.get("real"):
        rb = results["real"]["methods"].get("Full model — embeddings, fitted weights")
        lines.append(f"- On **real** club-collected data: R@1 {rb['R@1'] * 100:.0f}%, R@3 {rb['R@3'] * 100:.0f}%.")
    else:
        lines.append("- **Real data is still pending** — run the describe-an-object activity "
                     "(docs/data-collection.md) and re-run this script; synthetic numbers are an upper-bound sanity check, not a promise.")
    lines += [
        "",
        "## Datasets · 数据",
        "",
        f"- **Synthetic** (seed {TEST_SEED}, never used for training): {syn['queries']} lost reports ranked against "
        f"{syn['pool']} found reports. 45% Chinese / 40% English / 15% mixed, ~20% Traditional among Chinese, "
        "~35% use held-out words the dictionary has never seen, owners misremember colours/places, "
        "look-alike families share category + colour.",
        "- **Hand-written**: 32 objects + 10 distractors in `matcher/data/handwritten_pairs.yaml`, written to sound like "
        "real student posts (emoji, slang, Traditional characters, typos). Written by an LLM — *not* real data.",
        "- **Real**: `matcher/data/real_pairs.csv` (from the club activity) — " + ("included." if results.get("real") else "not collected yet."),
        "- Weights were fitted on a *different* synthetic world (seed 7, train split) — see `matcher/eval/fit_weights.py`.",
        "",
        "## Methods compared · 方法对比",
        "",
        "Metrics: **R@1** = true match ranked first; **R@3** = in the top three; **MRR** = mean of 1/rank. "
        "Candidates that are impossible in time (found more than a day *before* the loss) are excluded for every method.",
        "",
        table_md(syn["methods"]),
        "![methods](img/methods.png)",
        "",
    ]
    if hw:
        lines += ["### Hand-written set", "", table_md(hw["methods"]), ""]
    if results.get("real"):
        lines += ["### Real data", "", table_md(results["real"]["methods"]), ""]
    if results.get("distractors"):
        d = results["distractors"]
        lines += [
            "## Look-alikes · 干扰项曲线",
            "",
            "Each lost report is hidden among *k* look-alikes (same category and colour, different details) plus 20 random items.",
            "",
            "| Look-alikes k | " + " | ".join(str(k) for k in DISTRACTOR_KS) + " |",
            "|---|" + "---|" * len(DISTRACTOR_KS),
        ]
        names = {"onnx": "Full model (embeddings)", "tfidf": "Full model (TF-IDF)", "catcolor": "Category + colour filter",
                 "onnx_with_marks": "↳ lost report names a distinguishing mark",
                 "onnx_without_marks": "↳ lost report has no distinguishing mark"}
        for key, series in d.items():
            lines.append(f"| {names.get(key, key)} | " + " | ".join(f"{series[k] * 100:.0f}%" for k in DISTRACTOR_KS) + " |")
        lines += ["", "![distractors](img/distractor_curve.png)", ""]
        wm, nm = d.get("onnx_with_marks"), d.get("onnx_without_marks")
        if wm and nm:
            lines += [
                f"**Takeaway · 结论：** with 5 look-alikes, reports that mention a sticker, keychain, initials or other mark are "
                f"matched first {wm[5] * 100:.0f}% of the time, versus {nm[5] * 100:.0f}% for reports without one "
                f"(n={wm['n']} vs {nm['n']}). Two plain black bottles are indistinguishable — which is why the report form "
                "has a dedicated \"distinguishing marks\" field and asks for a photo.",
                f"有 5 个相似物品时，写了特征标记（贴纸、挂件、名字缩写等）的失物有 {wm[5] * 100:.0f}% 被排在第一；"
                f"没写的只有 {nm[5] * 100:.0f}%。所以发布页专门有一个「特征标记」输入框。",
                "",
            ]
    if syn.get("ablation"):
        lines += ["## Ablation · 消融实验", "", "Each row refits the weights using only the listed evidence.", "",
                  table_md(syn["ablation"]), "![ablation](img/ablation.png)", ""]
    lines += ["## Robustness · 稳健性", ""]
    if syn.get("by_language"):
        lines += ["By language of the lost report:", "", table_md(syn["by_language"]), ""]
    if syn.get("by_vocab"):
        lines += ["Dictionary coverage (did the lost report use a held-out word?):", "", table_md(syn["by_vocab"]), ""]
    if syn.get("text_only_input"):
        lines += [f"If users skip the structured fields and only type free text, R@1 is "
                  f"{syn['text_only_input']['R@1'] * 100:.0f}% (R@3 {syn['text_only_input']['R@3'] * 100:.0f}%) — "
                  "the NLP extraction fills in category, colour and place.", ""]
    fa = syn.get("false_alarms")
    if fa:
        lines += [
            "## False alarms · 误报",
            "",
            f"When the owner's item has **not** been handed in, the top candidate still lands in the *strong* band for "
            f"{fa['strong_rate'] * 100:.0f}% of reports and is shown at all (possible band) for {fa['shown_rate'] * 100:.0f}%. "
            "That is why the site says \"possible match — please check the photo\" instead of \"this is yours\".",
            "",
        ]
    if results.get("weights"):
        lines += ["## What the model learned · 学到的权重", "",
                  "Weights are log-odds per unit of evidence, constrained to be ≥ 0 so more evidence never lowers a score.", "",
                  "| Feature | " + " | ".join(results["weights"]) + " |", "|---|" + "---|" * len(results["weights"])]
        for f in FEATURES:
            lines.append(f"| {f} | " + " | ".join(f"{results['weights'][b].get(f, 0):.2f}" for b in results["weights"]) + " |")
        lines += ["", "![weights](img/weights.png)", ""]
    lines += [
        "## Limitations & next steps · 局限与下一步",
        "",
        "- Synthetic data is generated by our own templates, so it flatters the model. The real-data run is the honest number.",
        "- User feedback (\"this is mine / not mine\") is logged but **not** used for training: it is biased toward whatever "
        "we ranked first. Use it to monitor precision instead.",
        "- Photos are not used yet. A Q2 idea: CLIP-style image–text matching so a finder can just snap a photo.",
        "",
        "## Reproduce · 复现",
        "",
        "```bash\nuv run python -m matcher.eval.build_idf\nuv run python -m matcher.eval.fit_weights\nuv run python -m matcher.eval.run\n```",
        "",
    ]
    (DOCS / "eval_report.md").write_text("\n".join(lines), encoding="utf-8")


def evaluate(quick: bool = False) -> dict:
    with_onnx = Matcher().backend == "onnx"
    backends = ["onnx", "tfidf"] if with_onnx else ["tfidf"]
    test_set, data = synthetic_test(400 if quick else 900)
    ev = Evaluator(test_set)
    results: dict = {"generated": date.today().isoformat(), "with_embeddings": with_onnx}
    syn: dict = {"queries": len([q for q in test_set.queries if q.id in ev.truth]), "pool": len(test_set.pool),
                 "methods": methods_table(ev, with_onnx)}
    main_backend = backends[0]
    syn["ci"] = bootstrap(ev.model_ranks(main_backend), n_boot=300 if quick else 1000)
    syn["false_alarms"] = false_alarms(ev, main_backend)
    if not quick:
        syn["by_language"] = breakdown(ev, main_backend, lambda q: q.lang or "?")
        syn["by_vocab"] = breakdown(ev, main_backend, lambda q: "held-out word" if q.oov else "dictionary word")
        text_only = Evaluator(test_set, structured=False)
        syn["text_only_input"] = metrics(text_only.model_ranks(main_backend))
        # ablation: refit on the training world, evaluate on the test world
        train_data = generate(900, seed=7)
        train_tables = {}
        for b in backends:
            m = Matcher(backend=b)
            truth = {q.id: f.id for q in train_data.reports("lost") for f in train_data.reports("found")
                     if q.object_id == f.object_id}
            train_tables[b] = pair_table(m, prepare(m, train_data.reports("lost", "train")),
                                         prepare(m, train_data.reports("found", "train")), truth)
        syn["ablation"] = ablation(ev, train_tables, main_backend)
        results["distractors"] = distractor_curve(data, backends)
    results["synthetic"] = syn

    hw_set = load_handwritten()
    hw = Evaluator(hw_set)
    results["handwritten"] = {"queries": len(hw_set.queries), "pool": len(hw_set.pool),
                              "methods": methods_table(hw, with_onnx)}
    real = load_real()
    if real:
        rev = Evaluator(real)
        results["real"] = {"queries": len(real.queries), "pool": len(real.pool), "methods": methods_table(rev, with_onnx)}
    results["weights"] = {b: Matcher(backend=b).weights.weights for b in backends}
    return results


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--quick", action="store_true")
    args = parser.parse_args()
    results = evaluate(quick=args.quick)
    for name, block in (("synthetic", results["synthetic"]), ("handwritten", results["handwritten"])):
        print(f"\n== {name}")
        for method, m in block["methods"].items():
            print(f"  {method:45s} R@1 {m['R@1'] * 100:5.1f}%  R@3 {m['R@3'] * 100:5.1f}%  MRR {m['MRR']:.3f}")
    if results.get("distractors"):
        print("\n== distractor curve (R@1)", json.dumps(results["distractors"], indent=None))
    if not args.quick:
        DOCS.mkdir(exist_ok=True)
        charts(results)
        write_report(results)
        (DOCS / "eval_results.json").write_text(json.dumps(results, indent=2, ensure_ascii=False, default=str),
                                                encoding="utf-8")
        print(f"\nwrote {DOCS / 'eval_report.md'}")


if __name__ == "__main__":
    main()

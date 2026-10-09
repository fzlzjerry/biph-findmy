// Results of the Data Science Club's evaluation on its synthetic test set (97 lost reports, 163 found items),
// copied from docs/eval_results.json (generated 2026-10-08). Copy them again whenever the report is regenerated.

/** Share of lost reports whose true found item was ranked first / in the top 3, per method. */
export const EVAL_METHODS = [
  { id: "random", first: 0.0157, top3: 0.0472 },
  { id: "catColor", first: 0.4763, top3: 0.7144 },
  { id: "textTfidf", first: 0.2887, top3: 0.3918 },
  { id: "fullTfidf", first: 0.8351, top3: 0.9897 },
  { id: "textEmbed", first: 0.3814, top3: 0.5876 },
  { id: "fullHand", first: 0.8557, top3: 0.9897 },
  { id: "fullFitted", first: 0.8866, top3: 0.9897 },
] as const;

export type EvalMethodId = (typeof EVAL_METHODS)[number]["id"];

/** The method FindMy runs in production. */
export const SHIPPED_METHOD: EvalMethodId = "fullFitted";

/** Ranked-first rate as same-type, same-colour look-alikes are added to the pool. */
export const LOOKALIKES = {
  counts: [0, 1, 3, 5, 10, 20],
  withMark: [1, 0.95, 0.775, 0.625, 0.525, 0.4],
  withoutMark: [0.9825, 0.7368, 0.5263, 0.4035, 0.2456, 0.1404],
  catColor: [0.8041, 0.4948, 0.1649, 0.1649, 0.0619, 0.0206],
} as const;

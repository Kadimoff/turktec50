// Pure, client-safe scoring helpers for the jury module.
// Mirrors `weightedScore` in @/lib/kpi (server-only) so the live preview in the browser matches the server exactly.
// Scores are informative aggregates for human panels — never a decision or a ranking.

export type RubricCriterionLite = { id: string; key: string; weight: number; maxScore: number };

/** Weighted rubric score normalized to 0–100 (one decimal). Missing scores count as 0. */
export function weightedPreview(criteria: { id: string; weight: number; maxScore: number }[], scores: Record<string, number>) {
  let total = 0;
  for (const c of criteria) {
    const s = scores[c.id];
    if (typeof s === "number") total += (s / c.maxScore) * c.weight;
  }
  return Math.round(total * 10) / 10;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function spread(values: number[]): number | null {
  if (values.length < 2) return null;
  return Math.max(...values) - Math.min(...values);
}

/** Spread (max − min) of weighted scores above this many points → "discuss in panel" flag. */
export const DISAGREEMENT_THRESHOLD = 20;

export function fmtScore(n: number | null | undefined, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

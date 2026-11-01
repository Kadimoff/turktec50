// Pure helpers shared by server and client risk components (no server-only imports).
export const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type RiskLevelValue = (typeof RISK_LEVELS)[number];
export const RISK_STATUSES = ["OPEN", "MITIGATING", "CLOSED"] as const;
export type RiskStatusValue = (typeof RISK_STATUSES)[number];

const weight: Record<RiskLevelValue, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };

/** 3×3 probability × impact → derived level (score 1–2 low, 3–4 medium, 6–9 high). */
export function riskLevel(probability: string, impact: string): RiskLevelValue {
  const s = (weight[probability as RiskLevelValue] ?? 2) * (weight[impact as RiskLevelValue] ?? 2);
  return s >= 6 ? "HIGH" : s >= 3 ? "MEDIUM" : "LOW";
}

export function riskScore(probability: string, impact: string) {
  return (weight[probability as RiskLevelValue] ?? 2) * (weight[impact as RiskLevelValue] ?? 2);
}

/** yyyy-mm-dd in Asia/Baku for <input type="date"> */
export function toDateInput(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baku", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));
}

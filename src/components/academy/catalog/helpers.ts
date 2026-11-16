// Pure helpers shared by the catalog server components, client components and server actions (no server-only imports).

export const RULE_STATUSES = ["TRACKING", "CHANGED", "CONFIRMED"] as const;
export type RuleStatusValue = (typeof RULE_STATUSES)[number];

/** Tracking filter values: "" = all, then tracked / untracked / each RuleStatus. */
export const TRACKING_FILTERS = ["tracked", "untracked", ...RULE_STATUSES] as const;
export type TrackingFilter = "" | (typeof TRACKING_FILTERS)[number];

/** 2026 initial TEKNOFEST announcement (see summary panel). */
export const ANNOUNCEMENT_2026 = { competitions: 52, subcategories: 127 } as const;
export const OFFICIAL_INDEX_URL = "https://teknofest.org/tr/yarismalar/";
export const ANNOUNCEMENT_URL =
  "https://www.teknofest.org/tr/duyurular/gelecegi-uretenler-teknofestte-bulusuyor-2026-teknoloji-yarismalarina-basvurular-basladi/";

/** HTTPS URL with a hostname (mirrors server.py rule-source validation). */
export function isHttpsUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && u.hostname.length > 0;
  } catch {
    return false;
  }
}

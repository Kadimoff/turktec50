// URL/searchParams helpers shared by the applications and projects list pages.

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

/** First value of a search param, trimmed; undefined when empty. */
export function spValue(sp: SearchParamsRecord, key: string): string | undefined {
  const raw = sp[key];
  const v = Array.isArray(raw) ? raw[0] : raw;
  const s = v?.trim();
  return s ? s : undefined;
}

/** Value restricted to an allow-list. */
export function spEnum<T extends string>(sp: SearchParamsRecord, key: string, allowed: readonly T[]): T | undefined {
  const v = spValue(sp, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

export function spPage(sp: SearchParamsRecord): number {
  const n = Number.parseInt(spValue(sp, "page") ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Build `path?query` from current params + overrides (undefined/"" removes a key). */
export function hrefWith(path: string, params: Record<string, string | undefined>, overrides: Record<string, string | undefined> = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...overrides })) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

export const PAGE_SIZE = 25;

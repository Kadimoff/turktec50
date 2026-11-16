// URL search-param helpers shared by list pages (filters, pagination). Pure module.
export type SearchParams = Record<string, string | string[] | undefined>;

/** First value of a search param. */
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Trimmed non-empty value, else undefined. */
export function str(v: string | string[] | undefined, max = 120) {
  const s = one(v)?.trim();
  return s ? s.slice(0, max) : undefined;
}

/** 1-based page number (invalid → 1). */
export function parsePage(v: string | string[] | undefined) {
  const n = Number(one(v));
  return Number.isInteger(n) && n > 0 ? n : 1;
}

/** `value` if it is one of `allowed`, else `fallback`. */
export function pick<T extends string>(v: string | string[] | undefined, allowed: readonly T[], fallback: T): T;
export function pick<T extends string>(v: string | string[] | undefined, allowed: readonly T[]): T | undefined;
export function pick<T extends string>(v: string | string[] | undefined, allowed: readonly T[], fallback?: T) {
  const s = one(v);
  return (allowed as readonly string[]).includes(s ?? "") ? (s as T) : fallback;
}

/** Link to `basePath` with `params` + `patch`; empty values are dropped. */
export function buildHref(basePath: string, params: Record<string, string | undefined>, patch: Record<string, string | undefined> = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...patch })) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `${basePath}?${s}` : basePath;
}

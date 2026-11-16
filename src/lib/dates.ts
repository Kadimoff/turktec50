// Programme calendar helpers. Asia/Baku is UTC+04:00 all year (no DST since 2016), so every calendar computation uses
// Baku wall-clock time regardless of the server time zone. Pure module: safe in server and client components.

export const BAKU_TZ = "Asia/Baku";
const OFFSET_MS = 4 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const p2 = (n: number) => String(n).padStart(2, "0");

type DateLike = Date | string | number;

/** Wall-clock parts of an instant in Baku (month 1–12, dow 0 = Sunday). */
export function bakuParts(d: DateLike) {
  const w = new Date(new Date(d).getTime() + OFFSET_MS);
  return { y: w.getUTCFullYear(), m: w.getUTCMonth() + 1, d: w.getUTCDate(), hh: w.getUTCHours(), mm: w.getUTCMinutes(), ss: w.getUTCSeconds(), dow: w.getUTCDay() };
}

/** yyyy-mm-dd in Baku — the value of `<input type="date">` ("" for null). */
export function bakuYmd(d: DateLike | null | undefined) {
  if (d === null || d === undefined || d === "") return "";
  const p = bakuParts(d);
  return `${p.y}-${p2(p.m)}-${p2(p.d)}`;
}

/** HH:mm in Baku ("" for null). */
export function bakuHm(d: DateLike | null | undefined) {
  if (d === null || d === undefined || d === "") return "";
  const p = bakuParts(d);
  return `${p2(p.hh)}:${p2(p.mm)}`;
}

/** yyyy-mm-ddTHH:mm in Baku — the value of `<input type="datetime-local">` ("" for null). */
export function bakuDateTimeInput(d: DateLike | null | undefined) {
  const ymd = bakuYmd(d);
  return ymd ? `${ymd}T${bakuHm(d)}` : "";
}

/** Parse a date (and optional HH:mm) entered in Baku time. Null when invalid (also rejects 2026-02-31). */
export function parseBakuDate(ymd: string, hm = "12:00"): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || !/^\d{2}:\d{2}$/.test(hm)) return null;
  const dt = new Date(`${ymd}T${hm}:00+04:00`);
  if (Number.isNaN(dt.getTime()) || bakuYmd(dt) !== ymd || bakuHm(dt) !== hm) return null;
  return dt;
}

/** Parse a `datetime-local` value (yyyy-mm-ddTHH:mm) as Baku time. */
export function parseBakuDateTime(value: string): Date | null {
  const [ymd, hm] = value.split("T");
  return ymd && hm ? parseBakuDate(ymd, hm.slice(0, 5)) : null;
}

/** Start of the Baku calendar day containing `d`. */
export function bakuStartOfDay(d: DateLike = new Date()) {
  return new Date(`${bakuYmd(d)}T00:00:00+04:00`);
}

/** Add whole days (Baku has no DST, so this keeps the wall-clock time). */
export function bakuAddDays(d: DateLike, days: number) {
  return new Date(new Date(d).getTime() + days * DAY_MS);
}

/** Whole Baku calendar days from `from` to `to` (positive when `to` is later). */
export function bakuDayDiff(from: DateLike, to: DateLike) {
  return Math.round((Date.parse(`${bakuYmd(to)}T00:00:00Z`) - Date.parse(`${bakuYmd(from)}T00:00:00Z`)) / DAY_MS);
}

/** Calendar days until `d` counted in Baku (0 = today, negative = past). */
export function bakuDaysUntil(d: DateLike, now: DateLike = new Date()) {
  return bakuDayDiff(now, d);
}

/** A Date whose LOCAL fields show the Baku wall-clock time of `d` — only for date-fns `format`, never for storage. */
export function toBakuWallClock(d: DateLike) {
  const p = bakuParts(d);
  return new Date(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss);
}

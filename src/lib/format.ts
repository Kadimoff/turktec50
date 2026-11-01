import { format, formatDistanceToNow, type Locale as DfLocale } from "date-fns";
import { az, tr, enGB } from "date-fns/locale";

const map: Record<string, DfLocale> = { az, tr, en: enGB };

export function dfLocale(locale: string): DfLocale {
  return map[locale] ?? az;
}

/** 20 okt 2026 */
export function fmtDate(d: Date | string | null | undefined, locale: string) {
  if (!d) return "—";
  return format(new Date(d), "d MMM yyyy", { locale: dfLocale(locale) });
}

/** 20 okt */
export function fmtDay(d: Date | string, locale: string) {
  return format(new Date(d), "d MMM", { locale: dfLocale(locale) });
}

/** 20 okt 2026, 10:30 */
export function fmtDateTime(d: Date | string | null | undefined, locale: string) {
  if (!d) return "—";
  return format(new Date(d), "d MMM yyyy, HH:mm", { locale: dfLocale(locale) });
}

export function fmtRelative(d: Date | string, locale: string) {
  return formatDistanceToNow(new Date(d), { addSuffix: true, locale: dfLocale(locale) });
}

export function fmtPct(n: number) {
  return `${Math.round(n)}%`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

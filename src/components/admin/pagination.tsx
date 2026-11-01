import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Build a URL keeping current filters; empty values are dropped. */
export function buildHref(basePath: string, params: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...patch })) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `${basePath}?${s}` : basePath;
}

/** Server-rendered pager (prev / "page x of y" / next) with a result range. */
export async function Pagination({
  basePath, params, page, pageSize, total,
}: { basePath: string; params: Record<string, string | undefined>; page: number; pageSize: number; total: number }) {
  const t = await getTranslations("admin.pagination");
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const link = (p: number) => buildHref(basePath, params, { page: p > 1 ? String(p) : undefined });
  const btn = "inline-flex h-9 items-center gap-1 rounded-lg border bg-background px-3 text-sm font-medium transition-colors duration-150 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none dark:bg-input/30";
  return (
    <nav aria-label={t("label")} className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="tabular text-xs text-muted-foreground">{t("range", { from, to, total })}</p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={link(page - 1)} className={btn} rel="prev"><ChevronLeft className="size-4" aria-hidden />{t("prev")}</Link>
        ) : (
          <span className={cn(btn, "pointer-events-none opacity-50")} aria-disabled><ChevronLeft className="size-4" aria-hidden />{t("prev")}</span>
        )}
        <span className="tabular px-1 text-sm text-muted-foreground" aria-current="page">{t("page", { page, pages })}</span>
        {page < pages ? (
          <Link href={link(page + 1)} className={btn} rel="next">{t("next")}<ChevronRight className="size-4" aria-hidden /></Link>
        ) : (
          <span className={cn(btn, "pointer-events-none opacity-50")} aria-disabled>{t("next")}<ChevronRight className="size-4" aria-hidden /></span>
        )}
      </div>
    </nav>
  );
}

export function parsePage(v: string | string[] | undefined) {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function str(v: string | string[] | undefined) {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : undefined;
}

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildHref } from "@/lib/search-params";
import { cn } from "@/lib/utils";

/** The one server-rendered pager: result range, prev / "page x of y" / next; links keep the current filters. */
export async function Pagination({
  basePath,
  params,
  page,
  pageSize,
  total,
  className,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
  className?: string;
}) {
  if (total === 0) return null;
  const t = await getTranslations("common.pagination");
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const href = (p: number) => buildHref(basePath, { ...params, page: undefined }, { page: p > 1 ? String(p) : undefined });
  return (
    <nav aria-label={t("label")} className={cn("flex flex-col items-center justify-between gap-3 sm:flex-row", className)}>
      <p className="tabular text-xs text-muted-foreground">{t("range", { from, to, total })}</p>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Button variant="outline" size="lg" nativeButton={false} render={<Link href={href(page - 1)} rel="prev" scroll={false} />}>
              <ChevronLeft aria-hidden />
              {t("prev")}
            </Button>
          ) : (
            <Button variant="outline" size="lg" disabled>
              <ChevronLeft aria-hidden />
              {t("prev")}
            </Button>
          )}
          <span className="tabular px-1 text-xs font-medium text-muted-foreground" aria-current="page">{t("page", { page, pages })}</span>
          {page < pages ? (
            <Button variant="outline" size="lg" nativeButton={false} render={<Link href={href(page + 1)} rel="next" scroll={false} />}>
              {t("next")}
              <ChevronRight aria-hidden />
            </Button>
          ) : (
            <Button variant="outline" size="lg" disabled>
              {t("next")}
              <ChevronRight aria-hidden />
            </Button>
          )}
        </div>
      )}
    </nav>
  );
}

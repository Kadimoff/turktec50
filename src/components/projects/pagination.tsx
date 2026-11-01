import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hrefWith } from "./url";

/** Server-rendered pager (links keep current filters). */
export async function Pagination({
  page,
  pageSize,
  total,
  path,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  path: string;
  params: Record<string, string | undefined>;
}) {
  const t = await getTranslations("projects.pagination");
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const href = (p: number) => hrefWith(path, params, { page: p > 1 ? String(p) : undefined });
  return (
    <nav aria-label={t("label")} className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="tabular text-xs text-muted-foreground">{t("summary", { from, to, total })}</p>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Button variant="outline" className="h-9" nativeButton={false} render={<Link href={href(page - 1)} scroll={false} />}>
              <ChevronLeft aria-hidden />
              {t("prev")}
            </Button>
          ) : (
            <Button variant="outline" className="h-9" disabled>
              <ChevronLeft aria-hidden />
              {t("prev")}
            </Button>
          )}
          <span className="tabular px-1 text-xs font-medium text-muted-foreground">{t("page", { page, pages })}</span>
          {page < pages ? (
            <Button variant="outline" className="h-9" nativeButton={false} render={<Link href={href(page + 1)} scroll={false} />}>
              {t("next")}
              <ChevronRight aria-hidden />
            </Button>
          ) : (
            <Button variant="outline" className="h-9" disabled>
              {t("next")}
              <ChevronRight aria-hidden />
            </Button>
          )}
        </div>
      )}
    </nav>
  );
}

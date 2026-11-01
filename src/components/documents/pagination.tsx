import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Simple prev/next pagination preserving other search params. */
export async function Pagination({
  basePath,
  params,
  page,
  pageSize,
  total,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const t = await getTranslations("documents.pagination");
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "page") sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label={t("label")} className="flex items-center justify-between gap-3 border-t px-4 py-3">
      <p className="tabular text-xs text-muted-foreground">{t("range", { from, to, total })}</p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Button variant="outline" size="sm" className="h-8" nativeButton={false} render={<Link href={href(page - 1)} scroll={false} />}>
            <ChevronLeft aria-hidden />
            {t("prev")}
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-8" disabled>
            <ChevronLeft aria-hidden />
            {t("prev")}
          </Button>
        )}
        <span className="tabular text-xs font-medium text-muted-foreground" aria-current="page">
          {page}/{pages}
        </span>
        {page < pages ? (
          <Button variant="outline" size="sm" className="h-8" nativeButton={false} render={<Link href={href(page + 1)} scroll={false} />}>
            {t("next")}
            <ChevronRight aria-hidden />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-8" disabled>
            {t("next")}
            <ChevronRight aria-hidden />
          </Button>
        )}
      </div>
    </nav>
  );
}

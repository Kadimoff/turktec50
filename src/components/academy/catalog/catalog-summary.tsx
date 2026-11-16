import { getTranslations } from "next-intl/server";
import { BadgeCheck, ExternalLink, Info, LayoutGrid, ListTree, PenLine, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { ANNOUNCEMENT_2026, ANNOUNCEMENT_URL, OFFICIAL_INDEX_URL } from "./helpers";

/** KPI tiles + source summary: catalog vs. 2026 initial announcement, official links, manual-update note. */
export async function CatalogSummary({ cards, subcategories, tracked, changed, confirmed }: { cards: number; subcategories: number; tracked: number; changed: number; confirmed: number }) {
  const t = await getTranslations("catalog");
  const newTab = t("newTab");
  const links = [
    { href: OFFICIAL_INDEX_URL, label: t("summary.officialIndex") },
    { href: ANNOUNCEMENT_URL, label: t("summary.announcement") },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("stats.cards")} value={cards} icon={LayoutGrid} tone="brand" hint={t("stats.cardsHint", { count: ANNOUNCEMENT_2026.competitions })} />
        <StatCard label={t("stats.subcategories")} value={subcategories} icon={ListTree} tone="info" hint={t("stats.subcategoriesHint", { count: ANNOUNCEMENT_2026.subcategories })} />
        <StatCard label={t("stats.tracked")} value={tracked} icon={Radar} tone={changed > 0 ? "warning" : "info"} hint={t("stats.trackedHint", { count: changed })} />
        <StatCard label={t("stats.confirmed")} value={`${confirmed}/${tracked}`} icon={BadgeCheck} tone="success" target={Math.max(1, tracked)} current={confirmed} hint={t("stats.confirmedHint")} />
      </div>

      <section aria-labelledby="catalog-summary-title" className="rounded-xl border bg-card p-4 shadow-card sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 max-w-3xl space-y-2.5">
            <h2 id="catalog-summary-title" className="text-sm font-semibold">{t("summary.title")}</h2>
            <p className="text-sm text-pretty text-muted-foreground">
              {t("summary.announced", { competitions: ANNOUNCEMENT_2026.competitions, subcategories: ANNOUNCEMENT_2026.subcategories })}{" "}
              {t("summary.catalog", { cards, subcategories })}
            </p>
            <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs font-medium text-warning">
              <Info className="mt-px size-4 shrink-0" aria-hidden />
              <span>{t("summary.notMatched")}</span>
            </p>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <PenLine className="mt-px size-3.5 shrink-0" aria-hidden />
              <span>{t("summary.manual")}</span>
            </p>
          </div>
          <ul className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
            {links.map((l) => (
              <li key={l.href}>
                <Button
                  variant="outline"
                  size="lg"
                  nativeButton={false}
                  className="w-full justify-between gap-2 sm:w-auto lg:w-full"
                  render={<a href={l.href} target="_blank" rel="noopener noreferrer" />}
                >
                  {l.label}
                  <ExternalLink aria-hidden />
                  <span className="sr-only">{newTab}</span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

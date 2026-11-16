"use client";

import { createContext, useContext, useDeferredValue, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { SearchX, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/shared/form";
import { EmptyState } from "@/components/shared/empty-state";
import { folded } from "@/lib/search";
import { RULE_STATUSES, type TrackingFilter } from "./helpers";
import type { CatalogItem } from "./types";

/** Folded search query, shared with the cards (sub-category lists open + highlight while searching). */
const SearchContext = createContext("");
export const useCatalogQuery = () => useContext(SearchContext);

/**
 * Client-side filters over the catalog cards (all cards are on the page, so nothing goes to the URL).
 * Same visual standard as the shared `FilterBar`: labelled 36px controls, search icon, "Clear filters" when active.
 */
export function CatalogBrowser({ items, themes }: { items: CatalogItem[]; themes: { value: string; label: string; count: number }[] }) {
  const t = useTranslations("catalog");
  const te = useTranslations("enums");
  const tf = useTranslations("common.filters");
  const [q, setQ] = useState("");
  const [theme, setTheme] = useState("");
  const [tracking, setTracking] = useState<TrackingFilter>("");
  const query = folded(useDeferredValue(q).trim());

  const visible = useMemo(
    () =>
      items.filter(
        (i) =>
          (!theme || i.theme === theme) &&
          (!tracking ||
            (tracking === "tracked" ? i.status !== null : tracking === "untracked" ? i.status === null : i.status === tracking)) &&
          (!query || i.haystack.includes(query)),
      ),
    [items, theme, tracking, query],
  );
  const filtered = !!(q.trim() || theme || tracking);
  const clear = () => {
    setQ("");
    setTheme("");
    setTracking("");
  };

  return (
    <SearchContext.Provider value={query}>
      <section aria-labelledby="catalog-list-title" className="space-y-4">
        <h2 id="catalog-list-title" className="sr-only">{t("filters.heading")}</h2>
        <div role="search" className="grid grid-cols-2 gap-3 rounded-xl border bg-card p-4 shadow-card sm:items-end lg:flex lg:flex-wrap">
          <div className="col-span-2 grid min-w-0 gap-1.5 lg:min-w-60 lg:flex-1">
            <label htmlFor="catalog-q" className="text-xs font-medium text-muted-foreground">{tf("search")}</label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="catalog-q"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("filters.qPlaceholder")}
                maxLength={80}
                autoComplete="off"
                className="pl-8"
              />
            </div>
          </div>
          <div className="grid min-w-0 gap-1.5 lg:w-64">
            <label htmlFor="catalog-theme" className="text-xs font-medium text-muted-foreground">{t("filters.direction")}</label>
            <NativeSelect id="catalog-theme" value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="">{t("filters.allDirections")}</option>
              {themes.map((o) => (
                <option key={o.value} value={o.value}>{t("filters.option", { label: o.label, count: o.count })}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid min-w-0 gap-1.5 lg:w-48">
            <label htmlFor="catalog-tracking" className="text-xs font-medium text-muted-foreground">{t("filters.tracking")}</label>
            <NativeSelect id="catalog-tracking" value={tracking} onChange={(e) => setTracking(e.target.value as TrackingFilter)}>
              <option value="">{t("filters.allTracking")}</option>
              <option value="tracked">{t("filters.tracked")}</option>
              <option value="untracked">{t("filters.untracked")}</option>
              {RULE_STATUSES.map((s) => (
                <option key={s} value={s}>{te(`RuleStatus.${s}`)}</option>
              ))}
            </NativeSelect>
          </div>
          {filtered && (
            <div className="col-span-2 flex items-center lg:col-span-1">
              <Button type="button" variant="ghost" size="lg" onClick={clear}>
                <X aria-hidden />
                {tf("clear")}
              </Button>
            </div>
          )}
        </div>

        <p role="status" className="tabular text-sm text-muted-foreground">
          {t("filters.results", { count: visible.length, total: items.length })}
        </p>

        {visible.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={t("empty.title")}
            description={t("empty.description")}
            action={<Button variant="outline" size="lg" onClick={clear}>{tf("clear")}</Button>}
          />
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {visible.map((i) => (
              <li key={i.id} className="flex min-w-0">
                {i.node}
              </li>
            ))}
          </ul>
        )}
      </section>
    </SearchContext.Provider>
  );
}

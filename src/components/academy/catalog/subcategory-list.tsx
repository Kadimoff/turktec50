"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { folded } from "@/lib/search";
import { useCatalogQuery } from "./catalog-browser";

/** Expandable sub-category list; opens automatically while a search is active and highlights matching entries. */
export function SubcategoryList({ items }: { items: string[] }) {
  const t = useTranslations("catalog.card");
  const query = useCatalogQuery();
  const searching = query.length > 0;
  const [open, setOpen] = useState(searching);
  // follow the search: open when a search starts, close again when it is cleared (user can still toggle in between)
  const [prevSearching, setPrevSearching] = useState(searching);
  if (prevSearching !== searching) {
    setPrevSearching(searching);
    setOpen(searching);
  }
  const listId = useId();

  if (items.length === 0) return <p className="text-xs text-muted-foreground">{t("noSubcategories")}</p>;

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className="-mx-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform duration-150", open && "rotate-180")} aria-hidden />
        {t("subcategories", { count: items.length })}
      </button>
      <ul id={listId} hidden={!open} className="mt-1 grid gap-1 text-xs sm:grid-cols-2">
        {items.map((s) => {
          const hit = searching && folded(s).includes(query);
          return (
            <li
              key={s}
              className={cn(
                "flex min-w-0 items-start gap-2 rounded-md px-2 py-1 break-words",
                hit ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground",
              )}
            >
              <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-current" />
              <span className="min-w-0">{s}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

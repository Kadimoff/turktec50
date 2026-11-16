"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PANEL_ID, tabId, type RegistryTab } from "./types";

/**
 * URL-driven tabs (`?tab=`): a WAI-ARIA tablist whose tabs are links. Arrow keys / Home / End move focus between tabs
 * (manual activation — Enter follows the link), only the selected tab is in the Tab order.
 */
export function RegistryTabs({ label, tabs, active }: { label: string; tabs: { key: RegistryTab; label: string; count: number; href: string }[]; active: RegistryTab }) {
  const refs = useRef<(HTMLAnchorElement | null)[]>([]);
  const strip = useRef<HTMLDivElement>(null);

  // narrow screens: keep the selected tab visible inside the horizontally scrolling strip (without scrolling the page)
  useEffect(() => {
    const box = strip.current;
    const el = refs.current[tabs.findIndex((x) => x.key === active)];
    if (!box || !el) return;
    if (el.offsetLeft + el.offsetWidth > box.scrollLeft + box.clientWidth || el.offsetLeft < box.scrollLeft) box.scrollLeft = el.offsetLeft - 16;
  }, [active, tabs]);

  function onKeyDown(e: React.KeyboardEvent<HTMLAnchorElement>, i: number) {
    const last = tabs.length - 1;
    const next = e.key === "ArrowRight" ? (i === last ? 0 : i + 1) : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (next === null) return;
    e.preventDefault();
    refs.current[next]?.focus();
  }

  return (
    <div ref={strip} className="relative -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div role="tablist" aria-label={label} className="flex min-w-max gap-1 border-b">
        {tabs.map((tab, i) => {
          const selected = tab.key === active;
          return (
            <Link
              key={tab.key}
              ref={(el) => { refs.current[i] = el; }}
              href={tab.href}
              scroll={false}
              role="tab"
              id={tabId(tab.key)}
              aria-selected={selected}
              aria-controls={selected ? PANEL_ID : undefined}
              tabIndex={selected ? 0 : -1}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "relative inline-flex h-11 items-center gap-1.5 px-2.5 text-sm sm:gap-2 sm:px-3 font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground",
                "focus-visible:rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                selected && "text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary",
              )}
            >
              {tab.label}
              <span className={cn("tabular rounded-full px-1.5 text-xs font-semibold leading-5", selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                {tab.count}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ProjectTab } from "@/lib/rbac";

export function ProjectTabs({ projectId, tabs }: { projectId: string; tabs: ProjectTab[] }) {
  const t = useTranslations("nav.projectTabs");
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  return (
    <nav aria-label="Project sections" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 no-print">
      <ul className="flex min-w-max gap-1 border-b">
        {tabs.map((tab) => {
          const href = tab === "overview" ? base : `${base}/${tab}`;
          const active = tab === "overview" ? pathname === base : pathname.startsWith(href);
          return (
            <li key={tab}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-10 items-center px-3 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground",
                  "focus-visible:rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  active && "text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary",
                )}
              >
                {t(tab)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

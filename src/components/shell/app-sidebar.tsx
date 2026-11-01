"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard, FolderKanban, FileInput, Briefcase, ListChecks, Users, FileCheck2, TriangleAlert, Gavel,
  BarChart3, CalendarDays, UserCog, ScrollText, type LucideIcon,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail,
} from "@/components/ui/sidebar";
import type { NavGroup, NavIcon } from "@/lib/nav";

const icons: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard, project: Briefcase, applications: FileInput, projects: FolderKanban, tasks: ListChecks,
  mentors: Users, documents: FileCheck2, risks: TriangleAlert, jury: Gavel, kpi: BarChart3, calendar: CalendarDays,
  users: UserCog, audit: ScrollText,
};

export function AppSidebar({ groups, week }: { groups: NavGroup[]; week: string }) {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(href + "/"));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 pt-4 pb-2">
        <Link href="/dashboard" className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-[13px] font-extrabold tracking-tight text-sidebar-primary-foreground">
            T50
          </span>
          <span className="min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="block truncate text-sm font-bold tracking-wide text-sidebar-accent-foreground">{tc("appName")}</span>
            <span className="block truncate text-[11px] tracking-wide text-sidebar-foreground/75">{tc("appSubtitle")}</span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.key}>
            <SidebarGroupLabel className="text-[11px] tracking-wide text-sidebar-foreground/70">{t(`groups.${g.key}`)}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => {
                  const Icon = icons[item.icon];
                  const active = isActive(item.href);
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={t(item.key as never)}
                        render={<Link href={item.href} aria-current={active ? "page" : undefined} />}
                        className="h-9 data-active:bg-sidebar-accent data-active:font-semibold data-active:text-sidebar-accent-foreground"
                      >
                        <Icon aria-hidden />
                        <span>{t(item.key as never)}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="px-3 pb-4 group-data-[collapsible=icon]:hidden">
        <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-2.5">
          <p className="text-[11px] tracking-wide text-sidebar-foreground/70">{tc("academy")}</p>
          <p className="mt-1 text-sm font-semibold text-sidebar-accent-foreground">{week}</p>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

import { getLocale, getTranslations } from "next-intl/server";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { LocaleSwitcher, NotificationBell, ThemeToggle, UserMenu } from "@/components/shell/topbar-controls";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { navFor } from "@/lib/nav";
import { currentMonth, currentWeek, PROGRAM } from "@/lib/constants";
import { fmtRelative } from "@/lib/format";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const locale = await getLocale();
  const [t, te, tn] = await Promise.all([getTranslations("common"), getTranslations("enums"), getTranslations("common.notifications")]);

  const [myProject, notifications, unread] = await Promise.all([
    user.role === "TEAM"
      ? prisma.projectMember.findFirst({ where: { userId: user.id }, select: { projectId: true } })
      : Promise.resolve(null),
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ]);

  const week = currentWeek();
  const weekLabel =
    week > 0
      ? `${t("phases." + (["prep", "selection", "dev1", "dev2", "midterm", "final"][currentMonth() - 1] ?? "dev1"))} · ${t("week", { current: week, total: PROGRAM.incubationWeeks })}`
      : t("month", { n: currentMonth() });

  const items = notifications.map((n) => ({
    id: n.id,
    text: (() => {
      try {
        return tn(n.type as never, (n.params ?? {}) as never);
      } catch {
        return n.type;
      }
    })(),
    href: n.href,
    read: n.read,
    when: fmtRelative(n.createdAt, locale),
  }));

  return (
    <SidebarProvider>
      <AppSidebar groups={navFor(user.role, myProject?.projectId, user.isRoot)} week={weekLabel} />
      <SidebarInset className="min-w-0 bg-background">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:px-4 no-print">
          <SidebarTrigger className="-ml-1" />
          <span aria-hidden className="mr-1 h-5 w-px bg-border" />
          <span className="hidden truncate text-xs font-medium text-muted-foreground md:inline">{t("university")}</span>
          <span className="ml-1 hidden rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning lg:inline">
            {t("demoBadge")}
          </span>
          <div className="ml-auto flex items-center gap-0.5">
            <LocaleSwitcher />
            <ThemeToggle />
            <NotificationBell items={items} unread={unread} />
            <span aria-hidden className="mx-1.5 h-5 w-px bg-border" />
            <UserMenu name={user.name} email={user.email} roleLabel={user.title ?? te(`Role.${user.role}`)} />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

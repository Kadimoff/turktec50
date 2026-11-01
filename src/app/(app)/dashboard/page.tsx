import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BarChart3, CalendarDays } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PROGRAM, currentMonth, currentWeek, PHASES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { DemoNote } from "@/components/shared/notice";
import { DeniedNotice } from "@/components/dashboard/denied-notice";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { TeamDashboard } from "@/components/dashboard/team-dashboard";
import { MentorDashboard } from "@/components/dashboard/mentor-dashboard";
import { JuryDashboard } from "@/components/dashboard/jury-dashboard";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("dashboard") };
}

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const denied = sp.denied === "1";
  const [t, tc] = await Promise.all([getTranslations("dashboard"), getTranslations("common")]);

  const week = currentWeek();
  const phase = PHASES[currentMonth() - 1]?.key ?? "prep";
  const eyebrow = [tc(`phases.${phase}`), week > 0 ? tc("week", { current: week, total: PROGRAM.incubationWeeks }) : tc("month", { n: currentMonth() })].join(" · ");
  const firstName = user.name.split(/\s+/).find((w) => !w.endsWith(".")) ?? user.name;

  return (
    <div className="space-y-6">
      {denied && <DeniedNotice />}
      <PageHeader
        eyebrow={eyebrow}
        title={t("welcome", { name: firstName })}
        description={t(`intro.${user.role}`)}
        actions={
          <>
            {user.role === "ADMIN" && (
              <Link href="/kpi" className={cn(buttonVariants({ variant: "default", size: "lg" }), "h-10 px-3")}>
                <BarChart3 aria-hidden />
                {t("actions.kpi")}
              </Link>
            )}
            <Link href="/calendar" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-3")}>
              <CalendarDays aria-hidden />
              {t("actions.calendar")}
            </Link>
          </>
        }
      />
      {user.role === "ADMIN" && <AdminDashboard />}
      {user.role === "TEAM" && <TeamDashboard user={user} />}
      {user.role === "MENTOR" && <MentorDashboard user={user} />}
      {user.role === "JURY" && <JuryDashboard user={user} />}
      <DemoNote />
    </div>
  );
}

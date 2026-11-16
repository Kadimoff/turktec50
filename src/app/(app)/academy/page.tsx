import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarClock, FileStack, GraduationCap, Inbox, Package, Presentation, Trophy, UsersRound, type LucideIcon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { fmtDay, fmtDate } from "@/lib/format";
import type { Tone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EnumBadge } from "@/components/shared/enum-badge";
import { DemoNote } from "@/components/shared/notice";
import { DueText, MiniEmpty, Panel, PanelLink, ProjectCode, RowLink } from "@/components/dashboard/parts";
import { DEADLINE_WINDOW_DAYS, getAcademyOverview } from "@/components/academy/overview/data";
import { AcademyStrategy } from "@/components/academy/overview/strategy";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("academy") };
}

export default async function AcademyOverviewPage() {
  await requireUser(["ADMIN"]);
  const now = new Date();
  const [t, tc, locale, d] = await Promise.all([getTranslations("academy"), getTranslations("common"), getLocale(), getAcademyOverview(now)]);

  // 7 tiles: the intake inbox is double-width so every breakpoint fills whole rows (2 → 4×2, 3 → 3+3+3, 4 → 2+2 / 4)
  const tiles: { key: string; href: string; icon: LucideIcon; tone: Tone; value: number; hint: string; className?: string }[] = [
    {
      key: "intake", href: "/academy/intake", icon: Inbox, tone: d.intake.submitted > 0 ? "warning" : "success", value: d.intake.submitted,
      hint: t("stats.intakeHint", { review: d.intake.review, changes: d.intake.changes }), className: "col-span-2 lg:col-span-3 xl:col-span-2",
    },
    {
      key: "students", href: "/academy/students", icon: GraduationCap, tone: "brand", value: d.students.total,
      hint: t("stats.studentsHint", { count: d.students.seeking }),
    },
    {
      key: "teams", href: "/academy/teams", icon: UsersRound, tone: "info", value: d.teams.total,
      hint: t("stats.teamsHint", { active: d.teams.active, forming: d.teams.forming }),
    },
    {
      key: "applications", href: "/applications", icon: FileStack, tone: "brand", value: d.applications.total,
      hint: t("stats.applicationsHint", { pending: d.applications.pending, accepted: d.applications.accepted }),
    },
    {
      key: "competitions", href: "/academy/catalog", icon: Trophy, tone: d.competitions.changed > 0 ? "warning" : "success", value: d.competitions.tracked,
      hint: t("stats.competitionsHint", { count: d.competitions.changed }),
    },
    {
      key: "trainings", href: "/academy/trainings", icon: Presentation, tone: "info", value: d.trainings.upcoming,
      hint: d.trainings.next ? t("stats.trainingsNext", { date: fmtDay(d.trainings.next.startsAt, locale) }) : t("stats.trainingsNone"),
    },
    {
      key: "requests", href: "#open-requests", icon: Package, tone: d.requests.open > 0 ? "warning" : "success", value: d.requests.open,
      hint: t("stats.requestsHint", { fresh: d.requests.new, review: d.requests.review }),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />

      <section aria-labelledby="academy-stats-title">
        <h2 id="academy-stats-title" className="sr-only">{t("stats.title")}</h2>
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {tiles.map((x) => (
            <li key={x.key} className={cn("min-w-0", x.className)}>
              <Link href={x.href} className="group block h-full rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                <StatCard className="h-full transition-colors group-hover:border-primary/40" label={t(`stats.${x.key}` as never)} value={x.value} icon={x.icon} tone={x.tone} hint={x.hint} />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          id="deadlines"
          title={t("deadlines.title")}
          subtitle={t("deadlines.subtitle", { days: DEADLINE_WINDOW_DAYS })}
          action={<PanelLink href="/academy/catalog">{t("deadlines.catalog")}</PanelLink>}
        >
          {d.deadlines.length === 0 ? (
            <MiniEmpty>{t("deadlines.empty", { days: DEADLINE_WINDOW_DAYS })}</MiniEmpty>
          ) : (
            <ul>
              {d.deadlines.map((c) => (
                <RowLink
                  key={c.id}
                  href="/academy/catalog"
                  meta={
                    <>
                      <DueText d={c.applicationDeadline} tc={tc} locale={locale} />
                      <EnumBadge enumName="RuleStatus" value={c.ruleStatus!} />
                    </>
                  }
                >
                  <p className="line-clamp-2 text-sm font-medium text-pretty">{c.name}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {[
                      fmtDate(c.applicationDeadline, locale),
                      c.theme && tc.has(`directions.${c.theme}` as never) ? tc(`directions.${c.theme}` as never) : null,
                      c._count.teams > 0 ? t("deadlines.teams", { count: c._count.teams }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {c.ruleStatus !== "CONFIRMED" && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-warning">
                      <CalendarClock className="size-3.5 shrink-0" aria-hidden />
                      {t("deadlines.notConfirmed")}
                    </p>
                  )}
                </RowLink>
              ))}
            </ul>
          )}
        </Panel>

        <Panel id="open-requests" title={t("requests.title")} subtitle={t("requests.subtitle", { count: d.requests.open })} className="scroll-mt-24">
          {d.openRequests.length === 0 ? (
            <MiniEmpty>{t("requests.empty")}</MiniEmpty>
          ) : (
            <>
              <ul>
                {d.openRequests.map((r) => (
                  <RowLink
                    key={r.id}
                    href={`/projects/${r.project.id}/resources#rr-${r.id}`}
                    meta={
                      <>
                        <EnumBadge enumName="ResourceStatus" value={r.status} />
                        {r.neededBy ? <DueText d={r.neededBy} tc={tc} locale={locale} /> : <span className="text-xs text-muted-foreground">{t("requests.noDate")}</span>}
                      </>
                    }
                  >
                    <p className="line-clamp-2 text-sm font-medium text-pretty">{r.title}</p>
                    <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <ProjectCode>{r.project.code}</ProjectCode>
                      <span className="truncate">{r.project.title}</span>
                    </p>
                  </RowLink>
                ))}
              </ul>
              {d.requests.open > d.openRequests.length && (
                <p className="mt-2 text-xs text-muted-foreground">{t("requests.more", { count: d.requests.open - d.openRequests.length })}</p>
              )}
            </>
          )}
        </Panel>
      </div>

      <AcademyStrategy />

      <DemoNote />
    </div>
  );
}

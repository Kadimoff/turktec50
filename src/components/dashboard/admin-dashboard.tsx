import Link from "next/link";
import { addDays, format } from "date-fns";
import { getLocale, getTranslations } from "next-intl/server";
import {
  BadgeCheck, CalendarClock, ClipboardCheck, Cpu, FileX2, FolderClock, Gavel, ShieldAlert, Trophy, TriangleAlert, Users,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getProgramKpis } from "@/lib/kpi";
import { PROGRAM, currentWeek } from "@/lib/constants";
import { fmtDateTime, fmtDay, fmtRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/shared/stat-card";
import { EnumBadge } from "@/components/shared/enum-badge";
import { ToneBadge } from "@/components/shared/tone-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { HumanControlNote } from "@/components/shared/notice";
import { DayChip, MiniEmpty, Panel, PanelLink, ProjectCode, RowLink } from "./parts";
import { ProgramTimeline } from "./program-timeline";
import { PortfolioHealth } from "./portfolio-health";
import { getFallbackLabels } from "./labels";
import { daysUntil, programMilestones, weekStart } from "@/components/calendar/program";
import type { Tone } from "@/lib/tones";

const OPEN_SESSION = ["PLANNED", "CONFIRMED"] as const;

export async function AdminDashboard() {
  const now = new Date();
  const in7 = addDays(now, 7);
  // current program week window (falls back to the calendar week outside incubation)
  const cw = currentWeek(now);
  const wkStart = cw > 0 ? addDays(PROGRAM.incubationStart, (cw - 1) * 7) : weekStart(now);
  const wk = { start: wkStart, end: addDays(wkStart, 7) };
  const [t, tc, te, locale, labels] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("common"),
    getTranslations("enums"),
    getLocale(),
    getFallbackLabels(),
  ]);

  const overdueWhere = { dueDate: { lt: now }, status: { not: "DONE" as const } };
  const highRiskWhere = {
    status: { not: "CLOSED" as const },
    OR: [{ probability: "HIGH" as const }, { impact: "HIGH" as const }],
  };

  const [
    kpis, stageGroups, healthGroups, atRisk, overdueGroups, overdueTotal, rejected, rejectedTotal, risks, risksTotal,
    sessions, sessionsTotal, deadlines, logs, appGroups, weekDone, weekDue, weekSessions, mentoringMin,
  ] = await Promise.all([
    getProgramKpis(),
    prisma.project.groupBy({ by: ["stage"], _count: { _all: true } }),
    prisma.project.groupBy({ by: ["health"], _count: { _all: true } }),
    prisma.project.findMany({
      where: { health: "AT_RISK" },
      select: { id: true, code: true, title: true, stage: true, university: { select: { shortName: true } } },
      orderBy: { updatedAt: "desc" },
      take: 4,
    }),
    prisma.task.groupBy({
      by: ["projectId"],
      where: overdueWhere,
      _count: { _all: true },
      orderBy: { _count: { projectId: "desc" } },
      take: 4,
    }),
    prisma.task.count({ where: overdueWhere }),
    prisma.checklistItem.findMany({
      where: { status: "REJECTED" },
      select: { id: true, key: true, title: true, reviewedAt: true, project: { select: { id: true, code: true, title: true } } },
      orderBy: { updatedAt: "desc" },
      take: 4,
    }),
    prisma.checklistItem.count({ where: { status: "REJECTED" } }),
    prisma.risk.findMany({
      where: highRiskWhere,
      select: { id: true, title: true, probability: true, impact: true, project: { select: { id: true, code: true } } },
      orderBy: [{ updatedAt: "desc" }],
      take: 4,
    }),
    prisma.risk.count({ where: highRiskWhere }),
    prisma.mentorSession.findMany({
      where: { scheduledAt: { gte: now, lte: in7 }, status: { in: [...OPEN_SESSION] } },
      select: {
        id: true, scheduledAt: true, topic: true, status: true, online: true,
        project: { select: { id: true, code: true } }, mentor: { select: { name: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 6,
    }),
    prisma.mentorSession.count({ where: { scheduledAt: { gte: now, lte: in7 }, status: { in: [...OPEN_SESSION] } } }),
    prisma.competition.findMany({
      where: { applicationDeadline: { gte: now, lte: addDays(now, 30) } },
      select: { id: true, name: true, applicationDeadline: true, _count: { select: { projects: true } } },
      orderBy: { applicationDeadline: "asc" },
      take: 3,
    }),
    prisma.auditLog.findMany({
      where: { NOT: { action: { startsWith: "auth." } } },
      select: {
        id: true, action: true, summary: true, createdAt: true, projectId: true,
        actor: { select: { name: true } }, project: { select: { code: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.application.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.task.count({ where: { completedAt: { gte: wk.start, lt: wk.end } } }),
    prisma.task.count({ where: { dueDate: { gte: wk.start, lt: wk.end }, status: { not: "DONE" } } }),
    prisma.mentorSession.count({ where: { scheduledAt: { gte: wk.start, lt: wk.end }, status: { not: "CANCELLED" } } }),
    prisma.mentorSession.aggregate({ where: { status: "COMPLETED" }, _sum: { durationMin: true } }),
  ]);

  const overdueProjects = overdueGroups.length
    ? await prisma.project.findMany({
        where: { id: { in: overdueGroups.map((g) => g.projectId) } },
        select: { id: true, code: true, title: true },
      })
    : [];
  const overdueRows = overdueGroups
    .map((g) => ({ project: overdueProjects.find((p) => p.id === g.projectId), count: g._count._all }))
    .filter((r) => r.project);

  const stages = Object.fromEntries(stageGroups.map((g) => [g.stage, g._count._all]));
  const health = { ON_TRACK: 0, WATCH: 0, AT_RISK: 0 } as Record<"ON_TRACK" | "WATCH" | "AT_RISK", number>;
  for (const g of healthGroups) health[g.health] = g._count._all;
  const apps = Object.fromEntries(appGroups.map((g) => [g.status, g._count._all])) as Record<string, number>;
  const appsTotal = Object.values(apps).reduce((a, b) => a + b, 0);

  const T = kpis.targets;
  const tiles = [
    { k: "applicationsEvaluated", v: kpis.applicationsEvaluated, target: T.applicationsEvaluated, icon: ClipboardCheck, href: "/applications" },
    { k: "teamsAccepted", v: kpis.teamsAccepted, target: T.teamsAccepted, icon: Users, href: "/projects" },
    { k: "prototypes", v: kpis.prototypes, target: T.prototypes, icon: Cpu, href: "/projects" },
    { k: "qcPackages", v: kpis.qcPackages, target: T.qcPackages, icon: BadgeCheck, href: "/documents" },
    { k: "finalists", v: kpis.finalists, target: T.finalists, icon: Trophy, href: "/kpi" },
  ] as const;

  // Upcoming 7 days: sessions + deadlines + program milestones in range
  const milestoneItems = programMilestones().filter((m) => m.date >= now && m.date <= in7);
  type Up = { id: string; date: Date; title: string; sub: string; href: string; tone: Tone; kind: string };
  const upcoming: Up[] = [
    ...sessions.map((s) => ({
      id: s.id, date: s.scheduledAt, title: s.topic, sub: `${s.project.code} · ${s.mentor.name}`,
      href: `/projects/${s.project.id}/sessions`, tone: "info" as Tone, kind: t("upcoming.session"),
    })),
    ...milestoneItems.map((m) => ({
      id: m.key, date: m.date, title: t(`timeline.milestones.${m.key}`), sub: t("upcoming.programMilestone"),
      href: "/calendar", tone: "brand" as Tone, kind: t("upcoming.milestone"),
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const appStatuses = ["UNDER_REVIEW", "ACCEPTED", "WAITLIST", "REJECTED"] as const;
  const appTone: Record<string, string> = { UNDER_REVIEW: "bg-info", ACCEPTED: "bg-success", WAITLIST: "bg-warning", REJECTED: "bg-neutral" };

  return (
    <div className="space-y-6">
      <section aria-labelledby="kpi-row-title">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="kpi-row-title" className="text-sm font-semibold">{t("kpis.title")}</h2>
          <PanelLink href="/kpi">{t("kpis.report")}</PanelLink>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
          {tiles.map((x) => {
            const pct = Math.round((x.v / x.target) * 100);
            const tone: Tone = pct >= 100 ? "success" : pct >= 50 ? "brand" : x.k === "finalists" ? "info" : "warning";
            return (
              <Link key={x.k} href={x.href} className={cn("group min-w-0 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", x.k === "finalists" && "col-span-2 lg:col-span-1")}>
                <StatCard
                  className="h-full transition-colors group-hover:border-primary/40"
                  label={t(`kpis.${x.k}`)}
                  icon={x.icon}
                  tone={tone}
                  value={
                    <>
                      {x.v}
                      <span className="ml-1 text-base font-semibold text-muted-foreground">/ {x.target}</span>
                    </>
                  }
                  target={x.target}
                  current={x.v}
                  hint={
                    x.k === "finalists"
                      ? t("kpis.finalistsHint", { pilot: T.finalists, scale: T.finalistsScale })
                      : x.k === "applicationsEvaluated"
                        ? t("kpis.evaluatedHint", { pct, total: kpis.applicationsTotal })
                        : t("kpis.pctOfTarget", { pct })
                  }
                />
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel id="timeline" title={t("timeline.title")} subtitle={t("timeline.subtitle")} className="xl:col-span-2" action={<PanelLink href="/calendar">{t("timeline.calendar")}</PanelLink>}>
          <ProgramTimeline>
            <div className="border-t pt-4">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">
                {t("pulse.title", { range: `${fmtDay(wk.start, locale)} – ${fmtDay(addDays(wk.end, -1), locale)}` })}
              </h3>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                {[
                  { k: "done", v: weekDone, href: "/tasks" },
                  { k: "due", v: weekDue, href: "/tasks" },
                  { k: "sessions", v: weekSessions, href: "/calendar" },
                  { k: "hours", v: Math.round((mentoringMin._sum.durationMin ?? 0) / 60), href: "/kpi#mentoring" },
                ].map((m) => (
                  <div key={m.k} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{t(`pulse.${m.k}`)}</dt>
                    <dd className="mt-0.5 text-xl font-bold">
                      <Link href={m.href} className="hover:underline focus-visible:underline focus-visible:outline-none">{m.v}</Link>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </ProgramTimeline>
        </Panel>
        <Panel id="health" title={t("health.title")} subtitle={t("health.subtitle", { count: kpis.teamsAccepted })} action={<PanelLink href="/projects">{t("health.viewProjects")}</PanelLink>}>
          <PortfolioHealth stages={stages} health={health} />
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel id="attention" title={t("attention.title")} subtitle={t("attention.subtitle")} className="xl:col-span-2">
          <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
            <AttentionBlock icon={TriangleAlert} tone="danger" title={t("attention.atRisk")} count={health.AT_RISK} href="/projects?health=AT_RISK" more={t("attention.viewAll")}>
              {atRisk.length === 0 ? (
                <MiniEmpty>{t("attention.none")}</MiniEmpty>
              ) : (
                <ul>
                  {atRisk.map((p) => (
                    <RowLink key={p.id} href={`/projects/${p.id}`} meta={<EnumBadge enumName="ProjectStage" value={p.stage} />}>
                      <p className="truncate text-sm font-medium">{p.title}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ProjectCode>{p.code}</ProjectCode>
                        <span className="truncate">{p.university.shortName}</span>
                      </p>
                    </RowLink>
                  ))}
                </ul>
              )}
            </AttentionBlock>

            <AttentionBlock icon={FolderClock} tone="warning" title={t("attention.overdue")} count={overdueTotal} href="/tasks" more={t("attention.viewAll")}>
              {overdueRows.length === 0 ? (
                <MiniEmpty>{t("attention.none")}</MiniEmpty>
              ) : (
                <ul>
                  {overdueRows.map((r) => (
                    <RowLink
                      key={r.project!.id}
                      href={`/projects/${r.project!.id}/tasks`}
                      meta={<span className="tabular text-xs font-semibold text-danger">{t("attention.overdueCount", { count: r.count })}</span>}
                    >
                      <p className="truncate text-sm font-medium">{r.project!.title}</p>
                      <p className="mt-0.5"><ProjectCode>{r.project!.code}</ProjectCode></p>
                    </RowLink>
                  ))}
                </ul>
              )}
            </AttentionBlock>

            <AttentionBlock icon={FileX2} tone="danger" title={t("attention.rejected")} count={rejectedTotal} href="/documents" more={t("attention.viewAll")}>
              {rejected.length === 0 ? (
                <MiniEmpty>{t("attention.none")}</MiniEmpty>
              ) : (
                <ul>
                  {rejected.map((c) => (
                    <RowLink
                      key={c.id}
                      href={`/projects/${c.project.id}/documents`}
                      meta={c.reviewedAt ? <span className="text-xs text-muted-foreground">{fmtRelative(c.reviewedAt, locale)}</span> : undefined}
                    >
                      <p className="truncate text-sm font-medium">{labels.checklistItem(c)}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ProjectCode>{c.project.code}</ProjectCode>
                        <span className="truncate">{c.project.title}</span>
                      </p>
                    </RowLink>
                  ))}
                </ul>
              )}
            </AttentionBlock>

            <AttentionBlock icon={ShieldAlert} tone="danger" title={t("attention.highRisks")} count={risksTotal} href="/risks" more={t("attention.viewAll")}>
              {risks.length === 0 ? (
                <MiniEmpty>{t("attention.none")}</MiniEmpty>
              ) : (
                <ul>
                  {risks.map((r) => (
                    <RowLink
                      key={r.id}
                      href={r.project ? `/projects/${r.project.id}/risks` : "/risks"}
                      meta={
                        <span className="flex gap-1">
                          <ToneBadge tone={r.probability === "HIGH" ? "danger" : "warning"} dot={false} className="px-1.5 text-[11px]">
                            {t("attention.probShort")} {te(`RiskLevel.${r.probability}`)}
                          </ToneBadge>
                          <ToneBadge tone={r.impact === "HIGH" ? "danger" : "warning"} dot={false} className="hidden px-1.5 text-[11px] sm:inline-flex">
                            {t("attention.impactShort")} {te(`RiskLevel.${r.impact}`)}
                          </ToneBadge>
                        </span>
                      }
                    >
                      <p className="truncate text-sm font-medium">{r.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {r.project ? <ProjectCode>{r.project.code}</ProjectCode> : t("attention.programRisk")}
                      </p>
                    </RowLink>
                  ))}
                </ul>
              )}
            </AttentionBlock>
          </div>
        </Panel>

        <Panel
          id="upcoming"
          title={t("upcoming.title")}
          subtitle={t("upcoming.subtitle", { count: sessionsTotal })}
          action={<PanelLink href="/calendar">{t("upcoming.calendar")}</PanelLink>}
        >
          {upcoming.length === 0 && deadlines.length === 0 ? (
            <MiniEmpty>{t("upcoming.empty")}</MiniEmpty>
          ) : (
            <>
              <ul>
                {upcoming.map((u) => (
                  <RowLink key={u.id} href={u.href}>
                    <div className="flex items-center gap-3">
                      <DayChip date={u.date} locale={locale} highlight={u.tone === "brand"} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{u.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          <span className="tabular">{format(u.date, "HH:mm")}</span> · {u.sub}
                        </p>
                      </div>
                    </div>
                  </RowLink>
                ))}
              </ul>
              {sessionsTotal > sessions.length && (
                <p className="mt-1 text-xs text-muted-foreground">{t("upcoming.more", { count: sessionsTotal - sessions.length })}</p>
              )}
              {deadlines.length > 0 && (
                <div className="mt-4 border-t pt-3">
                  <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">{t("upcoming.deadlines")}</h3>
                  <ul className="mt-1">
                    {deadlines.map((c) => {
                      const left = daysUntil(c.applicationDeadline);
                      return (
                        <RowLink
                          key={c.id}
                          href="/calendar#competitions"
                          meta={<span className={cn("tabular text-xs font-semibold", left <= 14 ? "text-danger" : "text-warning")}>{tc("daysLeft", { count: left })}</span>}
                        >
                          <p className="truncate text-sm font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {fmtDay(c.applicationDeadline, locale)} · {t("upcoming.teams", { count: c._count.projects })}
                          </p>
                        </RowLink>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel id="activity" title={t("activity.title")} subtitle={t("activity.subtitle")} className="xl:col-span-2" action={<PanelLink href="/admin/audit">{t("activity.viewAll")}</PanelLink>}>
          {logs.length === 0 ? (
            <MiniEmpty>{t("activity.empty")}</MiniEmpty>
          ) : (
            <ol className="divide-y">
              {logs.map((l) => {
                const inner = (
                  <>
                    <UserAvatar name={l.actor?.name ?? "—"} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{l.actor?.name ?? t("activity.system")}</span>
                        <span className="text-muted-foreground"> · {labels.action(l.action)}</span>
                      </p>
                      {(l.summary || l.project) && (
                        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                          {l.project && <ProjectCode>{l.project.code}</ProjectCode>}
                          {l.summary && <span className="truncate">{l.summary}</span>}
                        </p>
                      )}
                    </div>
                    <time dateTime={l.createdAt.toISOString()} className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
                      {l.createdAt > now ? fmtDateTime(l.createdAt, locale) : fmtRelative(l.createdAt, locale)}
                    </time>
                  </>
                );
                return (
                  <li key={l.id}>
                    {l.projectId ? (
                      <Link
                        href={`/projects/${l.projectId}/activity`}
                        className="-mx-2 flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <div className="flex min-h-11 items-center gap-3 py-2">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>

        <Panel id="selection" title={t("selection.title")} subtitle={t("selection.subtitle", { count: appsTotal })} action={<PanelLink href="/applications">{t("selection.open")}</PanelLink>}>
          <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
            {appStatuses.map((s) =>
              apps[s] ? <div key={s} className={cn("h-full", appTone[s])} style={{ width: `${(apps[s]! / (appsTotal || 1)) * 100}%` }} /> : null,
            )}
          </div>
          <ul className="mt-3 space-y-0.5">
            {appStatuses.map((s) => (
              <li key={s}>
                <Link
                  href={`/applications?status=${s}`}
                  className="-mx-2 flex min-h-9 items-center gap-2.5 rounded-md px-2 text-sm transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span aria-hidden className={cn("size-2.5 rounded-sm", appTone[s])} />
                  <span className="flex-1">{te(`ApplicationStatus.${s}`)}</span>
                  <span className="tabular font-semibold">{apps[s] ?? 0}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-lg bg-muted/60 px-3 py-2.5">
            <p className="flex items-center gap-2 text-xs font-semibold">
              <Gavel className="size-3.5 text-primary" aria-hidden />
              {t("selection.midterm")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              <CalendarClock className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
              {fmtDay(PROGRAM.midtermJury, locale)} · {tc("daysLeft", { count: Math.max(0, daysUntil(PROGRAM.midtermJury)) })}
            </p>
          </div>
          <HumanControlNote className="mt-3" />
        </Panel>
      </div>
    </div>
  );
}

function AttentionBlock({
  icon: Icon,
  tone,
  title,
  count,
  href,
  more,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "danger" | "warning";
  title: string;
  count: number;
  href: string;
  more: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-2">
        <span className={cn("grid size-6 place-items-center rounded-md", tone === "danger" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning")} aria-hidden>
          <Icon className="size-3.5" />
        </span>
        <h3 className="flex-1 text-[13px] font-semibold">
          {title}
          <span className="tabular ml-1.5 text-muted-foreground">{count}</span>
        </h3>
        <PanelLink href={href}>{more}</PanelLink>
      </div>
      {children}
    </div>
  );
}

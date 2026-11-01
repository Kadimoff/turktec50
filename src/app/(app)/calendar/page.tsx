import { addDays, startOfDay } from "date-fns";
import { getLocale, getTranslations } from "next-intl/server";
import { ExternalLink, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/rbac";
import { PHASES, PROGRAM, currentMonth, currentWeek } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { ToneBadge } from "@/components/shared/tone-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Panel } from "@/components/dashboard/parts";
import { ProgramTimeline } from "@/components/dashboard/program-timeline";
import { Agenda, type AgendaItem } from "@/components/calendar/agenda";
import { daysUntil, incubationWeeks, programMilestones, rangeLabel } from "@/components/calendar/program";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("calendar") };
}


export default async function CalendarPage() {
  const user = await requireUser();
  const [t, tc, te, locale] = await Promise.all([getTranslations("calendar"), getTranslations("common"), getTranslations("enums"), getLocale()]);
  const now = new Date();
  // Jury has no sessions/tasks: look further ahead so the midterm jury and deadlines are visible.
  const HORIZON = user.role === "JURY" ? 45 : 21;
  const until = addDays(startOfDay(now), HORIZON + 1);
  const scope = projectScope(user);
  const isAdmin = user.role === "ADMIN";
  const seesWork = user.role !== "JURY"; // jury has no access to sessions / tasks

  const [competitions, myCompetitionIds, sessions, tasks, overdueTasks, taskDays] = await Promise.all([
    prisma.competition.findMany({
      select: {
        id: true, name: true, organizer: true, category: true, country: true, applicationDeadline: true, finalDate: true, url: true,
        _count: { select: { projects: true } },
      },
      orderBy: { applicationDeadline: "asc" },
    }),
    user.role === "ADMIN"
      ? Promise.resolve([] as { competitionId: string | null }[])
      : prisma.project.findMany({ where: scope, select: { competitionId: true } }),
    seesWork
      ? prisma.mentorSession.findMany({
          where: {
            project: scope,
            scheduledAt: { gte: now, lt: until },
            status: { in: ["PLANNED", "CONFIRMED"] },
            ...(user.role === "MENTOR" ? { mentorId: user.id } : {}),
          },
          select: { id: true, topic: true, scheduledAt: true, status: true, durationMin: true, project: { select: { id: true, code: true } }, mentor: { select: { name: true } } },
          orderBy: { scheduledAt: "asc" },
          take: isAdmin ? 400 : 60,
        })
      : Promise.resolve([]),
    seesWork && !isAdmin
      ? prisma.task.findMany({
          where: {
            project: scope,
            status: { not: "DONE" },
            dueDate: { gte: now, lt: until },
          },
          select: { id: true, title: true, dueDate: true, priority: true, assigneeId: true, assignee: { select: { name: true } }, project: { select: { id: true, code: true } } },
          orderBy: { dueDate: "asc" },
          take: 80,
        })
      : Promise.resolve([]),
    seesWork && !isAdmin
      ? prisma.task.count({ where: { project: scope, status: { not: "DONE" }, dueDate: { lt: now } } })
      : Promise.resolve(0),
    // Coordinator: aggregate due tasks per day instead of listing hundreds of rows
    isAdmin
      ? prisma.task.findMany({ where: { status: { not: "DONE" }, dueDate: { gte: now, lt: until } }, select: { dueDate: true, priority: true } })
      : Promise.resolve([]),
  ]);

  const mine = new Set(myCompetitionIds.map((p) => p.competitionId).filter(Boolean));

  const items: AgendaItem[] = [];
  if (isAdmin) {
    // Coordinator: one line per day instead of dozens of sessions
    const byDay = new Map<string, { date: Date; codes: string[]; confirmed: number }>();
    for (const s of sessions) {
      const key = startOfDay(s.scheduledAt).toISOString();
      const cur = byDay.get(key) ?? { date: s.scheduledAt, codes: [], confirmed: 0 };
      cur.codes.push(s.project.code);
      if (s.status === "CONFIRMED") cur.confirmed++;
      byDay.set(key, cur);
    }
    for (const [key, v] of byDay) {
      items.push({
        id: `sg-${key}`, kind: "sessionGroup", date: v.date, title: t("sessionsCount", { count: v.codes.length }),
        sub: v.codes.slice(0, 4).join(", ") + (v.codes.length > 4 ? ` +${v.codes.length - 4}` : ""),
        href: "/mentors",
        badge: <ToneBadge tone="info">{t("confirmedOf", { a: v.confirmed, b: v.codes.length })}</ToneBadge>,
      });
    }
  } else {
    for (const s of sessions) {
      items.push({
        id: `s-${s.id}`, kind: "session", date: s.scheduledAt, timed: true, title: s.topic,
        sub: `${s.project.code} · ${s.mentor.name} · ${t("minutes", { count: s.durationMin })}`,
        href: `/projects/${s.project.id}/sessions`,
        badge: <ToneBadge tone={s.status === "CONFIRMED" ? "info" : "warning"}>{te(`SessionStatus.${s.status}`)}</ToneBadge>,
      });
    }
  }
  for (const k of tasks) {
    items.push({
      id: `t-${k.id}`, kind: "task", date: k.dueDate, title: k.title,
      sub: [k.project.code, k.assignee?.name ?? t("unassigned")].join(" · "),
      href: `/projects/${k.project.id}/tasks?task=${k.id}`,
      badge: k.assigneeId === user.id ? <ToneBadge tone="brand">{t("mine")}</ToneBadge> : k.priority === "HIGH" ? <ToneBadge tone="danger">{te("Priority.HIGH")}</ToneBadge> : undefined,
    });
  }
  if (isAdmin) {
    const byDay = new Map<string, { date: Date; n: number; high: number }>();
    for (const k of taskDays) {
      const key = startOfDay(k.dueDate).toISOString();
      const cur = byDay.get(key) ?? { date: startOfDay(k.dueDate), n: 0, high: 0 };
      cur.n++;
      if (k.priority === "HIGH") cur.high++;
      byDay.set(key, cur);
    }
    for (const [key, v] of byDay) {
      items.push({
        id: `tg-${key}`, kind: "taskGroup", date: v.date, title: t("tasksDue", { count: v.n }),
        sub: v.high ? t("highPriority", { count: v.high }) : t("allProjects"), href: "/tasks",
      });
    }
  }
  for (const c of competitions) {
    if (c.applicationDeadline >= now && c.applicationDeadline < until) {
      items.push({
        id: `c-${c.id}`, kind: "deadline", date: c.applicationDeadline, title: t("deadlineOf", { name: c.name }), sub: c.organizer, href: "#competitions",
        badge: mine.has(c.id) ? <ToneBadge tone="brand">{t("yourCompetition")}</ToneBadge> : undefined,
      });
    }
  }
  for (const m of programMilestones()) {
    if (m.date >= now && m.date < until) {
      items.push({ id: `m-${m.key}`, kind: "milestone", date: m.date, title: t(`milestones.${m.key}`), sub: tc("appName"), href: "#milestones" });
    }
  }

  const week = currentWeek();
  const phase = PHASES[currentMonth() - 1]?.key ?? "prep";
  const weeks = incubationWeeks();
  const sortedComps = [...competitions].sort((a, b) => Number(b.applicationDeadline >= now) - Number(a.applicationDeadline >= now) || a.applicationDeadline.getTime() - b.applicationDeadline.getTime());

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={[tc(`phases.${phase}`), week > 0 ? tc("week", { current: week, total: PROGRAM.incubationWeeks }) : null].filter(Boolean).join(" · ")}
        title={t("title")}
        description={t(`description.${user.role}`)}
      />

      <Panel id="program" title={t("program.title")} subtitle={t("program.subtitle", { start: fmtDate(PROGRAM.start, locale), end: fmtDate(PROGRAM.end, locale) })}>
        <ProgramTimeline />
      </Panel>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          id="agenda"
          className="xl:col-span-2"
          title={t("agenda.title", { days: HORIZON })}
          subtitle={t(`agenda.subtitle.${user.role}`)}
        >
          {overdueTasks > 0 && (
            <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-xs font-medium text-danger" role="status">
              {t("overdueNote", { count: overdueTasks })}
            </p>
          )}
          <Agenda items={items} emptyText={t("agenda.empty")} />
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground" aria-label={t("legend")}>
            {([...(isAdmin ? ["sessionGroup", "taskGroup"] : seesWork ? ["session", "task"] : []), "deadline", "milestone"] as const).map((k) => (
              <li key={k} className="flex items-center gap-1.5">
                <span aria-hidden className={cn("size-2.5 rounded-sm", k === "session" || k === "sessionGroup" ? "bg-info" : k === "deadline" ? "bg-warning" : k === "milestone" ? "bg-primary" : "bg-neutral")} />
                {t(`kinds.${k}`)}
              </li>
            ))}
          </ul>
        </Panel>

        <div className="space-y-6">
          <Panel id="milestones" title={t("milestonesTitle")}>
            <ol className="relative space-y-3 border-l pl-4">
              {programMilestones().map((m) => {
                const left = daysUntil(m.date);
                const past = left < 0;
                return (
                  <li key={m.key} className="relative">
                    <span
                      aria-hidden
                      className={cn("absolute top-1.5 -left-[21px] size-2.5 rounded-full ring-4 ring-card", past ? "bg-muted-foreground/40" : left <= 30 ? "bg-warning" : "bg-primary")}
                    />
                    <p className={cn("text-sm font-medium", past && "text-muted-foreground")}>{t(`milestones.${m.key}`)}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(m.date, locale)} ·{" "}
                      <span className={cn("tabular", !past && left <= 30 && "font-semibold text-warning")}>
                        {past ? t("passed") : left === 0 ? tc("today") : tc("daysLeft", { count: left })}
                      </span>
                    </p>
                  </li>
                );
              })}
            </ol>
          </Panel>

          <Panel id="weeks" title={t("weeksTitle", { n: PROGRAM.incubationWeeks })}>
            <ol className="divide-y text-sm">
              {weeks.map((w) => (
                <li key={w.week} aria-current={w.state === "current" ? "true" : undefined} className={cn("flex items-center gap-3 py-2", w.state === "current" && "-mx-2 rounded-lg bg-accent px-2")}>
                  <span className={cn("tabular w-14 text-xs font-semibold", w.state === "current" ? "text-accent-foreground" : "text-muted-foreground")}>
                    {t("weekN", { n: w.week })}
                  </span>
                  <span className={cn("tabular flex-1", w.state === "done" && "text-muted-foreground")}>{rangeLabel(w.start, w.end, locale)}</span>
                  {w.state === "current" && <ToneBadge tone="brand">{t("thisWeek")}</ToneBadge>}
                  {w.state === "done" && <span className="text-xs text-muted-foreground">{t("done")}</span>}
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>

      <Panel id="competitions" title={t("competitions.title")} subtitle={t("competitions.subtitle", { count: competitions.length })} bodyClassName="px-0 pb-2 sm:px-0">
        {competitions.length === 0 ? (
          <div className="px-4 sm:px-5"><EmptyState icon={Trophy} title={t("competitions.empty")} /></div>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5 text-xs font-semibold text-muted-foreground">{t("competitions.name")}</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">{t("competitions.category")}</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">{t("competitions.deadline")}</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">{t("competitions.final")}</TableHead>
                    <TableHead className="pr-5 text-right text-xs font-semibold text-muted-foreground">{t("competitions.teams")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedComps.map((c) => {
                    const left = daysUntil(c.applicationDeadline);
                    return (
                      <TableRow key={c.id} className={cn("h-12", left < 0 && "text-muted-foreground")}>
                        <TableCell className="max-w-96 pl-5 whitespace-normal">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{c.name}</span>
                            {mine.has(c.id) && <ToneBadge tone="brand">{t("yourCompetition")}</ToneBadge>}
                            {c.url && (
                              <a href={c.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" aria-label={t("competitions.website", { name: c.name })}>
                                <ExternalLink className="size-3.5" aria-hidden />
                              </a>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {c.organizer} · {tc.has(`countries.${c.country}` as never) ? tc(`countries.${c.country}` as never) : c.country}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm">{tc.has(`categories.${c.category}` as never) ? tc(`categories.${c.category}` as never) : c.category}</TableCell>
                        <TableCell>
                          <p className="tabular text-sm">{fmtDate(c.applicationDeadline, locale)}</p>
                          <Countdown left={left} tc={tc} passed={t("passed")} />
                        </TableCell>
                        <TableCell className="tabular text-sm">{fmtDate(c.finalDate, locale)}</TableCell>
                        <TableCell className="tabular pr-5 text-right font-semibold">{c._count.projects}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <ul className="divide-y border-t md:hidden">
              {sortedComps.map((c) => {
                const left = daysUntil(c.applicationDeadline);
                return (
                  <li key={c.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">{c.name}</p>
                      <Countdown left={left} tc={tc} passed={t("passed")} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c.organizer} · {tc.has(`categories.${c.category}` as never) ? tc(`categories.${c.category}` as never) : c.category}
                    </p>
                    <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div><dt className="text-muted-foreground">{t("competitions.deadline")}</dt><dd className="tabular font-medium">{fmtDate(c.applicationDeadline, locale)}</dd></div>
                      <div><dt className="text-muted-foreground">{t("competitions.final")}</dt><dd className="tabular font-medium">{fmtDate(c.finalDate, locale)}</dd></div>
                      <div><dt className="text-muted-foreground">{t("competitions.teams")}</dt><dd className="tabular font-medium">{c._count.projects}</dd></div>
                    </dl>
                    {mine.has(c.id) && <ToneBadge tone="brand" className="mt-2">{t("yourCompetition")}</ToneBadge>}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Panel>
    </div>
  );
}

function Countdown({ left, tc, passed }: { left: number; tc: (k: string, v?: Record<string, string | number>) => string; passed: string }) {
  if (left < 0) return <span className="text-xs text-muted-foreground">{passed}</span>;
  return (
    <span className={cn("tabular text-xs font-semibold whitespace-nowrap", left <= 14 ? "text-danger" : left <= 30 ? "text-warning" : "text-muted-foreground")}>
      {left === 0 ? tc("today") : tc("daysLeft", { count: left })}
    </span>
  );
}

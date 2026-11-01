import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { subDays, differenceInCalendarDays, addDays } from "date-fns";
import { CalendarCheck2, CalendarClock, ChevronRight, Clock, FolderKanban, Lock, NotebookPen, UsersRound, AlarmClock } from "lucide-react";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/rbac";
import { fmtRelative } from "@/lib/format";
import type { CurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { EnumBadge } from "@/components/shared/enum-badge";
import { ToneBadge } from "@/components/shared/tone-badge";
import { CADENCE_DAYS, getCadence, getPlanProjects, loadSessions } from "./queries";
import { MentorCard, type MentorCardData } from "./mentor-card";
import { NotesExplainer } from "./notes-explainer";
import { PlanSessionButton } from "./session-dialogs";
import { SessionCard } from "./session-card";
import { SessionTable } from "./session-table";
import { CadenceStrip, SessionTimeline } from "./session-timeline";

const ACTIVE = { in: ["PLANNED" as const, "CONFIRMED" as const] };

function Card({ title, subtitle, action, children, id, className }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; id: string; className?: string }) {
  return (
    <section aria-labelledby={id} className={`rounded-xl border bg-card shadow-card ${className ?? ""}`}>
      <header className="flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3 sm:px-5">
        <div>
          <h2 id={id} className="text-sm font-semibold">
            {title}
          </h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/* ================================================================== ADMIN */

export async function AdminMentorsView({ user, showAll = false }: { user: CurrentUser; showAll?: boolean }) {
  const [t, locale] = await Promise.all([getTranslations("mentors"), getLocale()]);
  const now = new Date();
  const since = subDays(now, CADENCE_DAYS);

  const [upcomingCount, completedMonth, projectsLate, upcoming, awaiting, mentors, sessionAgg, planProjects] = await Promise.all([
    prisma.mentorSession.count({ where: { status: ACTIVE, scheduledAt: { gte: now, lte: addDays(now, 14) } } }),
    prisma.mentorSession.count({ where: { status: "COMPLETED", scheduledAt: { gte: subDays(now, 30) } } }),
    prisma.project.count({ where: { sessions: { none: { status: "COMPLETED", scheduledAt: { gte: since } } } } }),
    loadSessions(user, locale, { status: ACTIVE, scheduledAt: { gte: now } }, { scheduledAt: "asc" }, showAll ? 200 : 15),
    loadSessions(user, locale, { status: ACTIVE, scheduledAt: { lt: now } }, { scheduledAt: "asc" }, 40),
    prisma.user.findMany({
      where: { role: "MENTOR", active: true },
      select: { id: true, name: true, title: true, email: true, expertise: true, _count: { select: { mentorAssignments: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.mentorSession.groupBy({ by: ["mentorId"], where: { status: "COMPLETED" }, _count: { _all: true }, _sum: { durationMin: true } }),
    getPlanProjects(user),
  ]);
  const totalUpcoming = await prisma.mentorSession.count({ where: { status: ACTIVE, scheduledAt: { gte: now } } });
  const agg = new Map(sessionAgg.map((a) => [a.mentorId, a]));
  const pool: MentorCardData[] = mentors.map((m) => ({
    id: m.id,
    name: m.name,
    title: m.title,
    email: m.email,
    expertise: m.expertise,
    projects: m._count.mentorAssignments,
    completed: agg.get(m.id)?._count._all ?? 0,
    minutes: agg.get(m.id)?._sum.durationMin ?? 0,
  }));
  const totalHours = Math.round(pool.reduce((a, m) => a + m.minutes, 0) / 60);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("titleByRole.ADMIN")}
        description={t("description.ADMIN")}
        actions={<PlanSessionButton projects={planProjects} mode="plan" />}
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label={t("stats.upcoming")} value={upcomingCount} hint={t("stats.upcomingHint")} icon={CalendarClock} tone="info" />
        <StatCard label={t("stats.needsNotes")} value={awaiting.length} hint={t("stats.needsNotesHint")} icon={NotebookPen} tone={awaiting.length ? "danger" : "success"} />
        <StatCard label={t("stats.completedMonth")} value={completedMonth} hint={t("stats.completedMonthHint", { hours: totalHours })} icon={CalendarCheck2} tone="success" />
        <StatCard label={t("stats.noRecentSession")} value={projectsLate} hint={t("stats.noRecentSessionHint", { days: CADENCE_DAYS })} icon={AlarmClock} tone={projectsLate ? "warning" : "success"} />
      </div>

      <NotesExplainer layout="row" />
      <div className="grid min-w-0 gap-6">
        <div className="min-w-0 space-y-6">
          <Card
            id="admin-upcoming"
            title={t("upcoming.title")}
            subtitle={totalUpcoming > upcoming.length ? t("upcoming.subtitleCapped", { shown: upcoming.length, total: totalUpcoming }) : t("upcoming.subtitle", { count: totalUpcoming })}
            action={
              totalUpcoming > 15 ? (
                <Link href={showAll ? "/mentors" : "/mentors?upcoming=all#admin-upcoming"} className="text-xs font-medium text-primary hover:underline">
                  {showAll ? t("upcoming.showLess") : t("upcoming.showAll", { count: totalUpcoming })}
                </Link>
              ) : undefined
            }
          >
            {upcoming.length === 0 ? (
              <EmptyState icon={CalendarClock} title={t("upcoming.empty")} className="m-4 border-0" />
            ) : (
              <SessionTable sessions={upcoming} caption={t("upcoming.title")} />
            )}
          </Card>
          <Card id="admin-awaiting" title={t("needsNotes.title")} subtitle={t("needsNotes.subtitle")}>
            {awaiting.length === 0 ? (
              <EmptyState icon={NotebookPen} title={t("needsNotes.empty")} description={t("needsNotes.emptyHint")} className="m-4 border-0 py-8" />
            ) : (
              <SessionTable sessions={awaiting} caption={t("needsNotes.title")} />
            )}
          </Card>
        </div>
      </div>

      <section aria-labelledby="mentor-pool" className="space-y-3">
        <div>
          <h2 id="mentor-pool" className="text-lg font-semibold tracking-tight">
            {t("pool.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("pool.subtitle", { count: pool.length })}</p>
        </div>
        {pool.length === 0 ? (
          <EmptyState icon={UsersRound} title={t("pool.empty")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {pool.map((m) => (
              <MentorCard key={m.id} m={m} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ================================================================== MENTOR */

export async function MentorSessionsView({ user }: { user: CurrentUser }) {
  const [t, locale] = await Promise.all([getTranslations("mentors"), getLocale()]);
  const now = new Date();
  const mine = { mentorId: user.id };

  const [upcoming, awaiting, completed, agg, projects, planProjects] = await Promise.all([
    loadSessions(user, locale, { ...mine, status: ACTIVE, scheduledAt: { gte: now } }, { scheduledAt: "asc" }),
    loadSessions(user, locale, { ...mine, status: ACTIVE, scheduledAt: { lt: now } }, { scheduledAt: "asc" }),
    loadSessions(user, locale, { ...mine, status: "COMPLETED" }, { scheduledAt: "desc" }, 6),
    prisma.mentorSession.aggregate({ where: { ...mine, status: "COMPLETED" }, _count: { _all: true }, _sum: { durationMin: true } }),
    prisma.project.findMany({
      where: projectScope(user),
      select: { id: true, code: true, title: true, stage: true },
      orderBy: { code: "asc" },
    }),
    getPlanProjects(user),
  ]);
  const cadence = await getCadence(projects.map((p) => p.id), now);
  const late = projects.filter((p) => {
    const l = cadence.get(p.id)?.last;
    return !l || differenceInCalendarDays(now, l) > CADENCE_DAYS;
  }).length;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t("eyebrow")} title={t("titleByRole.MENTOR")} description={t("description.MENTOR")} actions={<PlanSessionButton projects={planProjects} mode="plan" />} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label={t("stats.upcoming")} value={upcoming.length} hint={t("stats.myUpcomingHint")} icon={CalendarClock} tone="info" />
        <StatCard label={t("stats.needsNotes")} value={awaiting.length} hint={t("stats.myNeedsNotesHint")} icon={NotebookPen} tone={awaiting.length ? "danger" : "success"} />
        <StatCard label={t("stats.completed")} value={agg._count._all} hint={t("stats.hoursHint", { hours: Math.round(((agg._sum.durationMin ?? 0) / 60) * 10) / 10 })} icon={Clock} tone="success" />
        <StatCard label={t("stats.projectsLate")} value={late} hint={t("stats.noRecentSessionHint", { days: CADENCE_DAYS })} icon={AlarmClock} tone={late ? "warning" : "success"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          {awaiting.length > 0 && (
            <section aria-labelledby="m-awaiting" className="space-y-3">
              <h2 id="m-awaiting" className="flex items-center gap-2 text-sm font-semibold">
                <NotebookPen className="size-4 text-danger" aria-hidden />
                {t("needsNotes.title")}
                <span className="tabular rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">{awaiting.length}</span>
              </h2>
              <p className="-mt-2 text-xs text-muted-foreground">{t("needsNotes.subtitle")}</p>
              {awaiting.map((s) => (
                <SessionCard key={s.id} session={s} showMentor={false} />
              ))}
            </section>
          )}
          <section aria-labelledby="m-upcoming" className="space-y-3">
            <h2 id="m-upcoming" className="flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="size-4 text-primary" aria-hidden />
              {t("upcoming.titleMine")}
              <span className="tabular rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{upcoming.length}</span>
            </h2>
            {upcoming.length === 0 ? (
              <EmptyState icon={CalendarClock} title={t("upcoming.empty")} description={t("upcoming.emptyHintMentor")} />
            ) : (
              upcoming.map((s) => <SessionCard key={s.id} session={s} showMentor={false} />)
            )}
          </section>
          <section aria-labelledby="m-completed" className="space-y-3">
            <h2 id="m-completed" className="flex items-center gap-2 text-sm font-semibold">
              <CalendarCheck2 className="size-4 text-success" aria-hidden />
              {t("completed.title")}
            </h2>
            <p className="-mt-2 text-xs text-muted-foreground">{t("completed.subtitle")}</p>
            {completed.length === 0 ? (
              <EmptyState icon={CalendarCheck2} title={t("completed.empty")} />
            ) : (
              completed.map((s) => <SessionCard key={s.id} session={s} showMentor={false} />)
            )}
          </section>
        </div>
        <aside className="space-y-4">
          <Card id="m-projects" title={t("myProjects.title")} subtitle={t("myProjects.subtitle", { count: projects.length })}>
            {projects.length === 0 ? (
              <EmptyState icon={FolderKanban} title={t("myProjects.empty")} className="m-4 border-0 py-8" />
            ) : (
              <ul className="divide-y">
                {projects.map((p) => {
                  const c = cadence.get(p.id)!;
                  const ok = !!c.last && differenceInCalendarDays(now, c.last) <= CADENCE_DAYS;
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/projects/${p.id}/sessions`}
                        className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            <span className="font-mono text-xs font-semibold text-primary">{p.code}</span> {p.title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {t("myProjects.last")}: {c.last ? fmtRelative(c.last, locale) : t("timeline.never")}
                            {c.next ? ` · ${t("myProjects.next")}: ${fmtRelative(c.next, locale)}` : ""}
                          </p>
                        </div>
                        <ToneBadge tone={ok ? "success" : "warning"} className="shrink-0">
                          {ok ? t("myProjects.ok") : t("myProjects.late")}
                        </ToneBadge>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <NotesExplainer />
        </aside>
      </div>
    </div>
  );
}

/* ================================================================== TEAM */

export async function TeamMentorsView({ user }: { user: CurrentUser }) {
  const [t, locale] = await Promise.all([getTranslations("mentors"), getLocale()]);
  const now = new Date();
  const membership = await prisma.projectMember.findFirst({
    where: { userId: user.id },
    select: { project: { select: { id: true, code: true, title: true, stage: true } } },
  });
  if (!membership) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow={t("eyebrow")} title={t("titleByRole.TEAM")} description={t("description.TEAM")} />
        <EmptyState icon={UsersRound} title={t("myMentors.noProject")} />
      </div>
    );
  }
  const project = membership.project;
  const [assignments, perMentor, upcomingPerMentor, upcoming, past, planProjects, cadence] = await Promise.all([
    prisma.mentorAssignment.findMany({
      where: { projectId: project.id },
      select: { focus: true, mentor: { select: { id: true, name: true, title: true, email: true, expertise: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.mentorSession.groupBy({ by: ["mentorId"], where: { projectId: project.id, status: "COMPLETED" }, _count: { _all: true }, _sum: { durationMin: true } }),
    prisma.mentorSession.groupBy({ by: ["mentorId"], where: { projectId: project.id, status: ACTIVE, scheduledAt: { gte: now } }, _count: { _all: true } }),
    loadSessions(user, locale, { projectId: project.id, status: ACTIVE, scheduledAt: { gte: now } }, { scheduledAt: "asc" }),
    loadSessions(user, locale, { projectId: project.id, OR: [{ status: { in: ["COMPLETED", "CANCELLED"] } }, { scheduledAt: { lt: now } }] }, { scheduledAt: "desc" }),
    getPlanProjects(user, project.id),
    getCadence([project.id], now),
  ]);
  const done = new Map(perMentor.map((a) => [a.mentorId, a]));
  const up = new Map(upcomingPerMentor.map((a) => [a.mentorId, a._count._all]));
  const c = cadence.get(project.id)!;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${project.code} · ${project.title}`}
        title={t("titleByRole.TEAM")}
        description={t("description.TEAM")}
        actions={<PlanSessionButton projects={planProjects} mode="request" />}
      />
      <section aria-labelledby="team-mentors" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="team-mentors" className="text-sm font-semibold">
              {t("myMentors.title")}
            </h2>
            <p className="text-xs text-muted-foreground">{t("myMentors.subtitle")}</p>
          </div>
          <EnumBadge enumName="ProjectStage" value={project.stage} />
        </div>
        {assignments.length === 0 ? (
          <EmptyState icon={UsersRound} title={t("myMentors.empty")} description={t("myMentors.emptyHint")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {assignments.map((a) => (
              <MentorCard
                key={a.mentor.id}
                variant="team"
                m={{
                  ...a.mentor,
                  focus: a.focus,
                  projects: 1,
                  completed: done.get(a.mentor.id)?._count._all ?? 0,
                  minutes: done.get(a.mentor.id)?._sum.durationMin ?? 0,
                  upcoming: up.get(a.mentor.id) ?? 0,
                }}
              />
            ))}
          </div>
        )}
      </section>

      <CadenceStrip last={c.last} next={c.next} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-3">
          <div>
            <h2 className="text-sm font-semibold">{t("projectSection.title")}</h2>
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3.5" aria-hidden />
              {t("visibility")}
            </p>
          </div>
          <SessionTimeline upcoming={upcoming} past={past} />
        </div>
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <NotesExplainer />
        </aside>
      </div>
    </div>
  );
}

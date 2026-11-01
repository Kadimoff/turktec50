import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  Activity, AlertTriangle, ArrowRight, CalendarClock, Check, CheckCircle2, CircleDashed, ClipboardList, FileCheck2,
  Gauge, ListChecks, MessagesSquare, Scale, ShieldAlert, Star,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getProjectAccess, type ProjectTab } from "@/lib/rbac";
import { readinessFromChecklist } from "@/lib/kpi";
import { STAGE_ORDER } from "@/lib/constants";
import { fmtDate, fmtDateTime, fmtRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/shared/stat-card";
import { EnumBadge } from "@/components/shared/enum-badge";
import { ToneBadge } from "@/components/shared/tone-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { AssignForm, FlagsForm, HealthForm, StageForm, UnassignButton } from "@/components/projects/manage-forms";

export async function generateMetadata(props: PageProps<"/projects/[id]">) {
  const { id } = await props.params;
  const p = await prisma.project.findUnique({ where: { id }, select: { code: true, title: true } });
  return { title: p ? `${p.title} · ${p.code}` : undefined };
}

const TAB_ICONS: Record<Exclude<ProjectTab, "overview">, React.ComponentType<{ className?: string }>> = {
  tasks: ListChecks, sessions: MessagesSquare, documents: FileCheck2, risks: ShieldAlert, evaluations: Scale, activity: Activity,
};

export default async function ProjectOverviewPage(props: PageProps<"/projects/[id]">) {
  const { id } = await props.params;
  const user = await requireUser();
  const access = await getProjectAccess(user, id);
  const locale = await getLocale();
  const now = new Date();

  const [project, taskTotal, taskDone, taskOverdue, openRisks, nextSession] = await Promise.all([
    prisma.project.findUniqueOrThrow({
      where: { id },
      select: {
        id: true, title: true, summary: true, stage: true, health: true, createdAt: true,
        prototypeVerified: true, packageQcPassed: true, submittedAt: true, result: true,
        competition: { select: { name: true, applicationDeadline: true, finalDate: true } },
        members: { orderBy: [{ isLead: "desc" }, { user: { name: "asc" } }], select: { id: true, teamRole: true, isLead: true, user: { select: { id: true, name: true, title: true } } } },
        mentors: { orderBy: { createdAt: "asc" }, select: { id: true, focus: true, mentor: { select: { id: true, name: true, title: true } } } },
        // juror identities are shown to the coordinator only
        jurors: { where: access.isAdmin ? {} : { id: "__hidden__" }, orderBy: { createdAt: "asc" }, select: { id: true, jury: { select: { id: true, name: true, title: true } } } },
        checklist: { select: { required: true, status: true } },
        stageHistory: { orderBy: { createdAt: "desc" }, select: { id: true, fromStage: true, toStage: true, note: true, actorId: true, createdAt: true } },
      },
    }),
    prisma.task.count({ where: { projectId: id } }),
    prisma.task.count({ where: { projectId: id, status: "DONE" } }),
    prisma.task.count({ where: { projectId: id, status: { not: "DONE" }, dueDate: { lt: now } } }),
    prisma.risk.count({ where: { projectId: id, status: { not: "CLOSED" } } }),
    prisma.mentorSession.findFirst({
      where: { projectId: id, status: { in: ["PLANNED", "CONFIRMED"] }, scheduledAt: { gte: now } },
      orderBy: { scheduledAt: "asc" },
      select: { scheduledAt: true, topic: true, mentor: { select: { name: true } } },
    }),
  ]);

  const actorIds = [...new Set(project.stageHistory.map((s) => s.actorId).filter((v): v is string => !!v))];
  const [actors, mentorPool, juryPool] = await Promise.all([
    actorIds.length ? prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    access.canManage
      ? prisma.user.findMany({ where: { role: "MENTOR", active: true, mentorAssignments: { none: { projectId: id } } }, orderBy: { name: "asc" }, select: { id: true, name: true, expertise: true } })
      : Promise.resolve([]),
    access.canManage
      ? prisma.user.findMany({ where: { role: "JURY", active: true, juryAssignments: { none: { projectId: id } } }, orderBy: { name: "asc" }, select: { id: true, name: true, title: true } })
      : Promise.resolve([]),
  ]);
  const actorName = new Map(actors.map((a) => [a.id, a.name]));

  const [t, te, tn] = await Promise.all([getTranslations("projects"), getTranslations("enums"), getTranslations("nav.projectTabs")]);
  const readiness = readinessFromChecklist(project.checklist);
  const reqTotal = project.checklist.filter((c) => c.required).length;
  const reqApproved = project.checklist.filter((c) => c.required && c.status === "APPROVED").length;
  const stageIdx = STAGE_ORDER.indexOf(project.stage);
  // most recent arrival at a stage (history is sorted newest first); VALIDATION starts at creation
  const reachedAt = (s: string) => (s === "VALIDATION" ? project.createdAt : project.stageHistory.find((h) => h.toStage === s)?.createdAt);
  const defaultTarget = STAGE_ORDER[stageIdx + 1] ?? STAGE_ORDER[stageIdx - 1];
  const quickTabs = access.tabs.filter((tab): tab is Exclude<ProjectTab, "overview"> => tab !== "overview");

  return (
    <div className="space-y-6">
      {/* metrics */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label={t("overview.readiness")} value={`${readiness}%`} icon={Gauge} tone={readiness >= 70 ? "success" : readiness >= 45 ? "brand" : "warning"} target={100} current={readiness} hint={t("overview.readinessHint", { approved: reqApproved, total: reqTotal })} />
        <StatCard label={t("overview.tasks")} value={<>{taskDone}<span className="text-base font-semibold text-muted-foreground"> / {taskTotal}</span></>} icon={ClipboardList} tone="info" target={taskTotal || undefined} current={taskDone} hint={t("overview.tasksHint")} />
        <StatCard label={t("overview.overdue")} value={taskOverdue} icon={AlertTriangle} tone={taskOverdue > 0 ? "danger" : "success"} hint={taskOverdue > 0 ? t("overview.overdueHint") : t("overview.overdueNone")} />
        <StatCard label={t("overview.risks")} value={openRisks} icon={ShieldAlert} tone={openRisks > 0 ? "warning" : "success"} hint={t("overview.risksHint")} />
        <StatCard
          className="col-span-2 lg:col-span-1"
          label={t("overview.nextSession")}
          value={<span className="text-xl">{nextSession ? fmtDateTime(nextSession.scheduledAt, locale) : "—"}</span>}
          icon={CalendarClock}
          tone="brand"
          hint={nextSession ? `${fmtRelative(nextSession.scheduledAt, locale)} · ${nextSession.topic}` : t("overview.noSession")}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby="ov-summary">
            <h2 id="ov-summary" className="text-sm font-semibold">{t("overview.summary")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-pretty">{project.summary}</p>
            {project.competition && (
              <p className="mt-3 text-xs text-muted-foreground">
                {t("overview.competitionLine", {
                  name: project.competition.name,
                  deadline: fmtDate(project.competition.applicationDeadline, locale),
                })}
              </p>
            )}
          </section>

          {/* stage stepper */}
          <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby="ov-stage">
            <h2 id="ov-stage" className="text-sm font-semibold">{t("overview.stage")}</h2>
            <p className="text-xs text-muted-foreground">{t("overview.stageHint")}</p>
            <ol className="mt-4 grid gap-2 sm:grid-cols-5 sm:gap-0">
              {STAGE_ORDER.map((s, i) => {
                const done = i < stageIdx;
                const current = i === stageIdx;
                const at = reachedAt(s);
                return (
                  <li key={s} aria-current={current ? "step" : undefined} className="relative flex items-center gap-3 sm:flex-col sm:items-center sm:gap-2 sm:text-center">
                    {i > 0 && (
                      <span aria-hidden className={cn("absolute top-4 right-1/2 hidden h-0.5 w-full -translate-y-1/2 sm:block", i <= stageIdx ? "bg-primary" : "bg-border")} />
                    )}
                    <span
                      className={cn(
                        "relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2 text-xs font-bold",
                        done && "border-primary bg-primary text-primary-foreground",
                        current && "border-primary bg-card text-primary ring-4 ring-primary/15",
                        !done && !current && "border-border bg-card text-muted-foreground",
                      )}
                    >
                      {done ? <Check className="size-4" aria-hidden /> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className={cn("block text-sm font-medium sm:text-xs", current ? "text-foreground" : "text-muted-foreground")}>{te(`ProjectStage.${s}`)}</span>
                      <span className="block text-xs text-muted-foreground sm:text-[11px]">
                        {current ? t("overview.current") : done ? (at ? fmtDate(at, locale) : "") : t("overview.upcoming")}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>

            <h3 className="mt-6 text-xs font-semibold tracking-wide text-muted-foreground">{t("overview.history")}</h3>
            {project.stageHistory.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{t("overview.noHistory")}</p>
            ) : (
              <ol className="mt-2 space-y-3 border-l pl-4">
                {project.stageHistory.map((h) => (
                  <li key={h.id} className="relative">
                    <span aria-hidden className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-card bg-primary" />
                    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
                      <span className="font-medium">{te(`ProjectStage.${h.fromStage}`)}</span>
                      <ArrowRight className="size-3.5 text-muted-foreground" aria-label="→" />
                      <span className="font-medium">{te(`ProjectStage.${h.toStage}`)}</span>
                      {STAGE_ORDER.indexOf(h.toStage) < STAGE_ORDER.indexOf(h.fromStage) && <ToneBadge tone="warning">{t("overview.movedBack")}</ToneBadge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(h.actorId && actorName.get(h.actorId)) || t("overview.system")} · <time dateTime={h.createdAt.toISOString()}>{fmtDateTime(h.createdAt, locale)}</time>
                    </p>
                    {h.note && <p className="mt-1 text-sm text-pretty text-muted-foreground">{h.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* KPI evidence */}
          <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby="ov-kpi">
            <h2 id="ov-kpi" className="text-sm font-semibold">{t("overview.evidence")}</h2>
            <p className="text-xs text-muted-foreground">{t("overview.evidenceHint")}</p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <Flag label={t("overview.flags.prototype")} ok={project.prototypeVerified} yes={t("overview.flags.verified")} no={t("overview.flags.notYet")} />
              <Flag label={t("overview.flags.qc")} ok={project.packageQcPassed} yes={t("overview.flags.passed")} no={t("overview.flags.notYet")} />
              <Flag
                label={t("overview.flags.submitted")}
                ok={!!project.submittedAt}
                yes={project.submittedAt ? fmtDate(project.submittedAt, locale) : ""}
                no={t("overview.flags.notSubmitted")}
              />
              <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
                <dt className="flex items-center gap-2 text-sm"><Star className="size-4 text-muted-foreground" aria-hidden />{t("overview.flags.result")}</dt>
                <dd><EnumBadge enumName="CompetitionResult" value={project.result} /></dd>
              </div>
            </dl>
          </section>
          {/* coordinator management */}
          {access.canManage && (
            <section className="rounded-xl border border-primary/30 bg-card shadow-card" aria-labelledby="ov-manage">
              <div className="border-b p-5 pb-4">
                <h2 id="ov-manage" className="text-sm font-semibold">{t("manage.title")}</h2>
                <p className="text-xs text-muted-foreground">{t("manage.subtitle")}</p>
              </div>
              <div className="grid gap-6 p-5 xl:grid-cols-2">
                <div className="space-y-6">
                  <div>
                    <h3 className="mb-3 text-sm font-semibold">{t("manage.stageTitle")}</h3>
                    <StageForm
                      projectId={project.id}
                      current={project.stage}
                      defaultTarget={defaultTarget}
                      stages={STAGE_ORDER.map((s, i) => ({
                        value: s,
                        label: `${i + 1}. ${te(`ProjectStage.${s}`)}${s === project.stage ? ` (${t("overview.current")})` : ""}`,
                      }))}
                    />
                  </div>
                  <div className="border-t pt-5">
                    <h3 className="mb-3 text-sm font-semibold">{t("manage.healthTitle")}</h3>
                    <HealthForm
                      projectId={project.id}
                      current={project.health}
                      options={(["ON_TRACK", "WATCH", "AT_RISK"] as const).map((h) => ({ value: h, label: te(`ProjectHealth.${h}`) }))}
                    />
                  </div>
                </div>
                <div className="border-t pt-5 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6">
                  <h3 className="mb-3 text-sm font-semibold">{t("manage.flagsTitle")}</h3>
                  <FlagsForm
                    projectId={project.id}
                    initial={{
                      prototypeVerified: project.prototypeVerified,
                      packageQcPassed: project.packageQcPassed,
                      submittedAt: project.submittedAt ? bakuDate(project.submittedAt) : "",
                      result: project.result,
                    }}
                    results={(["PENDING", "FINALIST", "NOT_SELECTED"] as const).map((r) => ({ value: r, label: te(`CompetitionResult.${r}`) }))}
                  />
                </div>
              </div>
            </section>
          )}
        </div>

        <aside className="min-w-0 space-y-6">
          {/* team */}
          <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby="ov-team">
            <h2 id="ov-team" className="text-sm font-semibold">{t("overview.team")}</h2>
            {project.members.length === 0 ? (
              <EmptyState title={t("overview.noMembers")} className="mt-3 py-6" />
            ) : (
              <ul className="mt-3 space-y-2.5">
                {project.members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3">
                    <UserAvatar name={m.user.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.user.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.teamRole}</p>
                    </div>
                    {m.isLead && <ToneBadge tone="brand">{t("overview.lead")}</ToneBadge>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* mentors */}
          <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby="ov-mentors">
            <h2 id="ov-mentors" className="text-sm font-semibold">{t("overview.mentors")}</h2>
            {project.mentors.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{t("overview.noMentors")}</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {project.mentors.map((m) => (
                  <li key={m.id} className="flex items-center gap-3">
                    <UserAvatar name={m.mentor.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.mentor.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{[m.focus && t("overview.focus", { focus: m.focus }), m.mentor.title].filter(Boolean).join(" · ")}</p>
                    </div>
                    {access.canManage && <UnassignButton projectId={project.id} userId={m.mentor.id} name={m.mentor.name} kind="mentor" />}
                  </li>
                ))}
              </ul>
            )}
            {access.canManage && (
              <div className="mt-4 border-t pt-4">
                <AssignForm projectId={project.id} kind="mentor" options={mentorPool.map((m) => ({ value: m.id, label: m.expertise ? `${m.name} — ${m.expertise}` : m.name }))} />
              </div>
            )}
          </section>

          {/* jurors: coordinator only */}
          {access.isAdmin && (
            <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby="ov-jurors">
              <div className="flex items-start justify-between gap-2">
                <h2 id="ov-jurors" className="text-sm font-semibold">{t("overview.jurors")}</h2>
                <ToneBadge tone="neutral" dot={false}>{t("overview.adminOnly")}</ToneBadge>
              </div>
              {project.jurors.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">{t("overview.noJurors")}</p>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {project.jurors.map((j) => (
                    <li key={j.id} className="flex items-center gap-3">
                      <UserAvatar name={j.jury.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{j.jury.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{j.jury.title}</p>
                      </div>
                      <UnassignButton projectId={project.id} userId={j.jury.id} name={j.jury.name} kind="jury" />
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 border-t pt-4">
                <AssignForm projectId={project.id} kind="jury" options={juryPool.map((j) => ({ value: j.id, label: j.title ? `${j.name} — ${j.title}` : j.name }))} />
              </div>
            </section>
          )}

          {/* quick links */}
          {quickTabs.length > 0 && (
            <nav className="rounded-xl border bg-card p-2 shadow-card" aria-label={t("overview.quickLinks")}>
              <p className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground">{t("overview.quickLinks")}</p>
              <ul>
                {quickTabs.map((tab) => {
                  const Icon = TAB_ICONS[tab];
                  return (
                    <li key={tab}>
                      <Link
                        href={`/projects/${project.id}/${tab}`}
                        className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        <Icon className="size-4 text-muted-foreground" aria-hidden />
                        <span className="flex-1">{tn(tab)}</span>
                        <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}
        </aside>
      </div>

    </div>
  );
}

/** YYYY-MM-DD in program timezone (for <input type="date">). */
function bakuDate(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baku" }).format(d);
}

function Flag({ label, ok, yes, no }: { label: string; ok: boolean; yes: string; no: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
      <dt className="flex min-w-0 items-center gap-2 text-sm">
        {ok ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden /> : <CircleDashed className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
        <span>{label}</span>
      </dt>
      <dd><ToneBadge tone={ok ? "success" : "neutral"}>{ok ? yes : no}</ToneBadge></dd>
    </div>
  );
}

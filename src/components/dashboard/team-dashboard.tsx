import Link from "next/link";
import { addDays, format } from "date-fns";
import { getLocale, getTranslations } from "next-intl/server";
import {
  CalendarClock, CheckSquare, FileCheck2, FolderOpen, Gavel, ListChecks, MapPin, MessagesSquare, ShieldAlert, Trophy, Video,
} from "lucide-react";
import type { CurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readinessFromChecklist } from "@/lib/kpi";
import { fmtDateTime, fmtDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { EnumBadge } from "@/components/shared/enum-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ProgressBar } from "@/components/shared/progress-bar";
import { ToneBadge } from "@/components/shared/tone-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { DueText, MiniEmpty, Panel, PanelLink, ProjectCode, RowLink } from "./parts";
import { StageStepper } from "./stage-stepper";
import { getFallbackLabels } from "./labels";
import { daysUntil } from "@/components/calendar/program";

export async function TeamDashboard({ user }: { user: CurrentUser }) {
  const now = new Date();
  const [t, tc, tn, locale, labels] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("common"),
    getTranslations("nav"),
    getLocale(),
    getFallbackLabels(),
  ]);

  const membership = await prisma.projectMember.findFirst({
    where: { userId: user.id },
    orderBy: { isLead: "desc" },
    select: {
      teamRole: true,
      project: {
        select: {
          id: true, code: true, title: true, tagline: true, stage: true, health: true, category: true,
          university: { select: { shortName: true } },
          competition: { select: { name: true, applicationDeadline: true } },
          mentors: { select: { focus: true, mentor: { select: { id: true, name: true, title: true } } } },
          members: { select: { teamRole: true, isLead: true, user: { select: { id: true, name: true } } }, orderBy: { isLead: "desc" } },
          checklist: { select: { id: true, key: true, title: true, required: true, status: true }, orderBy: { order: "asc" } },
        },
      },
    },
  });

  if (!membership) {
    return <EmptyState icon={FolderOpen} title={t("team.noProject")} description={t("team.noProjectHint")} />;
  }
  const p = membership.project;
  const soon = addDays(now, 7);

  const [myTasks, myOverdue, myOpen, statusGroups, nextSession, risks] = await Promise.all([
    prisma.task.findMany({
      where: { projectId: p.id, assigneeId: user.id, status: { not: "DONE" }, dueDate: { lte: soon } },
      select: { id: true, title: true, dueDate: true, status: true, priority: true },
      orderBy: { dueDate: "asc" },
      take: 7,
    }),
    prisma.task.count({ where: { projectId: p.id, assigneeId: user.id, status: { not: "DONE" }, dueDate: { lt: now } } }),
    prisma.task.count({ where: { projectId: p.id, assigneeId: user.id, status: { not: "DONE" } } }),
    prisma.task.groupBy({ by: ["status"], where: { projectId: p.id }, _count: { _all: true } }),
    prisma.mentorSession.findFirst({
      where: { projectId: p.id, scheduledAt: { gte: now }, status: { in: ["PLANNED", "CONFIRMED"] } },
      select: { id: true, topic: true, scheduledAt: true, durationMin: true, online: true, status: true, agenda: true, mentor: { select: { name: true } } },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.risk.findMany({
      where: { projectId: p.id, status: { not: "CLOSED" } },
      select: { id: true, title: true, probability: true, impact: true, status: true, reviewDate: true },
      orderBy: [{ impact: "desc" }, { probability: "desc" }],
      take: 5,
    }),
  ]);

  const readiness = readinessFromChecklist(p.checklist);
  const required = p.checklist.filter((c) => c.required);
  const approved = required.filter((c) => c.status === "APPROVED").length;
  const missing = required.filter((c) => c.status !== "APPROVED");
  const tasksTotal = statusGroups.reduce((a, g) => a + g._count._all, 0);
  const tasksDone = statusGroups.find((g) => g.status === "DONE")?._count._all ?? 0;
  const deadline = p.competition?.applicationDeadline;

  const quick = [
    { k: "tasks", icon: ListChecks },
    { k: "sessions", icon: MessagesSquare },
    { k: "documents", icon: FileCheck2 },
    { k: "risks", icon: ShieldAlert },
    { k: "evaluations", icon: Gavel },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-3">
        <section aria-labelledby="my-project-title" className="rounded-xl border bg-card p-4 shadow-card sm:p-5 xl:col-span-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <ProjectCode>{p.code}</ProjectCode>
            <span>{tc(`categories.${p.category}` as never)}</span>
            <span aria-hidden>·</span>
            <span>{p.university.shortName}</span>
            <span aria-hidden>·</span>
            <span>{membership.teamRole}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="my-project-title" className="text-lg font-bold tracking-tight text-balance">
                <Link href={`/projects/${p.id}`} className="hover:underline focus-visible:underline focus-visible:outline-none">
                  {p.title}
                </Link>
              </h2>
              <p className="mt-0.5 text-sm text-pretty text-muted-foreground">{p.tagline}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <EnumBadge enumName="ProjectStage" value={p.stage} />
              <EnumBadge enumName="ProjectHealth" value={p.health} />
            </div>
          </div>

          <div className="mt-5">
            <StageStepper stage={p.stage} label={t("team.stages")} />
          </div>

          <dl className="mt-5 grid gap-4 border-t pt-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">{t("team.readiness")}</dt>
              <dd className="mt-1.5">
                <ProgressBar value={readiness} label={t("team.readiness")} />
                <p className="mt-1 text-xs text-muted-foreground">{t("team.approvedOf", { a: approved, b: required.length })}</p>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("team.tasksDone")}</dt>
              <dd className="mt-1.5">
                <ProgressBar value={tasksTotal ? (tasksDone / tasksTotal) * 100 : 0} label={t("team.tasksDone")} tone="info" />
                <p className="mt-1 text-xs text-muted-foreground">{tc("of", { a: tasksDone, b: tasksTotal })}</p>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("team.competition")}</dt>
              <dd className="mt-1">
                {p.competition ? (
                  <>
                    <p className="flex items-start gap-1.5 text-sm font-medium leading-snug">
                      <Trophy className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                      {p.competition.name}
                    </p>
                    {deadline && (
                      <p className={cn("tabular mt-1 text-xs font-semibold", daysUntil(deadline) <= 30 ? "text-warning" : "text-muted-foreground")}>
                        {t("team.deadline")}: {fmtDay(deadline, locale)} · {daysUntil(deadline) >= 0 ? tc("daysLeft", { count: daysUntil(deadline) }) : tc("overdue")}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </dd>
            </div>
          </dl>

          <nav aria-label={t("team.quickLinks")} className="mt-5 flex flex-wrap gap-2 no-print">
            {quick.map(({ k, icon: Icon }) => (
              <Link key={k} href={`/projects/${p.id}/${k}`} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-3 text-[13px]")}>
                <Icon aria-hidden />
                {tn(`projectTabs.${k}`)}
              </Link>
            ))}
          </nav>
        </section>

        <Panel id="next-session" title={t("team.nextSession")} action={<PanelLink href={`/projects/${p.id}/sessions`}>{t("team.allSessions")}</PanelLink>}>
          {nextSession ? (
            <div className="space-y-3">
              <div className="rounded-lg border bg-accent/50 p-3">
                <p className="text-sm font-semibold">{nextSession.topic}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="size-3.5" aria-hidden />
                  <span className="tabular">{fmtDateTime(nextSession.scheduledAt, locale)}</span>
                  <span aria-hidden>·</span>
                  <span>{t("team.minutes", { count: nextSession.durationMin })}</span>
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {nextSession.online ? <Video className="size-3.5" aria-hidden /> : <MapPin className="size-3.5" aria-hidden />}
                  {nextSession.online ? t("team.online") : t("team.inPerson")}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-medium">
                    <UserAvatar name={nextSession.mentor.name} size="sm" />
                    {nextSession.mentor.name}
                  </span>
                  <EnumBadge enumName="SessionStatus" value={nextSession.status} />
                </div>
              </div>
              <p className={cn("text-xs", nextSession.agenda ? "text-muted-foreground" : "font-medium text-warning")}>
                {nextSession.agenda ? t("team.agendaReady") : t("team.agendaMissing")}
              </p>
            </div>
          ) : (
            <MiniEmpty>{t("team.noSession")}</MiniEmpty>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          id="my-tasks"
          title={t("team.myTasks")}
          subtitle={t("team.myTasksSub", { open: myOpen, overdue: myOverdue })}
          className="xl:col-span-2"
          action={<PanelLink href="/tasks">{t("team.allTasks")}</PanelLink>}
        >
          {myTasks.length === 0 ? (
            <MiniEmpty>{t("team.noTasks")}</MiniEmpty>
          ) : (
            <ul className="divide-y">
              {myTasks.map((task) => (
                <RowLink
                  key={task.id}
                  href={`/projects/${p.id}/tasks?task=${task.id}`}
                  meta={<DueText d={task.dueDate} tc={tc} locale={locale} />}
                >
                  <p className="truncate text-sm font-medium">{task.title}</p>
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    <EnumBadge enumName="TaskStatus" value={task.status} />
                    {task.priority === "HIGH" && <EnumBadge enumName="Priority" value={task.priority} />}
                  </p>
                </RowLink>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          id="checklist"
          title={t("team.checklist")}
          subtitle={t("team.approvedOf", { a: approved, b: required.length })}
          action={<PanelLink href={`/projects/${p.id}/documents`}>{t("team.openChecklist")}</PanelLink>}
        >
          <ProgressBar value={readiness} label={t("team.readiness")} />
          {missing.length === 0 ? (
            <MiniEmpty>{t("team.checklistDone")}</MiniEmpty>
          ) : (
            <>
              <h3 className="mt-4 text-xs font-semibold tracking-wide text-muted-foreground">{t("team.missingItems", { count: missing.length })}</h3>
              <ul className="mt-1">
                {missing.slice(0, 6).map((c) => (
                  <RowLink key={c.id} href={`/projects/${p.id}/documents`} meta={<EnumBadge enumName="ChecklistStatus" value={c.status} />}>
                    <p className={cn("truncate text-sm", c.status === "REJECTED" && "font-medium text-danger")}>{labels.checklistItem(c)}</p>
                  </RowLink>
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
      <Panel
        id="risks"
        className="xl:col-span-2"
        title={t("team.openRisks")}
        subtitle={t("team.openRisksSub", { count: risks.length })}
        action={<PanelLink href={`/projects/${p.id}/risks`}>{t("team.riskRegister")}</PanelLink>}
      >
        {risks.length === 0 ? (
          <MiniEmpty>{t("team.noRisks")}</MiniEmpty>
        ) : (
          <ul className="divide-y">
            {risks.map((r) => (
              <RowLink
                key={r.id}
                href={`/projects/${p.id}/risks`}
                meta={<EnumBadge enumName="RiskStatus" value={r.status} />}
              >
                <p className="truncate text-sm font-medium">{r.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("attention.probShort")} <RiskLevelText v={r.probability} /> · {t("attention.impactShort")} <RiskLevelText v={r.impact} />
                  {r.reviewDate && <> · {t("team.review")} {format(r.reviewDate, "dd.MM")}</>}
                </p>
              </RowLink>
            ))}
          </ul>
        )}
      </Panel>
      <Panel id="people" title={t("team.people")}>
          <div>
            <ul className="space-y-2">
              {p.mentors.map((m) => (
                <li key={m.mentor.id} className="flex items-center gap-2.5 text-sm">
                  <UserAvatar name={m.mentor.name} size="sm" />
                  <span className="min-w-0 flex-1 truncate">{m.mentor.name}</span>
                  <ToneBadge tone="brand" dot={false}>{t("team.mentor")}</ToneBadge>
                </li>
              ))}
              {p.members.slice(0, 5).map((m) => (
                <li key={m.user.id} className="flex items-center gap-2.5 text-sm">
                  <UserAvatar name={m.user.name} size="sm" />
                  <span className="min-w-0 flex-1 truncate">
                    {m.user.name}
                    {m.user.id === user.id && <span className="text-muted-foreground"> · {t("team.you")}</span>}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{m.teamRole}</span>
                </li>
              ))}
            </ul>
          </div>
      </Panel>
      </div>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckSquare className="size-3.5" aria-hidden />
        {t("team.footer")}
      </p>
    </div>
  );
}

async function RiskLevelText({ v }: { v: string }) {
  const te = await getTranslations("enums");
  return <span className={cn("font-semibold", v === "HIGH" ? "text-danger" : v === "MEDIUM" ? "text-warning" : "text-success")}>{te(`RiskLevel.${v}`)}</span>;
}

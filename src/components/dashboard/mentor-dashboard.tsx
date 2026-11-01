import Link from "next/link";
import { addDays, format } from "date-fns";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarClock, FileSearch, FolderKanban, NotebookPen } from "lucide-react";
import type { CurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/rbac";
import { readinessFromChecklist } from "@/lib/kpi";
import { fmtDate, fmtDay, fmtRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/shared/stat-card";
import { EnumBadge } from "@/components/shared/enum-badge";
import { ProgressBar } from "@/components/shared/progress-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DayChip, MiniEmpty, Panel, PanelLink, ProjectCode, RowLink } from "./parts";
import { getFallbackLabels } from "./labels";

export async function MentorDashboard({ user }: { user: CurrentUser }) {
  const now = new Date();
  const scope = projectScope(user);
  const [t, te, locale, labels] = await Promise.all([getTranslations("dashboard"), getTranslations("enums"), getLocale(), getFallbackLabels()]);

  const [projects, overdueGroups, openGroups, lastSessions, upcoming, upcomingWeek, queue, queueTotal, noNotes] = await Promise.all([
    prisma.project.findMany({
      where: scope,
      select: {
        id: true, code: true, title: true, stage: true, health: true,
        checklist: { select: { required: true, status: true } },
      },
      orderBy: [{ health: "desc" }, { code: "asc" }],
    }),
    prisma.task.groupBy({ by: ["projectId"], where: { project: scope, status: { not: "DONE" }, dueDate: { lt: now } }, _count: { _all: true } }),
    prisma.task.groupBy({ by: ["projectId"], where: { project: scope, status: { not: "DONE" } }, _count: { _all: true } }),
    prisma.mentorSession.groupBy({ by: ["projectId"], where: { project: scope, status: "COMPLETED" }, _max: { scheduledAt: true } }),
    prisma.mentorSession.findMany({
      where: { mentorId: user.id, project: scope, scheduledAt: { gte: now }, status: { in: ["PLANNED", "CONFIRMED"] } },
      select: { id: true, topic: true, scheduledAt: true, status: true, online: true, agenda: true, project: { select: { id: true, code: true, title: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 6,
    }),
    prisma.mentorSession.count({
      where: { mentorId: user.id, project: scope, scheduledAt: { gte: now, lte: addDays(now, 7) }, status: { in: ["PLANNED", "CONFIRMED"] } },
    }),
    prisma.checklistItem.findMany({
      where: { project: scope, status: { in: ["UPLOADED", "IN_REVIEW"] } },
      select: { id: true, key: true, title: true, status: true, updatedAt: true, project: { select: { id: true, code: true } } },
      orderBy: { updatedAt: "asc" },
      take: 6,
    }),
    prisma.checklistItem.count({ where: { project: scope, status: { in: ["UPLOADED", "IN_REVIEW"] } } }),
    prisma.mentorSession.findMany({
      where: {
        mentorId: user.id, project: scope, scheduledAt: { lt: now }, status: { not: "CANCELLED" },
        OR: [{ notes: null }, { notes: "" }],
      },
      select: { id: true, topic: true, scheduledAt: true, project: { select: { id: true, code: true } } },
      orderBy: { scheduledAt: "desc" },
      take: 5,
    }),
  ]);

  if (projects.length === 0) {
    return <EmptyState icon={FolderKanban} title={t("mentor.noProjects")} description={t("mentor.noProjectsHint")} />;
  }

  const overdue = new Map(overdueGroups.map((g) => [g.projectId, g._count._all]));
  const open = new Map(openGroups.map((g) => [g.projectId, g._count._all]));
  const last = new Map(lastSessions.map((g) => [g.projectId, g._max.scheduledAt]));
  const rows = projects.map((p) => ({
    ...p,
    readiness: readinessFromChecklist(p.checklist),
    open: open.get(p.id) ?? 0,
    overdue: overdue.get(p.id) ?? 0,
    last: last.get(p.id) ?? null,
  }));
  const healthRank = { AT_RISK: 0, WATCH: 1, ON_TRACK: 2 } as const;
  rows.sort((a, b) => healthRank[a.health] - healthRank[b.health] || b.overdue - a.overdue);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("mentor.statProjects")} value={projects.length} icon={FolderKanban} hint={t("mentor.statProjectsHint", { count: rows.filter((r) => r.health !== "ON_TRACK").length })} />
        <StatCard label={t("mentor.statSessions")} value={upcomingWeek} icon={CalendarClock} tone="info" hint={t("mentor.statSessionsHint")} />
        <StatCard label={t("mentor.statQueue")} value={queueTotal} icon={FileSearch} tone={queueTotal > 0 ? "warning" : "success"} hint={t("mentor.statQueueHint")} />
        <StatCard label={t("mentor.statNotes")} value={noNotes.length} icon={NotebookPen} tone={noNotes.length > 0 ? "danger" : "success"} hint={t("mentor.statNotesHint")} />
      </div>

      <Panel id="assigned" title={t("mentor.assigned")} subtitle={t("mentor.assignedSub")} action={<PanelLink href="/projects">{t("mentor.allProjects")}</PanelLink>} bodyClassName="px-0 pb-1 sm:px-0">
        {/* desktop table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5 text-xs font-semibold text-muted-foreground">{t("mentor.colProject")}</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground">{t("mentor.colStage")}</TableHead>
                <TableHead className="w-40 text-xs font-semibold text-muted-foreground">{t("mentor.colReadiness")}</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground">{t("mentor.colHealth")}</TableHead>
                <TableHead className="text-right text-xs font-semibold text-muted-foreground">{t("mentor.colTasks")}</TableHead>
                <TableHead className="pr-5 text-right text-xs font-semibold text-muted-foreground">{t("mentor.colLast")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="h-12">
                  <TableCell className="max-w-72 pl-5">
                    <Link href={`/projects/${r.id}`} className="block truncate font-medium hover:underline focus-visible:underline focus-visible:outline-none">
                      {r.title}
                    </Link>
                    <ProjectCode>{r.code}</ProjectCode>
                  </TableCell>
                  <TableCell><EnumBadge enumName="ProjectStage" value={r.stage} /></TableCell>
                  <TableCell><ProgressBar value={r.readiness} label={`${t("mentor.colReadiness")} · ${r.code}`} /></TableCell>
                  <TableCell><EnumBadge enumName="ProjectHealth" value={r.health} /></TableCell>
                  <TableCell className="tabular text-right">
                    <Link href={`/projects/${r.id}/tasks`} className="hover:underline">
                      {r.open}
                      {r.overdue > 0 && <span className="ml-1.5 font-semibold text-danger">· {t("attention.overdueCount", { count: r.overdue })}</span>}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular pr-5 text-right text-xs text-muted-foreground">{r.last ? fmtDate(r.last, locale) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {/* mobile cards */}
        <ul className="divide-y border-t md:hidden">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/projects/${r.id}`} className="block px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.title}</p>
                    <ProjectCode>{r.code}</ProjectCode>
                  </div>
                  <EnumBadge enumName="ProjectHealth" value={r.health} />
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <EnumBadge enumName="ProjectStage" value={r.stage} />
                  <ProgressBar className="flex-1" value={r.readiness} label={`${t("mentor.colReadiness")} · ${r.code}`} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("mentor.openTasks", { count: r.open })}
                  {r.overdue > 0 && <span className="font-semibold text-danger"> · {t("attention.overdueCount", { count: r.overdue })}</span>}
                  {" · "}
                  {t("mentor.colLast")}: {r.last ? fmtDay(r.last, locale) : "—"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel id="m-upcoming" title={t("mentor.upcoming")} action={<PanelLink href="/calendar">{t("upcoming.calendar")}</PanelLink>}>
          {upcoming.length === 0 ? (
            <MiniEmpty>{t("upcoming.empty")}</MiniEmpty>
          ) : (
            <ul>
              {upcoming.map((s) => (
                <RowLink key={s.id} href={`/projects/${s.project.id}/sessions`}>
                  <div className="flex items-center gap-3">
                    <DayChip date={s.scheduledAt} locale={locale} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.topic}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        <span className="tabular">{format(s.scheduledAt, "HH:mm")}</span> · {s.project.code} · {te(`SessionStatus.${s.status}`)}
                      </p>
                      {!s.agenda && <p className="text-xs font-medium text-warning">{t("mentor.noAgenda")}</p>}
                    </div>
                  </div>
                </RowLink>
              ))}
            </ul>
          )}
        </Panel>

        <Panel id="m-queue" title={t("mentor.queue")} subtitle={t("mentor.queueSub", { count: queueTotal })} action={<PanelLink href="/documents">{t("attention.viewAll")}</PanelLink>}>
          {queue.length === 0 ? (
            <MiniEmpty>{t("mentor.queueEmpty")}</MiniEmpty>
          ) : (
            <ul>
              {queue.map((c) => (
                <RowLink key={c.id} href={`/projects/${c.project.id}/documents`} meta={<EnumBadge enumName="ChecklistStatus" value={c.status} />}>
                  <p className="truncate text-sm font-medium">{labels.checklistItem(c)}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ProjectCode>{c.project.code}</ProjectCode>
                    <span>{fmtRelative(c.updatedAt, locale)}</span>
                  </p>
                </RowLink>
              ))}
            </ul>
          )}
        </Panel>

        <Panel id="m-notes" title={t("mentor.notes")} subtitle={t("mentor.notesSub")}>
          {noNotes.length === 0 ? (
            <MiniEmpty>{t("mentor.notesEmpty")}</MiniEmpty>
          ) : (
            <ul>
              {noNotes.map((s) => (
                <RowLink
                  key={s.id}
                  href={`/projects/${s.project.id}/sessions`}
                  meta={<span className={cn("text-xs font-semibold text-danger")}>{t("mentor.writeNotes")}</span>}
                >
                  <p className="truncate text-sm font-medium">{s.topic}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ProjectCode>{s.project.code}</ProjectCode>
                    <span>{fmtDate(s.scheduledAt, locale)}</span>
                  </p>
                </RowLink>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

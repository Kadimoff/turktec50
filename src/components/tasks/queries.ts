import "server-only";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/rbac";
import { fmtDay } from "@/lib/format";
import { bakuAddDays, bakuDaysUntil, bakuParts, bakuStartOfDay, bakuYmd } from "@/lib/dates";
import { parsePage, pick, str, type SearchParams } from "@/lib/search-params";
import type { CurrentUser } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";
import type { Priority, TaskStatus } from "@/generated/prisma/enums";
import { PRIORITIES, TASK_STATUSES, type TaskFormProject, type TaskItem } from "./types";

export type TaskView = "board" | "table" | "week";
export type DueFilter = "overdue" | "week" | "later";

export type TaskFilters = {
  project?: string;
  assignee?: string; // "mine" | "none" | userId
  status?: TaskStatus | "open";
  priority?: Priority;
  due?: DueFilter;
  q?: string;
  page: number;
};

const DUES = ["overdue", "week", "later"] as const satisfies readonly DueFilter[];

export function parseTaskFilters(sp: SearchParams): TaskFilters {
  const status = str(sp.status);
  return {
    project: str(sp.project),
    assignee: str(sp.assignee),
    status: status === "open" ? "open" : pick(status, TASK_STATUSES),
    priority: pick(sp.priority, PRIORITIES),
    due: pick(sp.due, DUES),
    q: str(sp.q, 100),
    page: parsePage(sp.page),
  };
}

export function parseView(sp: SearchParams, fallback: TaskView, allowWeek: boolean): TaskView {
  const v = str(sp.view);
  if (v === "board" || v === "table") return v;
  if (v === "week" && allowWeek) return v;
  return fallback;
}

/** Monday 00:00 – Sunday 23:59:59.999 of the current week, in Baku time. */
export function weekBounds(now = new Date()) {
  const start = bakuAddDays(bakuStartOfDay(now), -((bakuParts(now).dow + 6) % 7));
  return { start, end: new Date(bakuAddDays(start, 7).getTime() - 1) };
}

/** Scope + project + assignee (the "context" — stats are computed on this). */
export function baseTaskWhere(user: CurrentUser, f: TaskFilters, fixedProjectId?: string): Prisma.TaskWhereInput {
  const and: Prisma.TaskWhereInput[] = [{ project: projectScope(user) }];
  const projectId = fixedProjectId ?? f.project;
  if (projectId) and.push({ projectId });
  if (f.assignee === "mine") and.push({ assigneeId: user.id });
  else if (f.assignee === "none") and.push({ assigneeId: null });
  else if (f.assignee) and.push({ assigneeId: f.assignee });
  return { AND: and };
}

/** Base + status/priority/due/q filters. */
export function fullTaskWhere(base: Prisma.TaskWhereInput, f: TaskFilters, now = new Date()): Prisma.TaskWhereInput {
  const and: Prisma.TaskWhereInput[] = [base];
  if (f.status === "open") and.push({ status: { not: "DONE" } });
  else if (f.status) and.push({ status: f.status });
  if (f.priority) and.push({ priority: f.priority });
  const { start, end } = weekBounds(now);
  if (f.due === "overdue") and.push({ dueDate: { lt: now }, status: { not: "DONE" } });
  if (f.due === "week") and.push({ dueDate: { gte: start, lte: end } });
  if (f.due === "later") and.push({ dueDate: { gt: end } });
  if (f.q)
    and.push({
      OR: [
        { title: { contains: f.q, mode: "insensitive" } },
        { acceptanceCriteria: { contains: f.q, mode: "insensitive" } },
      ],
    });
  return { AND: and };
}

export async function getTaskStats(base: Prisma.TaskWhereInput, now = new Date()) {
  const { start, end } = weekBounds(now);
  const [open, dueWeek, overdue, doneWeek] = await Promise.all([
    prisma.task.count({ where: { AND: [base, { status: { not: "DONE" } }] } }),
    prisma.task.count({ where: { AND: [base, { status: { not: "DONE" }, dueDate: { gte: start, lte: end } }] } }),
    prisma.task.count({ where: { AND: [base, { status: { not: "DONE" }, dueDate: { lt: now } }] } }),
    prisma.task.count({ where: { AND: [base, { status: "DONE", completedAt: { gte: start, lte: end } }] } }),
  ]);
  return { open, dueWeek, overdue, doneWeek };
}

export const taskSelect = {
  id: true,
  title: true,
  description: true,
  acceptanceCriteria: true,
  status: true,
  priority: true,
  week: true,
  dueDate: true,
  completedAt: true,
  createdById: true,
  projectId: true,
  project: { select: { code: true, title: true } },
  assignee: { select: { id: true, name: true } },
  sourceSession: { select: { id: true, topic: true } },
} satisfies Prisma.TaskSelect;

export type TaskRow = Prisma.TaskGetPayload<{ select: typeof taskSelect }>;

export function toTaskItem(t: TaskRow, user: CurrentUser, locale: string, now = new Date()): TaskItem {
  const canEdit = user.role === "ADMIN" || user.role === "TEAM" || user.role === "MENTOR";
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    acceptanceCriteria: t.acceptanceCriteria,
    status: t.status,
    priority: t.priority,
    week: t.week,
    projectId: t.projectId,
    projectCode: t.project.code,
    projectTitle: t.project.title,
    assignee: t.assignee,
    dueISO: bakuYmd(t.dueDate),
    dueAbs: fmtDay(t.dueDate, locale),
    dueDays: bakuDaysUntil(t.dueDate, now),
    overdue: t.status !== "DONE" && t.dueDate < now,
    completedAbs: t.completedAt ? fmtDay(t.completedAt, locale) : null,
    source: t.sourceSession,
    canEdit,
    canDelete: user.role === "ADMIN" || t.createdById === user.id,
    canComplete: user.role !== "MENTOR",
  };
}

/** Board data: per-column items (capped) + true counts per status. */
export async function getBoardData(where: Prisma.TaskWhereInput, cap: number) {
  const [groups, ...cols] = await Promise.all([
    prisma.task.groupBy({ by: ["status"], where, _count: { _all: true } }),
    ...TASK_STATUSES.map((status) =>
      prisma.task.findMany({
        where: { AND: [where, { status }] },
        select: taskSelect,
        orderBy: status === "DONE" ? [{ completedAt: { sort: "desc", nulls: "last" } }] : [{ dueDate: "asc" }, { priority: "desc" }],
        take: cap,
      }),
    ),
  ]);
  const counts = Object.fromEntries(TASK_STATUSES.map((s) => [s, 0])) as Record<TaskStatus, number>;
  for (const g of groups) counts[g.status] = g._count._all;
  return { counts, columns: Object.fromEntries(TASK_STATUSES.map((s, i) => [s, cols[i]!])) as Record<TaskStatus, TaskRow[]> };
}

export const PAGE_SIZE = 50;

export async function getTablePage(where: Prisma.TaskWhereInput, page: number) {
  const total = await prisma.task.count({ where });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const p = Math.min(page, pages);
  const rows = await prisma.task.findMany({
    where,
    select: taskSelect,
    // open tasks first (completedAt null), soonest due first; then completed, most recent first
    orderBy: [{ completedAt: { sort: "desc", nulls: "first" } }, { dueDate: "asc" }],
    skip: (p - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  return { rows, total, page: p, pages };
}

/** Projects (with members) the user may create tasks in. */
export async function getTaskFormProjects(user: CurrentUser, onlyProjectId?: string): Promise<TaskFormProject[]> {
  if (user.role === "JURY") return [];
  const projects = await prisma.project.findMany({
    where: { AND: [projectScope(user), onlyProjectId ? { id: onlyProjectId } : {}] },
    select: {
      id: true,
      code: true,
      title: true,
      members: { select: { isLead: true, user: { select: { id: true, name: true } } }, orderBy: [{ isLead: "desc" }] },
    },
    orderBy: { code: "asc" },
  });
  return projects.map((p) => ({
    id: p.id,
    code: p.code,
    title: p.title,
    members: p.members.map((m) => ({ id: m.user.id, name: m.user.name, isLead: m.isLead })),
  }));
}

import "server-only";
import { endOfDay, format } from "date-fns";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/rbac";
import { dfLocale, fmtDateTime, fmtRelative } from "@/lib/format";
import type { CurrentUser } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";
import type { TaskStatus } from "@/generated/prisma/enums";
import type { PlanProject, SessionItem } from "./types";

export const sessionSelect = {
  id: true,
  projectId: true,
  mentorId: true,
  scheduledAt: true,
  durationMin: true,
  topic: true,
  agenda: true,
  notes: true,
  nextSteps: true,
  status: true,
  online: true,
  project: { select: { code: true, title: true } },
  mentor: { select: { id: true, name: true, title: true } },
} satisfies Prisma.MentorSessionSelect;

export type SessionRow = Prisma.MentorSessionGetPayload<{ select: typeof sessionSelect }>;

/** Sessions in the user's scope (JURY: none). */
export function sessionScope(user: CurrentUser): Prisma.MentorSessionWhereInput {
  if (user.role === "JURY") return { id: "__none__" };
  return { project: projectScope(user) };
}

/** Tasks already created from sessions' next steps: sessionId -> title -> task. */
async function convertedMap(sessionIds: string[]) {
  const map = new Map<string, Map<string, { id: string; status: TaskStatus }>>();
  if (sessionIds.length === 0) return map;
  const tasks = await prisma.task.findMany({
    where: { sourceSessionId: { in: sessionIds } },
    select: { id: true, title: true, status: true, sourceSessionId: true },
  });
  for (const t of tasks) {
    const sid = t.sourceSessionId!;
    if (!map.has(sid)) map.set(sid, new Map());
    map.get(sid)!.set(t.title.trim(), { id: t.id, status: t.status });
  }
  return map;
}

export async function toSessionItems(rows: SessionRow[], user: CurrentUser, locale: string, now = new Date()): Promise<SessionItem[]> {
  const conv = await convertedMap(rows.filter((r) => r.status === "COMPLETED" && r.nextSteps.length > 0).map((r) => r.id));
  const loc = dfLocale(locale);
  const isAdmin = user.role === "ADMIN";
  const isTeam = user.role === "TEAM";
  const canWork = isAdmin || isTeam || user.role === "MENTOR";
  return rows.map((s) => {
    const own = user.role === "MENTOR" && s.mentorId === user.id;
    const active = s.status === "PLANNED" || s.status === "CONFIRMED";
    const isPast = s.scheduledAt < now;
    const steps = s.nextSteps.map((text, index) => ({ index, text, task: conv.get(s.id)?.get(text.trim()) ?? null }));
    return {
      id: s.id,
      projectId: s.projectId,
      projectCode: s.project.code,
      projectTitle: s.project.title,
      mentor: s.mentor,
      status: s.status,
      online: s.online,
      durationMin: s.durationMin,
      topic: s.topic,
      agenda: s.agenda,
      notes: s.notes,
      steps,
      whenAbs: fmtDateTime(s.scheduledAt, locale),
      whenRel: fmtRelative(s.scheduledAt, locale),
      day: format(s.scheduledAt, "d", { locale: loc }),
      month: format(s.scheduledAt, "MMM", { locale: loc }),
      weekday: format(s.scheduledAt, "EEE", { locale: loc }),
      time: format(s.scheduledAt, "HH:mm", { locale: loc }),
      scheduledLocal: format(s.scheduledAt, "yyyy-MM-dd'T'HH:mm"),
      isPast,
      needsNotes: active && isPast,
      can: {
        confirm: active && s.status === "PLANNED" && (isAdmin || own),
        reschedule: active && (isAdmin || own),
        cancel: active && (isAdmin || own || (isTeam && s.status === "PLANNED")),
        complete: active && (isAdmin || own) && s.scheduledAt <= endOfDay(now),
        convert: s.status === "COMPLETED" && canWork,
        editAgenda: active && !isPast && (isAdmin || own || isTeam),
      },
    };
  });
}

export async function loadSessions(
  user: CurrentUser,
  locale: string,
  where: Prisma.MentorSessionWhereInput,
  orderBy: Prisma.MentorSessionOrderByWithRelationInput,
  take?: number,
) {
  const rows = await prisma.mentorSession.findMany({ where: { AND: [sessionScope(user), where] }, select: sessionSelect, orderBy, take });
  return toSessionItems(rows, user, locale);
}

/** Projects (with assigned mentors) where the user may plan / request a session. */
export async function getPlanProjects(user: CurrentUser, onlyProjectId?: string): Promise<PlanProject[]> {
  if (user.role === "JURY") return [];
  const projects = await prisma.project.findMany({
    where: { AND: [projectScope(user), onlyProjectId ? { id: onlyProjectId } : {}] },
    select: {
      id: true,
      code: true,
      title: true,
      mentors: { select: { mentor: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { code: "asc" },
  });
  return projects
    .map((p) => ({
      id: p.id,
      code: p.code,
      title: p.title,
      // a mentor plans their own sessions
      mentors: p.mentors.map((m) => m.mentor).filter((m) => user.role !== "MENTOR" || m.id === user.id),
    }))
    .filter((p) => p.mentors.length > 0);
}

/** Last completed + next upcoming session per project (cadence: at least every two weeks). */
export async function getCadence(projectIds: string[], now = new Date()) {
  if (projectIds.length === 0) return new Map<string, { last: Date | null; next: Date | null }>();
  const [last, next] = await Promise.all([
    prisma.mentorSession.groupBy({ by: ["projectId"], where: { projectId: { in: projectIds }, status: "COMPLETED" }, _max: { scheduledAt: true } }),
    prisma.mentorSession.groupBy({
      by: ["projectId"],
      where: { projectId: { in: projectIds }, status: { in: ["PLANNED", "CONFIRMED"] }, scheduledAt: { gte: now } },
      _min: { scheduledAt: true },
    }),
  ]);
  const map = new Map<string, { last: Date | null; next: Date | null }>();
  for (const id of projectIds) map.set(id, { last: null, next: null });
  for (const l of last) map.get(l.projectId)!.last = l._max.scheduledAt;
  for (const n of next) map.get(n.projectId)!.next = n._min.scheduledAt;
  return map;
}

export const CADENCE_DAYS = 14;

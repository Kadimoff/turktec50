"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { assertProjectAccess } from "@/lib/rbac";
import { logAudit, notify } from "@/lib/audit";
import { TASK_STATUSES, PRIORITIES, type ActionState } from "@/components/tasks/types";
import type { TaskStatus } from "@/generated/prisma/enums";

const WORK_ROLES = ["ADMIN", "TEAM", "MENTOR"] as const;

function revalidateTasks(projectId: string) {
  revalidatePath("/tasks");
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/dashboard");
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "errors.tooLong")
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const taskSchema = z.object({
  projectId: z.string().min(1, "errors.required"),
  title: z.string().trim().min(3, "errors.titleLength").max(160, "errors.titleLength"),
  acceptanceCriteria: z.string().trim().min(3, "errors.required").max(400, "errors.tooLong"),
  assigneeId: z
    .string()
    .optional()
    .transform((v) => (v ? v : null)),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "errors.dateInvalid"),
  priority: z.enum(PRIORITIES),
  week: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 8), "errors.invalid"),
  description: optionalText(2000),
});

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const k = String(issue.path[0] ?? "form");
    if (!out[k]) out[k] = issue.message.startsWith("errors.") ? issue.message : "errors.invalid";
  }
  return out;
}

/** Due date is stored at 18:00 Baku time of the chosen day (consistent with seeded data). */
function parseDue(d: string) {
  const date = new Date(`${d}T18:00:00+04:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function assertAssignee(projectId: string, assigneeId: string | null) {
  if (!assigneeId) return true;
  const m = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: assigneeId } }, select: { id: true } });
  return !!m;
}

async function canWorkOn(user: CurrentUser, projectId: string) {
  try {
    const access = await assertProjectAccess(user, projectId);
    return access.canWork;
  } catch {
    return false;
  }
}

export async function createTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser([...WORK_ROLES]);
  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "errors.invalid", fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;
  if (!(await canWorkOn(user, d.projectId))) return { ok: false, error: "errors.forbidden" };
  if (!(await assertAssignee(d.projectId, d.assigneeId))) return { ok: false, fieldErrors: { assigneeId: "errors.assigneeNotMember" } };
  const due = parseDue(d.dueDate);
  if (!due) return { ok: false, fieldErrors: { dueDate: "errors.dateInvalid" } };

  const task = await prisma.task.create({
    data: {
      projectId: d.projectId,
      title: d.title,
      acceptanceCriteria: d.acceptanceCriteria,
      assigneeId: d.assigneeId,
      createdById: user.id,
      dueDate: due,
      priority: d.priority,
      week: d.week,
      description: d.description ?? null,
    },
    select: { id: true, title: true },
  });
  await logAudit({ actorId: user.id, action: "task.create", entity: "Task", entityId: task.id, projectId: d.projectId, summary: task.title });
  if (d.assigneeId && d.assigneeId !== user.id) {
    await notify([d.assigneeId], "task_assigned", { title: task.title }, `/projects/${d.projectId}/tasks`);
  }
  revalidateTasks(d.projectId);
  return { ok: true };
}

export async function updateTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser([...WORK_ROLES]);
  const id = String(formData.get("id") ?? "");
  const existing = await prisma.task.findUnique({ where: { id }, select: { id: true, projectId: true, assigneeId: true } });
  if (!existing) return { ok: false, error: "errors.notFound" };
  // the project of an existing task cannot be changed
  formData.set("projectId", existing.projectId);
  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "errors.invalid", fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;
  if (!(await canWorkOn(user, existing.projectId))) return { ok: false, error: "errors.forbidden" };
  if (!(await assertAssignee(existing.projectId, d.assigneeId))) return { ok: false, fieldErrors: { assigneeId: "errors.assigneeNotMember" } };
  const due = parseDue(d.dueDate);
  if (!due) return { ok: false, fieldErrors: { dueDate: "errors.dateInvalid" } };

  const task = await prisma.task.update({
    where: { id },
    data: {
      title: d.title,
      acceptanceCriteria: d.acceptanceCriteria,
      assigneeId: d.assigneeId,
      dueDate: due,
      priority: d.priority,
      week: d.week,
      description: d.description ?? null,
    },
    select: { id: true, title: true },
  });
  await logAudit({ actorId: user.id, action: "task.update", entity: "Task", entityId: task.id, projectId: existing.projectId, summary: task.title });
  if (d.assigneeId && d.assigneeId !== existing.assigneeId && d.assigneeId !== user.id) {
    await notify([d.assigneeId], "task_assigned", { title: task.title }, `/projects/${existing.projectId}/tasks`);
  }
  revalidateTasks(existing.projectId);
  return { ok: true };
}

export async function setTaskStatus(id: string, status: TaskStatus): Promise<ActionState> {
  const user = await requireUser([...WORK_ROLES]);
  if (!(TASK_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "errors.invalid" };
  const task = await prisma.task.findUnique({ where: { id }, select: { id: true, title: true, status: true, projectId: true, createdById: true } });
  if (!task) return { ok: false, error: "errors.notFound" };
  if (!(await canWorkOn(user, task.projectId))) return { ok: false, error: "errors.forbidden" };
  // Completing a task is the team's act; mentors record feedback in sessions instead.
  if (status === "DONE" && user.role === "MENTOR") return { ok: false, error: "errors.mentorNoDone" };
  if (task.status === status) return { ok: true };

  await prisma.task.update({
    where: { id },
    data: { status, completedAt: status === "DONE" ? new Date() : null },
  });
  await logAudit({
    actorId: user.id,
    action: "task.status",
    entity: "Task",
    entityId: id,
    projectId: task.projectId,
    summary: `${task.title}: ${task.status} → ${status}`,
    meta: { from: task.status, to: status },
  });
  if (status === "DONE" && task.createdById && task.createdById !== user.id) {
    await notify([task.createdById], "task_done", { title: task.title }, `/projects/${task.projectId}/tasks`);
  }
  revalidateTasks(task.projectId);
  return { ok: true };
}

export async function deleteTask(id: string): Promise<ActionState> {
  const user = await requireUser([...WORK_ROLES]);
  const task = await prisma.task.findUnique({ where: { id }, select: { id: true, title: true, projectId: true, createdById: true } });
  if (!task) return { ok: false, error: "errors.notFound" };
  if (!(await canWorkOn(user, task.projectId))) return { ok: false, error: "errors.forbidden" };
  if (user.role !== "ADMIN" && task.createdById !== user.id) return { ok: false, error: "errors.deleteForbidden" };
  await prisma.task.delete({ where: { id } });
  await logAudit({ actorId: user.id, action: "task.delete", entity: "Task", entityId: id, projectId: task.projectId, summary: task.title });
  revalidateTasks(task.projectId);
  return { ok: true };
}

// Client-safe task view models (built on the server, serialized to client components).
import type { Priority, TaskStatus } from "@/generated/prisma/enums";

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "REVIEW", "DONE", "BLOCKED"] as const satisfies readonly TaskStatus[];
export const PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const satisfies readonly Priority[];

export type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  acceptanceCriteria: string | null;
  status: TaskStatus;
  priority: Priority;
  week: number | null;
  projectId: string;
  projectCode: string;
  projectTitle: string;
  assignee: { id: string; name: string } | null;
  /** yyyy-MM-dd (for the edit form) */
  dueISO: string;
  /** "20 okt" */
  dueAbs: string;
  /** calendar days from today (negative = past) */
  dueDays: number;
  overdue: boolean;
  completedAbs: string | null;
  source: { id: string; topic: string } | null;
  canEdit: boolean;
  canDelete: boolean;
  /** MENTOR may not mark a task DONE: completing is the team's act */
  canComplete: boolean;
};

export type TaskFormProject = {
  id: string;
  code: string;
  title: string;
  members: { id: string; name: string; isLead: boolean }[];
};

export type ActionState = {
  ok: boolean;
  /** translation key under the module namespace, e.g. "errors.forbidden" */
  error?: string;
  fieldErrors?: Record<string, string>;
};

export const initialActionState: ActionState = { ok: false };

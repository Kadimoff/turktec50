// Client-safe mentor session view models.
import type { SessionStatus, TaskStatus } from "@/generated/prisma/enums";

export type SessionStep = {
  index: number;
  text: string;
  /** task created from this step (matched by Task.sourceSessionId + title) */
  task: { id: string; status: TaskStatus } | null;
};

export type SessionItem = {
  id: string;
  projectId: string;
  projectCode: string;
  projectTitle: string;
  mentor: { id: string; name: string; title: string | null };
  status: SessionStatus;
  online: boolean;
  durationMin: number;
  topic: string;
  agenda: string | null;
  notes: string | null;
  steps: SessionStep[];
  /** "5 noy 2026, 10:30" */
  whenAbs: string;
  /** "2 gün sonra" */
  whenRel: string;
  day: string;
  month: string;
  weekday: string;
  time: string;
  /** yyyy-MM-ddTHH:mm (Baku) for the reschedule form */
  scheduledLocal: string;
  isPast: boolean;
  /** planned/confirmed but the meeting time has passed → mentor notes outstanding */
  needsNotes: boolean;
  can: {
    confirm: boolean;
    reschedule: boolean;
    cancel: boolean;
    complete: boolean;
    convert: boolean;
    editAgenda: boolean;
  };
};

export type PlanProject = {
  id: string;
  code: string;
  title: string;
  mentors: { id: string; name: string }[];
};

export type ActionState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export const initialActionState: ActionState = { ok: false };

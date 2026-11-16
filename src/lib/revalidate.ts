import "server-only";
import { revalidatePath } from "next/cache";

// Named sets of pages that show the same data. A mutation revalidates every set it touches, so no page keeps
// stale numbers (Next refreshes visited pages after an action today, but its docs call that temporary).
const SETS = {
  dashboard: ["/dashboard", "/kpi"],
  calendar: ["/calendar"],
  projects: ["/projects", "/process"], // process map counts projects per stage
  tasks: ["/tasks"],
  mentors: ["/mentors"],
  documents: ["/documents"],
  risks: ["/risks"],
  applications: ["/applications", "/process"],
  jury: ["/jury"],
  academy: ["/academy"],
  catalog: ["/academy/catalog", "/apply"],
  students: ["/academy/students"],
  teams: ["/academy/teams"],
  registry: ["/academy/registry"],
  trainings: ["/academy/trainings"],
  announcements: ["/announcements"],
  intake: ["/academy/intake"],
  admin: ["/admin/users", "/admin/workflow", "/admin/audit", "/admin/system"],
} as const;

export type RevalidateSet = keyof typeof SETS;

/** Revalidate one or more named page sets. */
export function revalidateSets(...sets: RevalidateSet[]) {
  for (const path of new Set(sets.flatMap((s) => SETS[s]))) revalidatePath(path);
}

/** A project's overview and (optionally) some of its tabs. */
export function revalidateProject(projectId: string, ...tabs: ("tasks" | "sessions" | "documents" | "risks" | "resources" | "evaluations" | "activity")[]) {
  revalidatePath(`/projects/${projectId}`);
  for (const tab of tabs) revalidatePath(`/projects/${projectId}/${tab}`);
}

/** Navigation badges, notification bell and anything rendered by the app layout. */
export function revalidateLayout() {
  revalidatePath("/", "layout");
}

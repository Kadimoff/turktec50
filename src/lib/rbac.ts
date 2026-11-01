import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Role-based visibility (TÜRKTECH 50 MVP rules):
 * - ADMIN: every project.
 * - TEAM: only projects they are a member of ("ekip yalnızca kendi çalışma alanını görür").
 * - MENTOR: only projects they are assigned to.
 * - JURY: only projects they are assigned to, read-only + evaluations.
 */
export function projectScope(user: CurrentUser): Prisma.ProjectWhereInput {
  switch (user.role) {
    case "ADMIN":
      return {};
    case "TEAM":
      return { members: { some: { userId: user.id } } };
    case "MENTOR":
      return { mentors: { some: { mentorId: user.id } } };
    case "JURY":
      return { jurors: { some: { juryId: user.id } } };
  }
}

export type ProjectTab = "overview" | "tasks" | "sessions" | "documents" | "risks" | "evaluations" | "activity";

export type ProjectAccess = {
  projectId: string;
  isAdmin: boolean;
  isMember: boolean;
  isMentor: boolean;
  isJury: boolean;
  /** may create/update tasks, risks, upload documents */
  canWork: boolean;
  /** may review checklist items (approve/reject) */
  canReview: boolean;
  /** may manage stage, assignments, KPI flags */
  canManage: boolean;
  /** may score with a jury rubric */
  canEvaluate: boolean;
  tabs: ProjectTab[];
};

/** Resolve access of `user` to a project. Calls notFound() when the user may not see it (no existence leak). */
export async function getProjectAccess(user: CurrentUser, projectId: string): Promise<ProjectAccess> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...projectScope(user) },
    select: { id: true },
  });
  if (!project) notFound();
  const isAdmin = user.role === "ADMIN";
  const isMember = user.role === "TEAM";
  const isMentor = user.role === "MENTOR";
  const isJury = user.role === "JURY";
  const tabs: ProjectTab[] = isJury
    ? ["overview", "documents", "evaluations"]
    : isMember
      ? ["overview", "tasks", "sessions", "documents", "risks", "evaluations", "activity"]
      : ["overview", "tasks", "sessions", "documents", "risks", "evaluations", "activity"];
  return {
    projectId,
    isAdmin,
    isMember,
    isMentor,
    isJury,
    canWork: isAdmin || isMember || isMentor,
    canReview: isAdmin || isMentor,
    canManage: isAdmin,
    canEvaluate: isAdmin || isJury,
    tabs,
  };
}

/** Throwing variant for server actions: returns access or throws (actions must not render notFound UI). */
export async function assertProjectAccess(user: CurrentUser, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...projectScope(user) },
    select: { id: true },
  });
  if (!project) throw new Error("FORBIDDEN");
  return getProjectAccess(user, projectId);
}

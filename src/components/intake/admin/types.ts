// Coordinator side of the public preparation requests — pure types shared by server helpers, actions and client components.
import type { IntakeStatus } from "@/generated/prisma/enums";
import type { ActionState } from "@/lib/action-state";

/** Result of an intake server action. `message` / `errors` values are keys in the `intakeAdmin` namespace. */
export type IntakeActionState = ActionState & {
  /** the request changed since the page was rendered (reload needed) */
  stale?: boolean;
  teamId?: string;
};

/** danger = blocks acceptance; warning = needs attention; info = for the record. */
export type CheckLevel = "danger" | "warning" | "info";

/** Control check keys -> intakeAdmin.checks.<key> (params are plain strings). */
export type MemberCheckKey =
  | "duplicateEmail" | "inTeam" | "archived" | "otherUniversity" | "facultyUnavailable" // blocking
  | "otherRequest" | "captainElsewhere" // warning
  | "existing"; // info
export type RequestCheckKey =
  | "facultyArchived" | "noMembers" // blocking
  | "untracked" // warning
  | "teamNameTaken"; // info

export type CheckIssue<K extends string = string> = { key: K; level: CheckLevel; params?: Record<string, string> };

export type IntakeChecks = {
  /** issues per IntakeMember id */
  members: Record<string, CheckIssue<MemberCheckKey>[]>;
  request: CheckIssue<RequestCheckKey>[];
  blocking: number;
  warnings: number;
};

/** Moves made through the plain "move" action (ACCEPTED has its own transaction). */
export const MOVE_TARGETS = ["UNDER_REVIEW", "NEEDS_CHANGES", "REJECTED"] as const satisfies readonly IntakeStatus[];
export type MoveTarget = (typeof MOVE_TARGETS)[number];

/** Serializable request summary for the decision panel. */
export type DecisionRequest = {
  id: string;
  code: string;
  teamName: string;
  status: IntakeStatus;
  updatedAt: string; // ISO — optimistic concurrency token
  memberCount: number;
  /** members already registered as students (linked, not duplicated) */
  existingStudents: number;
  captainName: string;
  competitionName: string;
  subcategory: string | null;
  untracked: boolean;
  blocking: number;
  teamId: string | null;
};

export type MentorOption = { id: string; name: string; teams: number };

import type { StudentStatus, TeamStatus } from "@/generated/prisma/enums";
import type { ActionState } from "@/lib/action-state";
import type { FacultyOption, UniversityOption } from "@/components/academy/students/types";

export type MentorOption = { id: string; name: string; active: boolean };
export type CompetitionOption = { id: string; name: string; eligible: boolean };
export type RosterStudent = { id: string; name: string; email: string; universityId: string; teamId: string | null; status: StudentStatus; faculty: string | null };

/** Options shared by every team dialog on the page (passed once through context). */
export type TeamFormOptions = {
  universities: UniversityOption[];
  defaultUniversityId: string;
  faculties: FacultyOption[];
  mentors: MentorOption[];
  competitions: CompetitionOption[];
  /** non-archived students without a team + current members of any team (dialog filters per team) */
  students: RosterStudent[];
};

/** Serializable team passed to the edit dialog / row actions. */
export type TeamFormValue = {
  id: string;
  name: string;
  universityId: string;
  facultyId: string | null;
  mentorId: string | null;
  competitionId: string | null;
  status: TeamStatus;
  notes: string | null;
  captainId: string | null;
  memberIds: string[];
};

/** Result of `createTeamApplication`: the new application's id and code on success. */
export type ApplicationActionState = ActionState & { applicationId?: string; code?: string };

/** Context for the "create application" dialog. */
export type ApplicationTeamValue = {
  id: string;
  name: string;
  university: string;
  competition: string;
  captainName: string;
  captainEmail: string;
  memberCount: number;
};

export const OPEN_APPLICATION_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "WAITLIST"] as const;
export const TEAM_STATUSES = ["FORMING", "ACTIVE", "ARCHIVED"] as const;

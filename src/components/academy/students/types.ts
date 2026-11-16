import type { StudentStatus } from "@/generated/prisma/enums";

export type UniversityOption = { id: string; label: string };
export type FacultyOption = { id: string; name: string; universityId: string; archived: boolean };
export type StudentTeamOption = { id: string; name: string; universityId: string; status: "FORMING" | "ACTIVE" | "ARCHIVED" };

/** Options shared by every student dialog on the page (passed once through context). */
export type StudentFormOptions = {
  universities: UniversityOption[];
  defaultUniversityId: string;
  faculties: FacultyOption[];
  teams: StudentTeamOption[];
};

/** Serializable student passed to the edit dialog / row actions. */
export type StudentFormValue = {
  id: string;
  name: string;
  email: string;
  universityId: string;
  facultyId: string | null;
  skills: string | null;
  notes: string | null;
  status: StudentStatus;
  teamId: string | null;
  teamName: string | null;
  isCaptain: boolean;
};

/** Statuses an admin may pick; IN_TEAM is always derived on the server from the team. */
export const PICKABLE_STUDENT_STATUSES = ["CANDIDATE", "SEEKING_TEAM", "ARCHIVED"] as const;

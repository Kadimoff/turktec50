// Serializable shapes shared by the public intake pages, client components and the "use server" actions file.
import type { IntakeStatus, RuleStatus } from "@/generated/prisma/enums";
import type { ActionState } from "@/lib/action-state";
import type { IntakeNeed } from "@/components/intake/shared";

export type CompetitionOption = {
  id: string;
  name: string;
  theme: string | null;
  subcategories: string[];
  /** Official TEKNOFEST page (HTTPS only, otherwise null). */
  url: string | null;
  ruleStatus: RuleStatus | null;
};
export type UniversityOption = { id: string; name: string; shortName: string };
export type FacultyOption = { id: string; name: string; universityId: string };

export type IntakeFormOptions = {
  competitions: CompetitionOption[];
  universities: UniversityOption[];
  faculties: FacultyOption[];
  defaultUniversityId: string;
};

export type MemberDraft = { key: string; name: string; email: string; facultyId: string; role: string };

/** Client form state (also the prefill of the edit form). members[0] is the captain. */
export type IntakeDraft = {
  competitionId: string;
  subcategory: string;
  teamName: string;
  universityId: string;
  facultyId: string;
  members: MemberDraft[];
  projectIdea: string;
  needs: IntakeNeed[];
  needsNote: string;
  consent: boolean;
};

/** What the client sends to a submit / update action (validated again on the server with intakeFormSchema). */
export type IntakeSubmission = {
  values: Omit<IntakeDraft, "members"> & { members: Omit<MemberDraft, "key">[] };
  /** honeypot — always empty for people */
  website?: string;
};

/**
 * Submit / update result. `message` and the values of `errors` (field path, e.g. "teamName", "members.1.email") are `intake.*` keys;
 * on success `code` + `path` (and the absolute `link` when the host is known) of the private tracking page.
 */
export type IntakeActionState = ActionState & { code?: string; path?: string; link?: string | null };

/** Read-only lookup result: on success the code, status and dates (ISO). */
export type LookupState = ActionState & { code?: string; status?: IntakeStatus; submittedAt?: string; changedAt?: string };

// Public "preparation request" intake — rules shared by the public form, the coordinator panel and server actions.
// Pure module (no server-only imports): safe in client components.
import { z } from "zod";
import type { IntakeStatus } from "@/generated/prisma/enums";

/** Support the team asks the Academy for. key -> intake.needs.<key> */
export const INTAKE_NEEDS = ["mentor", "lab", "materials", "training", "application_package", "partner"] as const;
export type IntakeNeed = (typeof INTAKE_NEEDS)[number];

export const INTAKE_LIMITS = {
  minMembers: 1, // the captain alone may apply; members can be added later through the tracking link
  maxMembers: 10,
  teamName: 120,
  personName: 120,
  email: 160,
  role: 80,
  subcategory: 200,
  projectIdeaMin: 30,
  projectIdea: 1500,
  needsNote: 1000,
  reviewNoteMin: 10,
  reviewNoteMax: 1000,
  // spam control: open requests per captain e-mail (the time-window limits are LIMITS.intake* in src/lib/rate-limit.ts)
  openPerCaptain: 2,
} as const;

export const INTAKE_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "NEEDS_CHANGES", "ACCEPTED", "REJECTED", "WITHDRAWN"] as const satisfies readonly IntakeStatus[];
/** Not decided yet (counts towards the per-captain limit, shown as "open" to coordinators). */
export const OPEN_INTAKE_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "NEEDS_CHANGES"] as const satisfies readonly IntakeStatus[];
/** Students may edit / withdraw through their tracking link only in these states (never while a coordinator reviews it). */
export const STUDENT_EDITABLE_STATUSES = ["SUBMITTED", "NEEDS_CHANGES"] as const satisfies readonly IntakeStatus[];

/** Coordinator moves. ACCEPTED is only possible from UNDER_REVIEW (the coordinator accepts the version they reviewed). */
export const ADMIN_TRANSITIONS: Record<IntakeStatus, readonly IntakeStatus[]> = {
  SUBMITTED: ["UNDER_REVIEW", "NEEDS_CHANGES", "REJECTED"],
  UNDER_REVIEW: ["NEEDS_CHANGES", "ACCEPTED", "REJECTED"],
  NEEDS_CHANGES: ["REJECTED"],
  ACCEPTED: [],
  REJECTED: [],
  WITHDRAWN: [],
};
export const canAdminMove = (from: IntakeStatus, to: IntakeStatus) => ADMIN_TRANSITIONS[from].includes(to);
/** A human decision always carries a written reason (10–1000 chars). */
export const noteRequired = (to: IntakeStatus) => to === "NEEDS_CHANGES" || to === "ACCEPTED" || to === "REJECTED";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const intakeMemberSchema = z.object({
  name: z.string().trim().min(3, "errors.nameShort").max(INTAKE_LIMITS.personName, "errors.nameLong"),
  email: z.string().trim().toLowerCase().max(INTAKE_LIMITS.email, "errors.email").regex(EMAIL_RE, "errors.email"),
  facultyId: z.string().trim().optional(),
  role: z.string().trim().max(INTAKE_LIMITS.role, "errors.roleLong").optional(),
});

/** Submitted form. `members[0]` is the captain. Error messages are keys in the `intake` namespace. */
export const intakeFormSchema = z
  .object({
    competitionId: z.string().min(1, "errors.competition"),
    subcategory: z.string().trim().max(INTAKE_LIMITS.subcategory, "errors.subcategory").optional(),
    teamName: z.string().trim().min(2, "errors.teamNameShort").max(INTAKE_LIMITS.teamName, "errors.teamNameLong"),
    universityId: z.string().min(1, "errors.university"),
    facultyId: z.string().trim().optional(),
    members: z.array(intakeMemberSchema).min(INTAKE_LIMITS.minMembers, "errors.members").max(INTAKE_LIMITS.maxMembers, "errors.tooManyMembers"),
    projectIdea: z.string().trim().min(INTAKE_LIMITS.projectIdeaMin, "errors.ideaShort").max(INTAKE_LIMITS.projectIdea, "errors.ideaLong"),
    needs: z.array(z.enum(INTAKE_NEEDS)).max(INTAKE_NEEDS.length),
    needsNote: z.string().trim().max(INTAKE_LIMITS.needsNote, "errors.needsNoteLong").optional(),
    consent: z.literal(true, "errors.consent"),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    v.members.forEach((m, i) => {
      if (seen.has(m.email)) ctx.addIssue({ code: "custom", path: ["members", i, "email"], message: "errors.duplicateEmail" });
      seen.add(m.email);
    });
  });
export type IntakeFormInput = z.input<typeof intakeFormSchema>;
export type IntakeFormValue = z.output<typeof intakeFormSchema>;

"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit, notify } from "@/lib/audit";
import { done, fail, formStr, isUniqueViolation, RuleError, zodErrors } from "@/lib/actions";
import { revalidateSets } from "@/lib/revalidate";
import { assertCompetitionEligible, assertFacultyUsable, assertMentorUsable, setCaptain, setTeamRoster } from "@/lib/academy/rules";
import { canAdminMove, INTAKE_LIMITS, INTAKE_NEEDS, noteRequired } from "@/components/intake/shared";
import { checkSelect, computeIntakeChecks } from "@/components/intake/admin/checks";
import { MOVE_TARGETS, type IntakeActionState } from "@/components/intake/admin/types";

// Message / error keys are in the `intakeAdmin` namespace.
const STALE = "errors.stale";
const stale = (): IntakeActionState => ({ ...fail(STALE), stale: true });
const ruleFail = (e: RuleError): IntakeActionState => (e.key === STALE ? stale() : fail(e.key, e.field ? { [e.field]: e.key } : undefined));

function refresh(id: string) {
  revalidateSets("intake", "academy");
  revalidatePath(`/academy/intake/${id}`);
}

const seenAt = z.string().refine((s) => s.length > 0 && !Number.isNaN(Date.parse(s)), STALE);
const note = z.string().trim().max(INTAKE_LIMITS.reviewNoteMax, "errors.noteLong");

/** zod failure → stale (the `updatedAt` token is missing / broken) or the first field error. */
function invalid(issues: z.core.$ZodIssue[]): IntakeActionState {
  const errors = zodErrors(issues);
  if (errors.updatedAt) return stale();
  return fail(Object.values(errors)[0] ?? "errors.invalid", errors);
}

const moveSchema = z
  .object({ id: z.string().min(1, "errors.notFound"), to: z.enum(MOVE_TARGETS, "errors.transition"), updatedAt: seenAt, note })
  .superRefine((v, ctx) => {
    if (noteRequired(v.to) && v.note.length < INTAKE_LIMITS.reviewNoteMin) ctx.addIssue({ code: "custom", path: ["note"], message: "errors.noteShort" });
  });

/**
 * Coordinator status move (ADMIN): UNDER_REVIEW ("take into review", no note), NEEDS_CHANGES or REJECTED (written reason 10–1000).
 * Only ADMIN_TRANSITIONS moves; the update is conditional on the status and the `updatedAt` the coordinator saw, so a parallel edit by the
 * students or another coordinator is never overwritten ("changed meanwhile — reload").
 */
export async function moveIntake(_prev: IntakeActionState, fd: FormData): Promise<IntakeActionState> {
  const user = await requireUser(["ADMIN"]);
  const parsed = moveSchema.safeParse({ id: formStr(fd, "id") ?? "", to: formStr(fd, "to") ?? "", updatedAt: formStr(fd, "updatedAt") ?? "", note: formStr(fd, "note") ?? "" });
  if (!parsed.success) return invalid(parsed.error.issues);
  const v = parsed.data;
  const seen = new Date(v.updatedAt);

  const req = await prisma.intakeRequest.findUnique({ where: { id: v.id }, select: { id: true, code: true, teamName: true, status: true, updatedAt: true } });
  if (!req) return fail("errors.notFound");
  if (req.updatedAt.getTime() !== seen.getTime()) return stale();
  if (!canAdminMove(req.status, v.to)) return fail("errors.transition");
  const reviewNote = noteRequired(v.to) ? v.note : null;

  try {
    await prisma.$transaction(async (tx) => {
      const claim = await tx.intakeRequest.updateMany({
        where: { id: req.id, status: req.status, updatedAt: seen },
        data: { status: v.to, reviewerId: user.id, reviewNote, reviewedAt: new Date() },
      });
      if (claim.count !== 1) throw new RuleError(STALE);
      await tx.intakeEvent.create({ data: { requestId: req.id, from: req.status, to: v.to, note: reviewNote, actorId: user.id, source: "admin" } });
    });
  } catch (e) {
    if (e instanceof RuleError) return ruleFail(e);
    throw e;
  }

  await logAudit({
    actorId: user.id,
    action: v.to === "REJECTED" ? "intake.reject" : "intake.review",
    entity: "IntakeRequest",
    entityId: req.id,
    summary: `${req.code} · ${req.teamName}`,
    meta: { from: req.status, to: v.to, note: reviewNote },
  });
  refresh(req.id);
  return done(`toast.moved.${v.to}`);
}

const acceptSchema = z.object({
  id: z.string().min(1, "errors.notFound"),
  updatedAt: seenAt,
  note: note.min(INTAKE_LIMITS.reviewNoteMin, "errors.noteShort"),
  mentorId: z.string().optional(),
});

/**
 * Accept a request (ADMIN, only from UNDER_REVIEW) in ONE transaction: claim the reviewed version → re-run the control checks → the shared
 * Academy rules (src/lib/academy/rules.ts) for faculty, mentor and competition → ACTIVE Team → a Student record per new member →
 * roster + captain through the shared roster rules → request.teamId + history event. A catalog card whose 2027 rules are not tracked yet
 * starts being tracked (a team may only target tracked catalog competitions).
 */
export async function acceptIntake(_prev: IntakeActionState, fd: FormData): Promise<IntakeActionState> {
  const user = await requireUser(["ADMIN"]);
  const parsed = acceptSchema.safeParse({
    id: formStr(fd, "id") ?? "",
    updatedAt: formStr(fd, "updatedAt") ?? "",
    note: formStr(fd, "note") ?? "",
    mentorId: formStr(fd, "mentorId") || undefined,
  });
  if (!parsed.success) return invalid(parsed.error.issues);
  const v = parsed.data;
  const seen = new Date(v.updatedAt);

  const pre = await prisma.intakeRequest.findUnique({ where: { id: v.id }, select: { id: true, status: true, updatedAt: true } });
  if (!pre) return fail("errors.notFound");
  if (pre.updatedAt.getTime() !== seen.getTime()) return stale();
  if (pre.status !== "UNDER_REVIEW") return fail("errors.acceptFromReview");

  const t = await getTranslations("intakeAdmin");
  const now = new Date();

  let out: {
    code: string; teamName: string; teamId: string; captain: string; competition: { id: string; name: string }; tracked: boolean;
    mentor: { id: string; name: string } | null;
    created: { id: string; name: string }[]; linked: { id: string; name: string }[]; captaincyCleared: string[];
  };
  try {
    out = await prisma.$transaction(
      async (tx) => {
        const claim = await tx.intakeRequest.updateMany({
          where: { id: v.id, status: "UNDER_REVIEW", updatedAt: seen },
          data: { status: "ACCEPTED", reviewerId: user.id, reviewNote: v.note, reviewedAt: now },
        });
        if (claim.count !== 1) throw new RuleError(STALE);

        const r = await tx.intakeRequest.findUniqueOrThrow({
          where: { id: v.id },
          select: {
            ...checkSelect,
            code: true, facultyId: true, subcategory: true, projectIdea: true, needs: true, needsNote: true,
            competition: { select: { id: true, name: true, catalogId: true, ruleStatus: true } },
            members: {
              select: { id: true, name: true, email: true, role: true, isCaptain: true, facultyId: true, faculty: { select: { name: true, status: true, universityId: true } } },
              orderBy: { order: "asc" },
            },
          },
        });
        if (r.teamId) throw new RuleError("errors.alreadyLinked");
        // the warnings the coordinator saw, re-run inside the transaction (never trust the disabled button)
        const checks = (await computeIntakeChecks(tx, [r])).get(r.id)!;
        if (checks.blocking > 0 || r.members.length === 0) throw new RuleError("errors.blocked");

        // ---- shared Academy rules (the same ones the team / student dialogs use)
        await assertFacultyUsable(tx, r.facultyId, r.universityId);
        await assertMentorUsable(tx, v.mentorId, null, "mentorId");
        let tracked = false;
        if (r.competition.catalogId !== null && r.competition.ruleStatus === null) {
          const c = await tx.competition.updateMany({
            where: { id: r.competition.id, ruleStatus: null },
            data: { ruleStatus: "TRACKING", ruleOwnerId: user.id, ruleCheckedAt: now },
          });
          tracked = c.count === 1;
        }
        await assertCompetitionEligible(tx, r.competition.id);
        const mentor = v.mentorId ? await tx.user.findUniqueOrThrow({ where: { id: v.mentorId }, select: { id: true, name: true } }) : null;

        const email = (m: { email: string }) => m.email.trim().toLowerCase();
        const existing = await tx.student.findMany({ where: { email: { in: r.members.map(email) } }, select: { id: true, email: true, name: true } });
        const byEmail = new Map(existing.map((s) => [s.email, s]));

        const needs = r.needs.filter((n): n is (typeof INTAKE_NEEDS)[number] => (INTAKE_NEEDS as readonly string[]).includes(n));
        const notes = [
          t("teamNotes.source", { code: r.code }),
          r.subcategory ? t("teamNotes.subcategory", { value: r.subcategory }) : null,
          t("teamNotes.idea", { value: r.projectIdea }),
          needs.length ? t("teamNotes.needs", { value: needs.map((n) => t(`needs.${n}`)).join(", ") }) : null,
          r.needsNote ? t("teamNotes.needsNote", { value: r.needsNote }) : null,
        ]
          .filter(Boolean)
          .join("\n");
        // Team.notes is edited later through the team dialog (max 2000)
        const teamNotes = notes.length > 2000 ? `${notes.slice(0, 1999)}…` : notes;

        const team = await tx.team.create({
          data: {
            name: r.teamName, universityId: r.universityId, facultyId: r.facultyId, status: "ACTIVE", competitionId: r.competition.id,
            mentorId: mentor?.id ?? null, notes: teamNotes,
          },
          select: { id: true },
        });

        // new members become Student records (faculty checked by the shared rule), then the roster rule claims everyone
        const created: { id: string; name: string; email: string }[] = [];
        for (const m of r.members) {
          if (byEmail.has(email(m)) || created.some((s) => s.email === email(m))) continue;
          const facultyId = m.facultyId ?? r.facultyId ?? null;
          await assertFacultyUsable(tx, facultyId, r.universityId, null, "members");
          created.push(
            await tx.student.create({
              data: { name: m.name, email: email(m), universityId: r.universityId, facultyId, skills: m.role ? m.role.slice(0, 300) : null, status: "SEEKING_TEAM" },
              select: { id: true, name: true, email: true },
            }),
          );
        }
        const ids = [...created, ...existing].map((s) => s.id);
        await setTeamRoster(tx, team.id, r.universityId, ids);

        // a student captains at most one team: other captaincies of the new members end here, then the captain is set
        const formerCaptaincies = await tx.team.findMany({ where: { captainId: { in: ids }, id: { not: team.id } }, select: { name: true } });
        if (formerCaptaincies.length) await tx.team.updateMany({ where: { captainId: { in: ids }, id: { not: team.id } }, data: { captainId: null } });
        const captainMember = r.members.find((m) => m.isCaptain) ?? r.members[0]!;
        const captain = byEmail.get(email(captainMember)) ?? created.find((s) => s.email === email(captainMember))!;
        await setCaptain(tx, team.id, captain.id);

        await tx.intakeRequest.update({ where: { id: r.id }, data: { teamId: team.id } });
        await tx.intakeEvent.create({ data: { requestId: r.id, from: "UNDER_REVIEW", to: "ACCEPTED", note: v.note, actorId: user.id, source: "admin" } });

        return {
          code: r.code, teamName: r.teamName, teamId: team.id, captain: captain.name, competition: { id: r.competition.id, name: r.competition.name }, tracked,
          mentor, created: created.map(({ id, name }) => ({ id, name })), linked: existing.map(({ id, name }) => ({ id, name })),
          captaincyCleared: formerCaptaincies.map((x) => x.name),
        };
      },
      { timeout: 20_000 },
    );
  } catch (e) {
    if (e instanceof RuleError) return ruleFail(e);
    if (isUniqueViolation(e)) return fail("errors.emailConflict");
    throw e;
  }

  // ---- audit (after commit), notification, refresh
  await logAudit({
    actorId: user.id,
    action: "intake.accept",
    entity: "IntakeRequest",
    entityId: v.id,
    summary: `${out.code} · ${out.teamName}`,
    meta: {
      from: "UNDER_REVIEW", to: "ACCEPTED", note: v.note, teamId: out.teamId, mentor: out.mentor?.name ?? null,
      studentsCreated: out.created.length, studentsLinked: out.linked.length, trackingStarted: out.tracked,
    },
  });
  for (const s of out.created) {
    await logAudit({
      actorId: user.id, action: "student.create", entity: "Student", entityId: s.id, summary: s.name,
      meta: { status: "IN_TEAM", team: out.teamName, source: "intake", request: out.code },
    });
  }
  const memberNames = [...out.created, ...out.linked].map((s) => s.name);
  await logAudit({
    actorId: user.id, action: "team.create", entity: "Team", entityId: out.teamId, summary: out.teamName,
    meta: { status: "ACTIVE", members: memberNames.length, captain: out.captain, source: "intake", request: out.code, captaincyCleared: out.captaincyCleared },
  });
  await logAudit({
    actorId: user.id, action: "team.members", entity: "Team", entityId: out.teamId, summary: `${out.teamName}: +${memberNames.length} / −0`,
    meta: { added: memberNames, removed: [], archived: false, source: "intake" },
  });
  if (out.tracked) {
    await logAudit({
      actorId: user.id, action: "competition.track", entity: "Competition", entityId: out.competition.id, summary: out.competition.name,
      meta: { from: null, to: "TRACKING", source: "intake", request: out.code },
    });
  }
  if (out.mentor) await notify([out.mentor.id], "team_mentor", { team: out.teamName }, "/academy/teams");

  refresh(v.id);
  revalidateSets("teams", "students", "catalog", "calendar", "dashboard", "projects");
  return done("toast.accepted", { teamId: out.teamId });
}

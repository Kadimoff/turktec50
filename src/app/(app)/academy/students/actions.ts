"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { type ActionState, done, fail, failFromZod, formStr, isUniqueViolation, RuleError } from "@/lib/actions";
import { assertFacultyUsable, moveStudent } from "@/lib/academy/rules";
import { revalidateSets } from "@/lib/revalidate";

/** Every page that shows students, team rosters or the counts derived from them. */
const refresh = () => revalidateSets("students", "teams", "academy", "intake", "dashboard");

const studentSchema = z.object({
  studentId: z.string().optional(),
  name: z.string().trim().min(2, "errors.nameShort").max(120, "errors.nameLong"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(160, "errors.email")
    .pipe(z.email("errors.email")),
  universityId: z.string().min(1, "errors.universityRequired"),
  facultyId: z.string().optional(),
  skills: z.string().trim().max(300, "errors.tooLong").optional(),
  notes: z.string().trim().max(2000, "errors.tooLong").optional(),
  status: z.enum(["CANDIDATE", "SEEKING_TEAM", "IN_TEAM", "ARCHIVED"], "errors.invalid"),
  teamId: z.string().optional(),
});

type TeamMove = { from: string | null; to: string | null; changed: boolean };

/** One `team.members` entry per team a student left or joined (summary stays language-neutral: names + counts). */
async function logMembership(actorId: string, studentName: string, move: TeamMove, source: "student.update" | "student.delete") {
  if (!move.changed) return;
  const ids = [move.from, move.to].filter((x): x is string => !!x);
  const teams = ids.length ? await prisma.team.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  const nameOf = (id: string) => teams.find((tm) => tm.id === id)?.name ?? id;
  if (move.from) {
    await logAudit({
      actorId, action: "team.members", entity: "Team", entityId: move.from, summary: `${nameOf(move.from)}: +0 / −1`,
      meta: { added: [], removed: [studentName], source },
    });
  }
  if (move.to) {
    await logAudit({
      actorId, action: "team.members", entity: "Team", entityId: move.to, summary: `${nameOf(move.to)}: +1 / −0`,
      meta: { added: [studentName], removed: [], source },
    });
  }
}

/**
 * Register / edit a student (ADMIN). Mirrors the Academy panel rules:
 * email trimmed + lower-cased and unique; a team can only be chosen after registration;
 * an archived student cannot join a team; status is derived — team set → IN_TEAM, no team + IN_TEAM → SEEKING_TEAM;
 * archiving (or leaving / switching the team) removes the student from the old team and clears its captaincy.
 * Faculty and membership rules come from `@/lib/academy/rules` and are checked inside the transaction.
 */
export async function saveStudent(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(["ADMIN"]);
  const parsed = studentSchema.safeParse({
    studentId: formStr(fd, "studentId") || undefined,
    name: formStr(fd, "name") ?? "",
    email: formStr(fd, "email") ?? "",
    universityId: formStr(fd, "universityId") ?? "",
    facultyId: formStr(fd, "facultyId") || undefined,
    skills: formStr(fd, "skills"),
    notes: formStr(fd, "notes"),
    status: formStr(fd, "status") ?? "",
    teamId: formStr(fd, "teamId") || undefined,
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const v = parsed.data;

  const existing = v.studentId
    ? await prisma.student.findUnique({
        where: { id: v.studentId },
        select: { id: true, status: true, teamId: true, universityId: true, facultyId: true, captainOf: { select: { id: true } }, team: { select: { name: true } } },
      })
    : null;
  if (v.studentId && !existing) return fail("errors.notFound");

  // a team can only be set on an existing (registered) student
  if (!existing && v.teamId) return fail("errors.registerFirst", { teamId: "errors.registerFirst" });

  const university = await prisma.university.findUnique({ where: { id: v.universityId }, select: { id: true } });
  if (!university) return fail("errors.universityRequired", { universityId: "errors.universityRequired" });

  // email must be unique (stored lower-case) — friendly field error instead of a crash
  const dup = await prisma.student.findUnique({ where: { email: v.email }, select: { id: true } });
  if (dup && dup.id !== existing?.id) return fail("errors.emailTaken", { email: "errors.emailTaken" });

  // ---- team + status derivation
  const archiving = v.status === "ARCHIVED";
  // archiving removes the student from the team; joining a *new* team while archived is not allowed
  if (archiving && v.teamId && v.teamId !== existing?.teamId) return fail("errors.archivedNoTeam", { teamId: "errors.archivedNoTeam" });
  const teamId = archiving ? null : (v.teamId ?? null);
  const status = archiving ? "ARCHIVED" : teamId ? "IN_TEAM" : v.status === "IN_TEAM" ? "SEEKING_TEAM" : v.status;
  // the faculty may stay as it is (even if archived since) unless the university changes
  const keptFaculty = existing && existing.universityId === v.universityId ? existing.facultyId : null;

  const fields = {
    name: v.name,
    email: v.email,
    universityId: v.universityId,
    facultyId: v.facultyId ?? null,
    skills: v.skills || null,
    notes: v.notes || null,
  };

  try {
    if (existing) {
      const move = await prisma.$transaction(async (tx) => {
        await assertFacultyUsable(tx, v.facultyId, v.universityId, keptFaculty);
        // staying in the current team is only possible within the same university
        if (teamId && teamId === existing.teamId && existing.universityId !== v.universityId) throw new RuleError("errors.teamUniversity", "teamId");
        // un-archiving and joining a team in one save: lift the archive first, the membership rule checks the status
        if (existing.status === "ARCHIVED" && teamId) await tx.student.update({ where: { id: existing.id }, data: { status: "SEEKING_TEAM" } });
        const m = await moveStudent(tx, existing.id, teamId, v.universityId);
        await tx.student.update({ where: { id: existing.id }, data: { ...fields, status } });
        return m;
      });
      await logAudit({
        actorId: user.id,
        action: "student.update",
        entity: "Student",
        entityId: existing.id,
        summary: v.name,
        meta: {
          status,
          from: { status: existing.status, team: existing.team?.name ?? null },
          ...(move.changed ? { teamChanged: true, captaincyCleared: !!existing.captainOf && existing.captainOf.id !== teamId } : {}),
        },
      });
      await logMembership(user.id, v.name, move, "student.update");
      refresh();
      return done(archiving && existing.status !== "ARCHIVED" ? "toast.studentArchived" : "toast.studentUpdated");
    }

    const created = await prisma.$transaction(async (tx) => {
      await assertFacultyUsable(tx, v.facultyId, v.universityId);
      return tx.student.create({ data: { ...fields, status, teamId: null }, select: { id: true } });
    });
    await logAudit({
      actorId: user.id,
      action: "student.create",
      entity: "Student",
      entityId: created.id,
      summary: v.name,
      meta: { status, universityId: v.universityId },
    });
    refresh();
    return done("toast.studentCreated");
  } catch (e) {
    if (e instanceof RuleError) return fail(e.key, e.field ? { [e.field]: e.key } : undefined);
    if (isUniqueViolation(e, "email")) return fail("errors.emailTaken", { email: "errors.emailTaken" });
    throw e;
  }
}

/** Delete a student (ADMIN). Leaving the team (and its captaincy) goes through the membership rule in the same transaction. */
export async function deleteStudent(studentId: string): Promise<ActionState> {
  const user = await requireUser(["ADMIN"]);
  const id = z.string().min(1).safeParse(studentId);
  if (!id.success) return fail("errors.invalid");
  const student = await prisma.student.findUnique({
    where: { id: id.data },
    select: { id: true, name: true, email: true, universityId: true, team: { select: { name: true } }, captainOf: { select: { id: true } } },
  });
  if (!student) return fail("errors.notFound");
  let move: TeamMove;
  try {
    move = await prisma.$transaction(async (tx) => {
      const m = await moveStudent(tx, student.id, null, student.universityId);
      await tx.student.delete({ where: { id: student.id } });
      return m;
    });
  } catch (e) {
    if (e instanceof RuleError) return fail(e.key);
    throw e;
  }
  await logAudit({
    actorId: user.id,
    action: "student.delete",
    entity: "Student",
    entityId: student.id,
    summary: student.name,
    meta: { email: student.email, team: student.team?.name ?? null, wasCaptain: !!student.captainOf },
  });
  await logMembership(user.id, student.name, move, "student.delete");
  refresh();
  return done("toast.studentDeleted");
}

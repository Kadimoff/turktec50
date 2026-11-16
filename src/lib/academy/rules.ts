import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { RuleError } from "@/lib/actions";

// Academy registry rules — the ONLY implementation, used by students, teams, intake (accept) and projects actions.
// Each check throws RuleError(errorKey, field) so callers inside a transaction roll back cleanly.

type Tx = Prisma.TransactionClient;

/**
 * A faculty can be chosen when it belongs to `universityId` and is not ARCHIVED.
 * Keeping the value a record already has (`previousId`) is always allowed, even if it was archived since.
 */
export async function assertFacultyUsable(tx: Tx, facultyId: string | null | undefined, universityId: string, previousId?: string | null, field = "facultyId") {
  if (!facultyId || facultyId === previousId) return;
  const f = await tx.faculty.findFirst({ where: { id: facultyId, universityId }, select: { status: true } });
  if (!f || f.status === "ARCHIVED") throw new RuleError("errors.faculty", field);
}

/** Competitions a team/project may target: non-catalog competitions, or catalog cards the department tracks (or the current value). */
export async function assertCompetitionEligible(tx: Tx, competitionId: string | null | undefined, previousId?: string | null, field = "competitionId") {
  if (!competitionId || competitionId === previousId) return;
  const c = await tx.competition.findFirst({ where: { id: competitionId, OR: [{ catalogId: null }, { ruleStatus: { not: null } }] }, select: { id: true } });
  if (!c) throw new RuleError("errors.competition", field);
}

/** Prisma filter for the competitions offered in pickers (same rule as above). */
export const eligibleCompetitionWhere = (currentId?: string | null): Prisma.CompetitionWhereInput => ({
  OR: [{ catalogId: null }, { ruleStatus: { not: null } }, ...(currentId ? [{ id: currentId }] : [])],
});

/** A mentor must be an active MENTOR account (keeping the current one is allowed). */
export async function assertMentorUsable(tx: Tx, mentorId: string | null | undefined, previousId?: string | null, field = "mentorId") {
  if (!mentorId || mentorId === previousId) return;
  const m = await tx.user.findFirst({ where: { id: mentorId, role: "MENTOR", active: true }, select: { id: true } });
  if (!m) throw new RuleError("errors.mentor", field);
}

/** Students that may be put in `teamId`: same university, not ARCHIVED, without a team or already in this team. */
export const joinableStudentWhere = (universityId: string, teamId?: string | null): Prisma.StudentWhereInput => ({
  universityId,
  status: { not: "ARCHIVED" },
  OR: [{ teamId: null }, ...(teamId ? [{ teamId }] : [])],
});

/** Release students from their team: back to SEEKING_TEAM (ARCHIVED students keep their status). Returns the count. */
export async function releaseStudents(tx: Tx, where: Prisma.StudentWhereInput) {
  const a = await tx.student.updateMany({ where: { ...where, status: { not: "ARCHIVED" } }, data: { teamId: null, status: "SEEKING_TEAM" } });
  const b = await tx.student.updateMany({ where: { ...where, status: "ARCHIVED" }, data: { teamId: null } });
  return a.count + b.count;
}

/**
 * Make `memberIds` exactly the roster of `teamId` (inside a transaction): removed members are released, added ones
 * are claimed with the eligibility rule re-checked by the UPDATE itself (so a concurrent move cannot slip through).
 */
export async function setTeamRoster(tx: Tx, teamId: string, universityId: string, memberIds: string[]) {
  const before = (await tx.student.findMany({ where: { teamId }, select: { id: true } })).map((s) => s.id);
  const wanted = [...new Set(memberIds)];
  const removed = before.filter((id) => !wanted.includes(id));
  const added = wanted.filter((id) => !before.includes(id));
  if (removed.length) await releaseStudents(tx, { id: { in: removed }, teamId });
  if (wanted.length) {
    const claimed = await tx.student.updateMany({ where: { id: { in: wanted }, ...joinableStudentWhere(universityId, teamId) }, data: { teamId, status: "IN_TEAM" } });
    if (claimed.count !== wanted.length) throw new RuleError("errors.memberInvalid", "members");
  }
  return { added, removed };
}

/** Put one student in a team (or take them out with `teamId = null`), keeping status and captaincy consistent. */
export async function moveStudent(tx: Tx, studentId: string, teamId: string | null, universityId: string) {
  const s = await tx.student.findUnique({ where: { id: studentId }, select: { teamId: true, status: true, captainOf: { select: { id: true } } } });
  if (!s) throw new RuleError("errors.notFound");
  if (s.teamId === teamId) return { from: s.teamId, to: teamId, changed: false };
  if (teamId) {
    if (s.status === "ARCHIVED") throw new RuleError("errors.archivedTeam", "teamId");
    const team = await tx.team.findFirst({ where: { id: teamId, universityId, status: { not: "ARCHIVED" } }, select: { id: true } });
    if (!team) throw new RuleError("errors.team", "teamId");
  }
  if (s.captainOf && s.captainOf.id !== teamId) await tx.team.update({ where: { id: s.captainOf.id }, data: { captainId: null } });
  await tx.student.update({
    where: { id: studentId },
    data: { teamId, status: teamId ? "IN_TEAM" : s.status === "ARCHIVED" ? "ARCHIVED" : "SEEKING_TEAM" },
  });
  return { from: s.teamId, to: teamId, changed: true };
}

/** Set (or clear) a team's captain; the student must be in the team. Clears their captaincy of any other team first. */
export async function setCaptain(tx: Tx, teamId: string, studentId: string | null) {
  if (studentId) {
    const inTeam = await tx.student.count({ where: { id: studentId, teamId } });
    if (!inTeam) throw new RuleError("errors.captainNotMember", "captainId");
    await tx.team.updateMany({ where: { captainId: studentId, id: { not: teamId } }, data: { captainId: null } });
  }
  await tx.team.update({ where: { id: teamId }, data: { captainId: studentId } });
}

/** Archive or delete preparation: release everyone and clear the captain. */
export async function releaseTeam(tx: Tx, teamId: string) {
  await tx.team.update({ where: { id: teamId }, data: { captainId: null } });
  return releaseStudents(tx, { teamId });
}

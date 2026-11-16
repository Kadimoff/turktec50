import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { OPEN_INTAKE_STATUSES } from "@/components/intake/shared";
import type { CheckIssue, IntakeChecks, MemberCheckKey, RequestCheckKey } from "./types";

type Db = Prisma.TransactionClient | typeof prisma;

/** Fields the control checks need — compose into any intake request query. */
export const checkSelect = {
  id: true,
  teamName: true,
  universityId: true,
  teamId: true,
  faculty: { select: { name: true, status: true, universityId: true } },
  competition: { select: { catalogId: true, ruleStatus: true } },
  members: {
    select: { id: true, email: true, isCaptain: true, facultyId: true, faculty: { select: { name: true, status: true, universityId: true } } },
    orderBy: { order: "asc" },
  },
} satisfies Prisma.IntakeRequestSelect;
export type CheckRow = Prisma.IntakeRequestGetPayload<{ select: typeof checkSelect }>;

const norm = (email: string) => email.trim().toLowerCase();

/**
 * Control warnings for intake requests (coordinator view + re-checked inside the accept transaction).
 * Blocking (danger): e-mail twice in the request, member already in another team, archived student, student registered at another
 * university, faculty archived / of another university, no members. Warning: e-mail in another open request, member is captain of another
 * team, competition not tracked. Info: already registered student (the record is linked, not duplicated), team name already used.
 * The system only surfaces these — the coordinator decides.
 */
export async function computeIntakeChecks(db: Db, rows: CheckRow[]): Promise<Map<string, IntakeChecks>> {
  const result = new Map<string, IntakeChecks>();
  if (rows.length === 0) return result;
  const emails = [...new Set(rows.flatMap((r) => r.members.map((m) => norm(m.email))))];

  const [students, openMembers, teams] = await Promise.all([
    emails.length
      ? db.student.findMany({
          where: { email: { in: emails } },
          select: {
            id: true, email: true, name: true, status: true, teamId: true, universityId: true,
            team: { select: { id: true, name: true } },
            university: { select: { shortName: true } },
            captainOf: { select: { id: true, name: true } },
          },
        })
      : Promise.resolve([]),
    emails.length
      ? db.intakeMember.findMany({
          where: { email: { in: emails }, request: { status: { in: [...OPEN_INTAKE_STATUSES] } } },
          select: { email: true, requestId: true, request: { select: { code: true } } },
        })
      : Promise.resolve([]),
    db.team.findMany({ select: { id: true, name: true } }),
  ]);

  const studentByEmail = new Map(students.map((s) => [norm(s.email), s]));
  const openByEmail = new Map<string, { requestId: string; code: string }[]>();
  for (const m of openMembers) {
    const k = norm(m.email);
    openByEmail.set(k, [...(openByEmail.get(k) ?? []), { requestId: m.requestId, code: m.request.code }]);
  }
  const teamByName = new Map<string, { id: string; name: string }[]>();
  for (const tm of teams) {
    const k = tm.name.trim().toLowerCase();
    teamByName.set(k, [...(teamByName.get(k) ?? []), tm]);
  }

  for (const r of rows) {
    const members: IntakeChecks["members"] = {};
    const request: CheckIssue<RequestCheckKey>[] = [];
    const counts = new Map<string, number>();
    for (const m of r.members) counts.set(norm(m.email), (counts.get(norm(m.email)) ?? 0) + 1);

    for (const m of r.members) {
      const email = norm(m.email);
      const issues: CheckIssue<MemberCheckKey>[] = [];
      if ((counts.get(email) ?? 0) > 1) issues.push({ key: "duplicateEmail", level: "danger" });
      const s = studentByEmail.get(email);
      if (s) {
        if (s.status === "ARCHIVED") issues.push({ key: "archived", level: "danger", params: { name: s.name } });
        if (s.teamId && s.teamId !== r.teamId) issues.push({ key: "inTeam", level: "danger", params: { team: s.team?.name ?? "—" } });
        if (s.universityId !== r.universityId) issues.push({ key: "otherUniversity", level: "danger", params: { university: s.university.shortName } });
        if (s.captainOf && s.captainOf.id !== r.teamId && s.captainOf.id !== s.teamId) {
          issues.push({ key: "captainElsewhere", level: "warning", params: { team: s.captainOf.name } });
        }
        issues.push({ key: "existing", level: "info", params: { name: s.name } });
      } else if (m.facultyId && m.faculty && (m.faculty.status === "ARCHIVED" || m.faculty.universityId !== r.universityId)) {
        // a new student record would be created with this faculty
        issues.push({ key: "facultyUnavailable", level: "danger", params: { faculty: m.faculty.name } });
      }
      const others = (openByEmail.get(email) ?? []).filter((o) => o.requestId !== r.id);
      if (others.length) issues.push({ key: "otherRequest", level: "warning", params: { codes: [...new Set(others.map((o) => o.code))].sort().join(", ") } });
      members[m.id] = issues;
    }

    if (r.members.length === 0) request.push({ key: "noMembers", level: "danger" });
    if (r.faculty && (r.faculty.status === "ARCHIVED" || r.faculty.universityId !== r.universityId)) {
      request.push({ key: "facultyArchived", level: "danger", params: { faculty: r.faculty.name } });
    }
    if (r.competition.catalogId !== null && r.competition.ruleStatus === null) request.push({ key: "untracked", level: "warning" });
    const sameName = (teamByName.get(r.teamName.trim().toLowerCase()) ?? []).filter((tm) => tm.id !== r.teamId);
    if (sameName.length) request.push({ key: "teamNameTaken", level: "info", params: { team: sameName[0]!.name } });

    const all = [...Object.values(members).flat(), ...request];
    result.set(r.id, {
      members,
      request,
      blocking: all.filter((i) => i.level === "danger").length,
      warnings: all.filter((i) => i.level === "warning").length,
    });
  }
  return result;
}

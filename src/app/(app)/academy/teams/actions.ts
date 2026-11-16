"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit, notify } from "@/lib/audit";
import { CATEGORIES } from "@/lib/constants";
import { type ActionState, done, fail, failFromZod, formStr, formStrs, isUniqueViolation, RuleError } from "@/lib/actions";
import {
  assertCompetitionEligible, assertFacultyUsable, assertMentorUsable, releaseTeam, setCaptain, setTeamRoster,
} from "@/lib/academy/rules";
import { nextApplicationCode, withUniqueRetry } from "@/lib/codes";
import { revalidateLayout, revalidateSets } from "@/lib/revalidate";
import { syncApplicationWorkflow } from "@/lib/workflow";
import { OPEN_APPLICATION_STATUSES, type ApplicationActionState } from "@/components/academy/teams/types";

/** Every page that shows teams, rosters or the counts derived from them (catalog cards count target teams). */
const refresh = () => revalidateSets("teams", "students", "academy", "intake", "dashboard", "catalog");

const ruleFail = (e: RuleError) => fail(e.key, e.field ? { [e.field]: e.key } : undefined);

const teamSchema = z.object({
  teamId: z.string().optional(),
  name: z.string().trim().min(2, "errors.teamNameShort").max(120, "errors.teamNameLong"),
  universityId: z.string().min(1, "errors.universityRequired"),
  facultyId: z.string().optional(),
  mentorId: z.string().optional(),
  competitionId: z.string().optional(),
  status: z.enum(["FORMING", "ACTIVE", "ARCHIVED"], "errors.invalid"),
  notes: z.string().trim().max(2000, "errors.tooLong").optional(),
  members: z.array(z.string().min(1)).max(60, "errors.memberInvalid"),
  captainId: z.string().optional(),
});

/**
 * Create / edit a team with its roster (ADMIN). All membership changes run in ONE transaction through the Academy
 * rules (`@/lib/academy/rules`): added → teamId + IN_TEAM; removed → teamId null + SEEKING_TEAM; ARCHIVED team →
 * releases everyone and clears the captain. Eligible members: same university, not ARCHIVED, without a team (or
 * already in this team). Captain must be a member.
 */
export async function saveTeam(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(["ADMIN"]);
  const parsed = teamSchema.safeParse({
    teamId: formStr(fd, "teamId") || undefined,
    name: formStr(fd, "name") ?? "",
    universityId: formStr(fd, "universityId") ?? "",
    facultyId: formStr(fd, "facultyId") || undefined,
    mentorId: formStr(fd, "mentorId") || undefined,
    competitionId: formStr(fd, "competitionId") || undefined,
    status: formStr(fd, "status") ?? "",
    notes: formStr(fd, "notes"),
    members: formStrs(fd, "members"),
    captainId: formStr(fd, "captainId") || undefined,
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const v = parsed.data;

  const existing = v.teamId
    ? await prisma.team.findUnique({
        where: { id: v.teamId },
        select: { id: true, name: true, status: true, universityId: true, facultyId: true, mentorId: true, competitionId: true },
      })
    : null;
  if (v.teamId && !existing) return fail("errors.notFound");

  const university = await prisma.university.findUnique({ where: { id: v.universityId }, select: { id: true } });
  if (!university) return fail("errors.universityRequired", { universityId: "errors.universityRequired" });

  const archiving = v.status === "ARCHIVED";
  const memberIds = archiving ? [] : [...new Set(v.members)];
  const captainId = archiving ? null : (v.captainId ?? null);
  if (captainId && !memberIds.includes(captainId)) return fail("errors.captainNotMember", { captainId: "errors.captainNotMember" });

  const data = {
    name: v.name,
    universityId: v.universityId,
    facultyId: v.facultyId ?? null,
    mentorId: v.mentorId ?? null,
    competitionId: v.competitionId ?? null,
    status: v.status,
    notes: v.notes || null,
  };

  let result: { teamId: string; added: string[]; removed: string[]; names: Map<string, string> };
  try {
    result = await prisma.$transaction(async (tx) => {
      // the current faculty / mentor / competition may stay as they are (even if archived / inactive / untracked since)
      await assertFacultyUsable(tx, v.facultyId, v.universityId, existing?.universityId === v.universityId ? existing.facultyId : null);
      await assertMentorUsable(tx, v.mentorId, existing?.mentorId);
      await assertCompetitionEligible(tx, v.competitionId, existing?.competitionId);

      const team = existing
        ? await tx.team.update({ where: { id: existing.id }, data, select: { id: true } })
        : await tx.team.create({ data, select: { id: true } });
      const before = existing ? (await tx.student.findMany({ where: { teamId: team.id }, select: { id: true } })).map((s) => s.id) : [];
      let added: string[] = [];
      let removed: string[] = [];
      if (archiving) {
        await releaseTeam(tx, team.id);
        removed = before;
      } else {
        ({ added, removed } = await setTeamRoster(tx, team.id, v.universityId, memberIds));
        await setCaptain(tx, team.id, captainId);
      }
      const ids = [...new Set([...added, ...removed, ...(captainId ? [captainId] : [])])];
      const rows = ids.length ? await tx.student.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
      return { teamId: team.id, added, removed, names: new Map(rows.map((r) => [r.id, r.name])) };
    });
  } catch (e) {
    if (e instanceof RuleError) return ruleFail(e);
    throw e;
  }
  const { teamId, added, removed, names } = result;

  await logAudit({
    actorId: user.id,
    action: existing ? "team.update" : "team.create",
    entity: "Team",
    entityId: teamId,
    summary: v.name,
    meta: {
      status: v.status,
      members: memberIds.length,
      captain: captainId ? (names.get(captainId) ?? null) : null,
      ...(existing ? { from: { name: existing.name, status: existing.status, mentorId: existing.mentorId, competitionId: existing.competitionId } } : {}),
    },
  });
  if (added.length || removed.length) {
    await logAudit({
      actorId: user.id,
      action: "team.members",
      entity: "Team",
      entityId: teamId,
      summary: `${v.name}: +${added.length} / −${removed.length}`,
      meta: { added: added.map((id) => names.get(id) ?? id), removed: removed.map((id) => names.get(id) ?? id), archived: archiving },
    });
  }
  const mentorChanged = !!v.mentorId && v.mentorId !== existing?.mentorId;
  if (mentorChanged) await notify([v.mentorId!], "team_mentor", { team: v.name }, "/academy/teams");
  refresh();
  if (mentorChanged) revalidateLayout(); // notification bell
  if (!existing) return done("toast.teamCreated");
  return done(archiving && existing.status !== "ARCHIVED" ? "toast.teamArchived" : "toast.teamUpdated");
}

/** Delete a team (ADMIN): releases all members in the same transaction; applications keep their history (teamId → null). */
export async function deleteTeam(teamId: string): Promise<ActionState> {
  const user = await requireUser(["ADMIN"]);
  const id = z.string().min(1).safeParse(teamId);
  if (!id.success) return fail("errors.invalid");
  const team = await prisma.team.findUnique({
    where: { id: id.data },
    select: { id: true, name: true, status: true, members: { select: { name: true } }, _count: { select: { applications: true } } },
  });
  if (!team) return fail("errors.notFound");
  const released = await prisma.$transaction(async (tx) => {
    const n = await releaseTeam(tx, team.id);
    await tx.team.delete({ where: { id: team.id } });
    return n;
  });
  await logAudit({
    actorId: user.id,
    action: "team.delete",
    entity: "Team",
    entityId: team.id,
    summary: team.name,
    meta: { status: team.status, released, removed: team.members.map((m) => m.name), applications: team._count.applications },
  });
  refresh();
  revalidateSets("applications");
  return done("toast.teamDeleted");
}

const applicationSchema = z.object({
  teamId: z.string().min(1, "errors.notFound"),
  projectTitle: z.string().trim().min(3, "errors.projectTitleShort").max(160, "errors.projectTitleLong"),
  problem: z.string().trim().min(20, "errors.problemShort").max(2000, "errors.tooLong"),
  solution: z.string().trim().min(20, "errors.solutionShort").max(2000, "errors.tooLong"),
  category: z.enum(CATEGORIES, "errors.category"),
});

/**
 * Create an Application from an ACTIVE Academy team (ADMIN). It only records the application (status SUBMITTED);
 * selection stays a human decision through the existing rubric and coordinator decision.
 */
export async function createTeamApplication(_prev: ApplicationActionState, fd: FormData): Promise<ApplicationActionState> {
  const user = await requireUser(["ADMIN"]);
  const parsed = applicationSchema.safeParse({
    teamId: formStr(fd, "teamId") ?? "",
    projectTitle: formStr(fd, "projectTitle") ?? "",
    problem: formStr(fd, "problem") ?? "",
    solution: formStr(fd, "solution") ?? "",
    category: formStr(fd, "category") ?? "",
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const v = parsed.data;

  try {
    // the code is generated inside the transaction; a concurrent creation with the same code retries
    const app = await withUniqueRetry(() =>
      prisma.$transaction(async (tx) => {
        const team = await tx.team.findUnique({
          where: { id: v.teamId },
          select: {
            id: true, name: true, status: true, universityId: true, competitionId: true,
            captain: { select: { id: true, name: true, email: true, teamId: true } },
            _count: { select: { members: true } },
          },
        });
        if (!team) throw new RuleError("errors.notFound");
        if (team.status !== "ACTIVE") throw new RuleError("errors.appNotActive");
        if (!team.competitionId) throw new RuleError("errors.appNoCompetition");
        if (!team.captain || team.captain.teamId !== team.id) throw new RuleError("errors.appNoCaptain");
        if (team._count.members < 1) throw new RuleError("errors.appNoMembers");
        const open = await tx.application.count({ where: { teamId: team.id, status: { in: [...OPEN_APPLICATION_STATUSES] } } });
        if (open > 0) throw new RuleError("errors.appOpenExists");

        return tx.application.create({
          data: {
            code: await nextApplicationCode(tx),
            teamName: team.name,
            projectTitle: v.projectTitle,
            problem: v.problem,
            solution: v.solution,
            category: v.category,
            memberCount: team._count.members,
            contactName: team.captain.name,
            contactEmail: team.captain.email,
            universityId: team.universityId,
            competitionId: team.competitionId,
            teamId: team.id,
          },
          select: { id: true, code: true, teamName: true },
        });
      }),
    );

    await logAudit({
      actorId: user.id,
      action: "application.create",
      entity: "Application",
      entityId: app.id,
      summary: `${app.code} · ${app.teamName}`,
      meta: { teamId: v.teamId, projectTitle: v.projectTitle, category: v.category },
    });
    await syncApplicationWorkflow(app.id, user.id); // process map: new application → its first stage (+ history)
    revalidateSets("applications", "teams", "academy", "dashboard");
    return done("toast.applicationCreated", { applicationId: app.id, code: app.code });
  } catch (e) {
    if (e instanceof RuleError) return fail(e.key);
    if (isUniqueViolation(e)) return fail("errors.retry");
    throw e;
  }
}

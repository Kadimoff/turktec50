import "server-only";
import { addDays } from "date-fns";
import { prisma } from "@/lib/db";

export const DEADLINE_WINDOW_DAYS = 60;
const OPEN_REQUESTS_SHOWN = 6;

/** Numbers and lists for the Academy overview (ADMIN). Everything is counted from records. */
export async function getAcademyOverview(now = new Date()) {
  const horizon = addDays(now, DEADLINE_WINDOW_DAYS);
  const openWhere = { status: { in: ["NEW", "UNDER_REVIEW"] as ("NEW" | "UNDER_REVIEW")[] } };

  const [
    students, studentsSeeking, teamsByStatus, appsFromTeams, tracked, trackedChanged, trainingsUpcoming, nextTraining, requestsByStatus,
    deadlines, openRequests, intakeByStatus,
  ] = await Promise.all([
    prisma.student.count({ where: { status: { not: "ARCHIVED" } } }),
    prisma.student.count({ where: { status: "SEEKING_TEAM" } }),
    prisma.team.groupBy({ by: ["status"], where: { status: { in: ["ACTIVE", "FORMING"] } }, _count: { _all: true } }),
    prisma.application.groupBy({ by: ["status"], where: { teamId: { not: null } }, _count: { _all: true } }),
    prisma.competition.count({ where: { ruleStatus: { not: null } } }),
    prisma.competition.count({ where: { ruleStatus: "CHANGED" } }),
    prisma.training.count({ where: { startsAt: { gte: now }, status: { not: "COMPLETED" } } }),
    prisma.training.findFirst({ where: { startsAt: { gte: now }, status: { not: "COMPLETED" } }, orderBy: { startsAt: "asc" }, select: { title: true, startsAt: true } }),
    prisma.resourceRequest.groupBy({ by: ["status"], where: openWhere, _count: { _all: true } }),
    prisma.competition.findMany({
      where: { catalogId: { not: null }, ruleStatus: { not: null }, applicationDeadline: { gte: now, lte: horizon } },
      orderBy: { applicationDeadline: "asc" },
      select: { id: true, name: true, organizer: true, theme: true, applicationDeadline: true, ruleStatus: true, _count: { select: { teams: true } } },
    }),
    prisma.resourceRequest.findMany({
      where: openWhere,
      orderBy: [{ neededBy: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      take: OPEN_REQUESTS_SHOWN,
      select: { id: true, title: true, status: true, neededBy: true, project: { select: { id: true, code: true, title: true } } },
    }),
    prisma.intakeRequest.groupBy({ by: ["status"], where: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "NEEDS_CHANGES"] } }, _count: { _all: true } }),
  ]);

  const teamCount = (s: string) => teamsByStatus.find((g) => g.status === s)?._count._all ?? 0;
  const appCount = (s: string[]) => appsFromTeams.filter((g) => s.includes(g.status)).reduce((a, g) => a + g._count._all, 0);
  const reqCount = (s: string) => requestsByStatus.find((g) => g.status === s)?._count._all ?? 0;
  const intakeCount = (s: string) => intakeByStatus.find((g) => g.status === s)?._count._all ?? 0;

  return {
    students: { total: students, seeking: studentsSeeking },
    teams: { active: teamCount("ACTIVE"), forming: teamCount("FORMING"), total: teamCount("ACTIVE") + teamCount("FORMING") },
    applications: { total: appCount(["SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "WAITLIST", "REJECTED"]), pending: appCount(["SUBMITTED", "UNDER_REVIEW", "WAITLIST"]), accepted: appCount(["ACCEPTED"]) },
    competitions: { tracked, changed: trackedChanged },
    trainings: { upcoming: trainingsUpcoming, next: nextTraining },
    intake: { submitted: intakeCount("SUBMITTED"), review: intakeCount("UNDER_REVIEW"), changes: intakeCount("NEEDS_CHANGES") },
    requests: { new: reqCount("NEW"), review: reqCount("UNDER_REVIEW"), open: reqCount("NEW") + reqCount("UNDER_REVIEW") },
    deadlines: deadlines.flatMap((c) => (c.applicationDeadline ? [{ ...c, applicationDeadline: c.applicationDeadline }] : [])),
    openRequests,
  };
}

import "server-only";
import { prisma } from "@/lib/db";
import { getProgramKpis } from "@/lib/kpi";
import { CATEGORIES, PROGRAM, STAGE_ORDER, currentWeek } from "@/lib/constants";
import { programWeekOf } from "@/components/calendar/program";

export type FunnelStep = { key: string; value: number; target: number | null };

/** All numbers for the KPI page / CSV snapshot, computed from records (never estimated). */
export async function getKpiReport() {
  const [kpis, byStage, byCategory, byUni, universities, completed, sessions, projectsWithSessions, tasksTotal, tasksDone] = await Promise.all([
    getProgramKpis(),
    prisma.project.groupBy({ by: ["stage"], _count: { _all: true } }),
    prisma.project.groupBy({ by: ["category"], _count: { _all: true } }),
    prisma.project.groupBy({ by: ["universityId"], _count: { _all: true } }),
    prisma.university.findMany({ select: { id: true, name: true, shortName: true, country: true } }),
    prisma.task.findMany({ where: { completedAt: { not: null } }, select: { completedAt: true } }),
    prisma.mentorSession.findMany({ where: { status: "COMPLETED" }, select: { scheduledAt: true, durationMin: true } }),
    prisma.mentorSession.groupBy({ by: ["projectId"], where: { status: "COMPLETED" } }),
    prisma.task.count(),
    prisma.task.count({ where: { status: "DONE" } }),
  ]);
  const T = kpis.targets;

  const funnel: FunnelStep[] = [
    { key: "applicationsTotal", value: kpis.applicationsTotal, target: null },
    { key: "applicationsEvaluated", value: kpis.applicationsEvaluated, target: T.applicationsEvaluated },
    { key: "teamsAccepted", value: kpis.teamsAccepted, target: T.teamsAccepted },
    { key: "prototypes", value: kpis.prototypes, target: T.prototypes },
    { key: "qcPackages", value: kpis.qcPackages, target: T.qcPackages },
    { key: "submitted", value: kpis.submitted, target: null },
    { key: "finalists", value: kpis.finalists, target: T.finalists },
  ];

  const stages = STAGE_ORDER.map((s) => ({ key: s, value: byStage.find((g) => g.stage === s)?._count._all ?? 0 }));
  const categories = CATEGORIES.map((c) => ({ key: c as string, value: byCategory.find((g) => g.category === c)?._count._all ?? 0 }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);

  const uniRows = byUni
    .map((g) => {
      const u = universities.find((x) => x.id === g.universityId);
      return { key: g.universityId, name: u?.name ?? "—", shortName: u?.shortName ?? "—", country: u?.country ?? "—", value: g._count._all };
    })
    .sort((a, b) => b.value - a.value);
  const countryMap = new Map<string, number>();
  for (const u of uniRows) countryMap.set(u.country, (countryMap.get(u.country) ?? 0) + u.value);
  const countries = [...countryMap.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value);
  const partnerUniversities = universities.length;
  const partnerCountries = new Set(universities.map((u) => u.country)).size;

  // Weekly series by program week (week 0 = before incubation start)
  const cw = currentWeek();
  const maxWeek = Math.max(cw, 1);
  const weekKeys = (dates: number[]) => {
    const lo = Math.min(1, ...dates);
    const hi = Math.max(maxWeek, ...dates.filter((w) => w <= PROGRAM.incubationWeeks));
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  };
  const doneWeeks = completed.map((c) => programWeekOf(c.completedAt!));
  const completion = weekKeys(doneWeeks).map((w) => ({ week: w, value: doneWeeks.filter((x) => x === w).length, current: w === cw }));

  const sessWeeks = sessions.map((s) => ({ w: programWeekOf(s.scheduledAt), min: s.durationMin }));
  const mentoring = weekKeys(sessWeeks.map((s) => s.w)).map((w) => ({
    week: w,
    value: Math.round((sessWeeks.filter((s) => s.w === w).reduce((a, s) => a + s.min, 0) / 60) * 10) / 10,
    current: w === cw,
  }));
  const mentoringMinutes = sessions.reduce((a, s) => a + s.durationMin, 0);

  return {
    kpis,
    funnel,
    stages,
    categories,
    universities: uniRows,
    countries,
    partnerUniversities,
    partnerCountries,
    completion,
    mentoring,
    mentoringHours: Math.round((mentoringMinutes / 60) * 10) / 10,
    sessionsCompleted: sessions.length,
    projectsMentored: projectsWithSessions.length,
    tasksTotal,
    tasksDone,
    currentWeek: cw,
  };
}

export type KpiReport = Awaited<ReturnType<typeof getKpiReport>>;

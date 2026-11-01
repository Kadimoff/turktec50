import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readinessFromChecklist } from "@/lib/kpi";
import { getKpiReport } from "@/components/kpi/data";

/** CSV exports for the coordinator (ADMIN only). UTF-8 with BOM so Excel renders ə/ğ/ş correctly. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });

  const type = new URL(request.url).searchParams.get("type") === "kpi" ? "kpi" : "projects";
  const locale = await getLocale();
  // Excel in az/tr regional settings expects ";" as list separator; en uses ",".
  const sep = locale === "en" ? "," : ";";
  const stamp = new Date().toISOString().slice(0, 10);

  const rows = type === "kpi" ? await kpiRows() : await projectRows();
  const csv = "﻿" + rows.map((r) => r.map((c) => cell(c, sep)).join(sep)).join("\r\n") + "\r\n";
  const name = type === "kpi" ? `turktech50-kpi-${stamp}.csv` : `turktech50-projects-${stamp}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

function cell(v: unknown, sep: string) {
  const s = v === null || v === undefined ? "" : String(v);
  return /["\r\n]/.test(s) || s.includes(sep) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function kpiRows(): Promise<(string | number)[][]> {
  const [t, tc, r] = await Promise.all([getTranslations("kpi"), getTranslations("common"), getKpiReport()]);
  const out: (string | number)[][] = [[t("csv.indicator"), t("csv.actual"), t("csv.target"), t("csv.pctTarget"), t("csv.conversion")]];
  r.funnel.forEach((s, i) => {
    const prev = i > 0 ? r.funnel[i - 1]!.value : null;
    out.push([
      t(`funnel.steps.${s.key}`),
      s.value,
      s.target ?? "",
      s.target ? Math.round((s.value / s.target) * 100) : "",
      prev ? Math.round((s.value / prev) * 100) : "",
    ]);
  });
  out.push([t("csv.finalistsScale"), r.kpis.finalists, r.kpis.targets.finalistsScale, Math.round((r.kpis.finalists / r.kpis.targets.finalistsScale) * 100), ""]);
  out.push([t("mentoring.hours"), r.mentoringHours, "", "", ""]);
  out.push([t("mentoring.sessions"), r.sessionsCompleted, "", "", ""]);
  out.push([t("mentoring.projects"), r.projectsMentored, r.kpis.teamsAccepted, "", ""]);
  out.push([t("csv.tasksDone"), r.tasksDone, r.tasksTotal, r.tasksTotal ? Math.round((r.tasksDone / r.tasksTotal) * 100) : "", ""]);
  for (const c of r.countries) out.push([`${t("charts.byCountry")}: ${tc.has(`countries.${c.key}` as never) ? tc(`countries.${c.key}` as never) : c.key}`, c.value, "", "", ""]);
  out.push([]);
  out.push([t("csv.generated"), new Date().toISOString()]);
  return out;
}

async function projectRows(): Promise<(string | number)[][]> {
  const [t, tc, te] = await Promise.all([getTranslations("kpi"), getTranslations("common"), getTranslations("enums")]);
  const now = new Date();
  const [projects, open, overdue] = await Promise.all([
    prisma.project.findMany({
      select: {
        id: true, code: true, title: true, category: true, stage: true, health: true, prototypeVerified: true, packageQcPassed: true,
        submittedAt: true, result: true,
        university: { select: { shortName: true, country: true } },
        competition: { select: { name: true } },
        mentors: { select: { mentor: { select: { name: true } } } },
        checklist: { select: { required: true, status: true } },
        _count: { select: { members: true } },
      },
      orderBy: { code: "asc" },
    }),
    prisma.task.groupBy({ by: ["projectId"], where: { status: { not: "DONE" } }, _count: { _all: true } }),
    prisma.task.groupBy({ by: ["projectId"], where: { status: { not: "DONE" }, dueDate: { lt: now } }, _count: { _all: true } }),
  ]);
  const openMap = new Map(open.map((g) => [g.projectId, g._count._all]));
  const overdueMap = new Map(overdue.map((g) => [g.projectId, g._count._all]));
  const yes = t("csv.yes");
  const no = t("csv.no");
  const head = ["code", "title", "university", "country", "category", "stage", "health", "readiness", "openTasks", "overdueTasks", "prototype", "qc", "submittedAt", "result", "competition", "mentors", "members"].map((k) =>
    t(`csv.cols.${k}`),
  );
  return [
    head,
    ...projects.map((p) => [
      p.code,
      p.title,
      p.university.shortName,
      tc.has(`countries.${p.university.country}` as never) ? tc(`countries.${p.university.country}` as never) : p.university.country,
      tc.has(`categories.${p.category}` as never) ? tc(`categories.${p.category}` as never) : p.category,
      te(`ProjectStage.${p.stage}`),
      te(`ProjectHealth.${p.health}`),
      `${readinessFromChecklist(p.checklist)}%`,
      openMap.get(p.id) ?? 0,
      overdueMap.get(p.id) ?? 0,
      p.prototypeVerified ? yes : no,
      p.packageQcPassed ? yes : no,
      p.submittedAt ? p.submittedAt.toISOString().slice(0, 10) : "",
      te(`CompetitionResult.${p.result}`),
      p.competition?.name ?? "",
      p.mentors.map((m) => m.mentor.name).join(", "),
      p._count.members,
    ]),
  ];
}

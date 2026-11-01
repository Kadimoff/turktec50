import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, ClipboardCheck, FilePenLine, FolderKanban, Scale, UserRoundCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { StatCard } from "@/components/shared/stat-card";
import { ToneBadge } from "@/components/shared/tone-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { ProgressBar } from "@/components/shared/progress-bar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { aggregate, evaluationSelect, type EvalKind, type Rubric } from "./data";
import { fmtScore } from "./scoring";

/** ADMIN: per-project panel progress + juror workload. Ordered by project code — never by score. */
export async function JuryOverview({ rubric, kind }: { rubric: Rubric; kind: EvalKind }) {
  const t = await getTranslations("jury");
  const [projects, jurors] = await Promise.all([
    prisma.project.findMany({
      where: { OR: [{ jurors: { some: {} } }, { evaluations: { some: { rubricId: rubric.id } } }] },
      orderBy: { code: "asc" },
      select: {
        id: true, code: true, title: true,
        jurors: { select: { jury: { select: { id: true, name: true, title: true } } } },
        evaluations: { where: { rubricId: rubric.id }, select: evaluationSelect },
      },
    }),
    prisma.user.findMany({
      where: { role: "JURY" },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, title: true, active: true,
        _count: { select: { juryAssignments: true } },
        evaluations: { where: { rubricId: rubric.id, projectId: { not: null } }, select: { status: true } },
      },
    }),
  ]);

  const rows = projects.map((p) => ({ ...p, agg: aggregate(rubric, p.jurors.map((j) => j.jury), p.evaluations) }));
  const expected = rows.reduce((a, r) => a + r.agg.assignedCount, 0);
  const submitted = rows.reduce((a, r) => a + r.agg.submittedCount, 0);
  const drafts = rows.reduce((a, r) => a + r.agg.draftCount, 0);
  const flagged = rows.filter((r) => r.agg.disagreement).length;
  const href = (id: string) => `/projects/${id}/evaluations${kind === "FINAL" ? "?kind=final" : ""}`;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("overview.panels")} value={rows.length} icon={FolderKanban} tone="brand" hint={t("overview.panelsHint")} />
        <StatCard
          label={t("overview.submitted")}
          value={t("panel.ofAssigned", { done: submitted, total: expected })}
          icon={ClipboardCheck}
          tone="success"
          target={Math.max(expected, 1)}
          current={submitted}
        />
        <StatCard label={t("overview.drafts")} value={drafts} icon={FilePenLine} tone={drafts ? "warning" : "neutral"} hint={t("home.draftsHint")} />
        <StatCard label={t("overview.flagged")} value={flagged} icon={Scale} tone={flagged ? "warning" : "neutral"} hint={t("overview.flaggedHint")} />
      </div>

      <section className="rounded-xl border bg-card shadow-card" aria-labelledby="ov-projects">
        <div className="border-b px-4 py-3 sm:px-5">
          <h2 id="ov-projects" className="text-sm font-semibold">{t("overview.projectsTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("overview.projectsHint")}</p>
        </div>
        {rows.length === 0 ? (
          <div className="p-4"><EmptyState icon={FolderKanban} title={t("overview.noPanels")} /></div>
        ) : (
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 text-xs font-semibold text-muted-foreground sm:pl-5">{t("overview.project")}</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground">{t("overview.jurors")}</TableHead>
                <TableHead className="w-44 text-xs font-semibold text-muted-foreground">{t("overview.progress")}</TableHead>
                <TableHead className="text-right text-xs font-semibold text-muted-foreground">{t("panel.weightedAvg")}</TableHead>
                <TableHead className="pr-4 text-right text-xs font-semibold text-muted-foreground sm:pr-5">{t("panel.spread")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="h-12">
                  <TableCell className="pl-4 sm:pl-5">
                    <Link href={href(r.id)} className="group block focus-visible:outline-none">
                      <span className="font-mono text-xs font-semibold text-primary">{r.code}</span>
                      <span className="ml-2 font-medium group-hover:underline group-focus-visible:underline">{r.title}</span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    {r.agg.jurors.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <span className="flex -space-x-1.5">
                        {r.agg.jurors.map((j) => (
                          <UserAvatar key={j.id} name={j.name} size="sm" className="ring-2 ring-card" />
                        ))}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ProgressBar
                        value={r.agg.assignedCount ? (r.agg.submittedCount / r.agg.assignedCount) * 100 : 0}
                        tone={r.agg.assignedCount > 0 && r.agg.submittedCount === r.agg.assignedCount ? "success" : "info"}
                        label={`${r.title}: ${t("overview.progress")}`}
                        showValue={false}
                      />
                      <span className="tabular w-10 shrink-0 text-right text-xs font-semibold">
                        {r.agg.submittedCount}/{r.agg.assignedCount}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="tabular text-right font-semibold">{fmtScore(r.agg.weightedAvg)}</TableCell>
                  <TableCell className="pr-4 text-right sm:pr-5">
                    {r.agg.disagreement ? (
                      <ToneBadge tone="warning" className="tabular">
                        <AlertTriangle className="size-3" aria-hidden />
                        {fmtScore(r.agg.weightedSpread)} · {t("overview.discuss")}
                      </ToneBadge>
                    ) : (
                      <span className="tabular text-muted-foreground">{fmtScore(r.agg.weightedSpread)}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="rounded-xl border bg-card shadow-card" aria-labelledby="ov-workload">
        <div className="border-b px-4 py-3 sm:px-5">
          <h2 id="ov-workload" className="text-sm font-semibold">{t("overview.workloadTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("overview.workloadHint")}</p>
        </div>
        {jurors.length === 0 ? (
          <div className="p-4"><EmptyState icon={UserRoundCheck} title={t("panel.noJurors")} /></div>
        ) : (
          <ul className="divide-y">
            {jurors.map((j) => {
              const sub = j.evaluations.filter((e) => e.status === "SUBMITTED").length;
              const dr = j.evaluations.filter((e) => e.status === "DRAFT").length;
              const assigned = j._count.juryAssignments;
              return (
                <li key={j.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <UserAvatar name={j.name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {j.name}
                        {!j.active && <ToneBadge tone="neutral" className="ml-2" dot={false}>{t("overview.inactive")}</ToneBadge>}
                      </p>
                      {j.title && <p className="truncate text-xs text-muted-foreground">{j.title}</p>}
                    </div>
                  </div>
                  <dl className="tabular grid grid-cols-3 gap-4 text-center text-xs sm:w-72">
                    <div><dt className="text-muted-foreground">{t("overview.assigned")}</dt><dd className="text-sm font-semibold">{assigned}</dd></div>
                    <div><dt className="text-muted-foreground">{t("status.SUBMITTED")}</dt><dd className="text-sm font-semibold text-success">{sub}</dd></div>
                    <div><dt className="text-muted-foreground">{t("status.DRAFT")}</dt><dd className={dr ? "text-sm font-semibold text-warning" : "text-sm font-semibold"}>{dr}</dd></div>
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

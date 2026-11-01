import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ClipboardList, FileInput, Gavel, Hourglass } from "lucide-react";
import type { CurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/rbac";
import { readinessFromChecklist } from "@/lib/kpi";
import { PROGRAM } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { EnumBadge } from "@/components/shared/enum-badge";
import { ToneBadge } from "@/components/shared/tone-badge";
import { ProgressBar } from "@/components/shared/progress-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { HumanControlNote } from "@/components/shared/notice";
import { Panel, PanelLink, ProjectCode } from "./parts";
import { daysUntil } from "@/components/calendar/program";

export async function JuryDashboard({ user }: { user: CurrentUser }) {
  const [t, tc, te, locale] = await Promise.all([getTranslations("dashboard"), getTranslations("common"), getTranslations("enums"), getLocale()]);

  const [projects, pendingSelection, selectionSubmitted] = await Promise.all([
    prisma.project.findMany({
      where: projectScope(user),
      select: {
        id: true, code: true, title: true, stage: true, category: true,
        university: { select: { shortName: true } },
        checklist: { select: { required: true, status: true } },
        evaluations: { where: { evaluatorId: user.id, rubric: { kind: "MIDTERM" } }, select: { status: true, updatedAt: true } },
      },
      orderBy: { code: "asc" },
    }),
    prisma.application.count({
      where: { status: "UNDER_REVIEW", evaluations: { none: { evaluatorId: user.id, status: "SUBMITTED", rubric: { kind: "SELECTION" } } } },
    }),
    prisma.evaluation.count({ where: { evaluatorId: user.id, status: "SUBMITTED", rubric: { kind: "SELECTION" } } }),
  ]);

  const rows = projects.map((p) => ({ ...p, evalStatus: p.evaluations[0]?.status ?? null, readiness: readinessFromChecklist(p.checklist) }));
  const submitted = rows.filter((r) => r.evalStatus === "SUBMITTED").length;
  const drafts = rows.filter((r) => r.evalStatus === "DRAFT").length;
  const left = daysUntil(PROGRAM.midtermJury);

  return (
    <div className="space-y-6">
      <HumanControlNote />
      <div className="grid gap-4 md:grid-cols-3">
        <section aria-labelledby="midterm-title" className="relative overflow-hidden rounded-xl border bg-sidebar p-5 text-sidebar-foreground shadow-card">
          <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-sidebar-primary/20 blur-2xl" />
          <h2 id="midterm-title" className="relative flex items-center gap-2 text-sm font-semibold text-sidebar-accent-foreground">
            <Gavel className="size-4 text-sidebar-primary" aria-hidden />
            {t("jury.midterm")}
          </h2>
          <p className="relative mt-3 text-4xl font-bold text-sidebar-accent-foreground">
            {left >= 0 ? left : 0}
            <span className="ml-2 text-base font-medium text-sidebar-foreground/80">{t("jury.days", { count: Math.max(0, left) })}</span>
          </p>
          <p className="relative mt-1 text-xs text-sidebar-foreground/80">{fmtDateTime(PROGRAM.midtermJury, locale)}</p>
        </section>
        <div className="rounded-xl border bg-card p-4 shadow-card">
          <p className="flex items-center justify-between text-[13px] font-medium text-muted-foreground">
            {t("jury.progress")}
            <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground" aria-hidden>
              <ClipboardList className="size-4" />
            </span>
          </p>
          <p className="mt-1 text-[1.75rem] leading-tight font-bold">
            {submitted}
            <span className="ml-1 text-base font-semibold text-muted-foreground">/ {rows.length}</span>
          </p>
          <ProgressBar className="mt-2" value={rows.length ? (submitted / rows.length) * 100 : 0} label={t("jury.progress")} showValue={false} />
          <p className="mt-2 text-xs text-muted-foreground">{t("jury.progressHint", { drafts })}</p>
        </div>
        <Link
          href="/applications?status=UNDER_REVIEW"
          className="group rounded-xl border bg-card p-4 shadow-card transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <p className="flex items-center justify-between text-[13px] font-medium text-muted-foreground">
            {t("jury.selection")}
            <span className={cn("grid size-8 place-items-center rounded-lg", pendingSelection > 0 ? "bg-warning-soft text-warning" : "bg-success-soft text-success")} aria-hidden>
              <FileInput className="size-4" />
            </span>
          </p>
          <p className="mt-1 text-[1.75rem] leading-tight font-bold">{pendingSelection}</p>
          <p className="mt-2 text-xs text-muted-foreground">{t("jury.selectionHint", { done: selectionSubmitted })}</p>
          <p className="mt-2 text-xs font-semibold text-primary group-hover:underline">{t("jury.selectionCta")} →</p>
        </Link>
      </div>

      <Panel id="jury-projects" title={t("jury.assigned")} subtitle={t("jury.assignedSub", { count: rows.length })} action={<PanelLink href="/jury">{t("jury.panel")}</PanelLink>}>
        {rows.length === 0 ? (
          <EmptyState icon={Hourglass} title={t("jury.noProjects")} />
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <Link href={`/projects/${r.id}`} className="block truncate text-sm font-medium hover:underline focus-visible:underline focus-visible:outline-none">
                    {r.title}
                  </Link>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <ProjectCode>{r.code}</ProjectCode>
                    <span>{r.university.shortName}</span>
                    <span aria-hidden>·</span>
                    <span>{tc(`categories.${r.category}` as never)}</span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 lg:grid lg:grid-cols-[10rem_8.5rem_7.5rem_7rem] lg:gap-4">
                  <span><EnumBadge enumName="ProjectStage" value={r.stage} /></span>
                  <ProgressBar className="w-32" value={r.readiness} label={`${t("mentor.colReadiness")} · ${r.code}`} />
                  {r.evalStatus ? (
                    <span><ToneBadge tone={r.evalStatus === "SUBMITTED" ? "success" : "warning"}>{te(`EvaluationStatus.${r.evalStatus}`)}</ToneBadge></span>
                  ) : (
                    <span><ToneBadge tone="neutral">{t("jury.notStarted")}</ToneBadge></span>
                  )}
                  <Link
                    href={`/projects/${r.id}/evaluations`}
                    className={cn(buttonVariants({ variant: r.evalStatus === "SUBMITTED" ? "outline" : "default", size: "lg" }), "h-10 min-w-28 lg:w-full")}
                  >
                    {r.evalStatus === "SUBMITTED" ? t("jury.view") : r.evalStatus === "DRAFT" ? t("jury.continue") : t("jury.evaluate")}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{t("jury.rubricNote", { rubric: te("RubricKind.MIDTERM") })}</p>
      </Panel>
    </div>
  );
}

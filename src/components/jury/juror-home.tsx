import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, Building2, CalendarClock, ClipboardCheck, FilePenLine, FolderKanban, Inbox } from "lucide-react";
import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { PROGRAM } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { StatCard } from "@/components/shared/stat-card";
import { EnumBadge } from "@/components/shared/enum-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { JurorStatusBadge } from "./aggregate-panel";
import type { EvalKind, JurorStatus } from "./data";
import { daysUntil } from "./dates";

/** JURY home: assigned projects with per-rubric status, countdown, pending selection reviews. */
export async function JurorHome({ user }: { user: CurrentUser }) {
  const [t, tc, te, locale] = await Promise.all([getTranslations("jury"), getTranslations("common"), getTranslations("enums"), getLocale()]);
  const [assignments, myEvals, pendingSelection] = await Promise.all([
    prisma.juryAssignment.findMany({
      where: { juryId: user.id },
      orderBy: { project: { code: "asc" } },
      select: {
        project: {
          select: { id: true, code: true, title: true, tagline: true, stage: true, category: true, university: { select: { shortName: true } } },
        },
      },
    }),
    prisma.evaluation.findMany({
      where: { evaluatorId: user.id, projectId: { not: null }, rubric: { kind: { in: ["MIDTERM", "FINAL"] } } },
      select: { projectId: true, status: true, rubric: { select: { kind: true } } },
    }),
    prisma.application.count({ where: { status: "UNDER_REVIEW", evaluations: { none: { evaluatorId: user.id } } } }),
  ]);

  const statusOf = (projectId: string, kind: EvalKind): JurorStatus =>
    myEvals.find((e) => e.projectId === projectId && e.rubric.kind === kind)?.status ?? "NOT_STARTED";
  const projects = assignments.map((a) => a.project);
  const midSubmitted = projects.filter((p) => statusOf(p.id, "MIDTERM") === "SUBMITTED").length;
  const drafts = myEvals.filter((e) => e.status === "DRAFT" && projects.some((p) => p.id === e.projectId)).length;
  const days = daysUntil(PROGRAM.midtermJury);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("home.countdown")}
          value={days < 0 ? t("page.datePassed") : days === 0 ? tc("today") : tc("daysLeft", { count: days })}
          icon={CalendarClock}
          tone={days >= 0 && days <= 7 ? "warning" : "info"}
          hint={`${te("RubricKind.MIDTERM")} · ${fmtDate(PROGRAM.midtermJury, locale)}`}
        />
        <StatCard label={t("home.assigned")} value={projects.length} icon={FolderKanban} tone="brand" hint={t("home.assignedHint")} />
        <StatCard
          label={t("home.midtermSubmitted")}
          value={t("panel.ofAssigned", { done: midSubmitted, total: projects.length })}
          icon={ClipboardCheck}
          tone="success"
          target={Math.max(projects.length, 1)}
          current={midSubmitted}
        />
        <StatCard label={t("home.drafts")} value={drafts} icon={FilePenLine} tone={drafts > 0 ? "warning" : "neutral"} hint={t("home.draftsHint")} />
      </div>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-5" aria-labelledby="sel-title">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-info-soft text-info" aria-hidden>
            <Inbox className="size-5" />
          </span>
          <div>
            <h2 id="sel-title" className="text-sm font-semibold">{t("home.selectionTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {pendingSelection > 0 ? t("home.selectionBody", { count: pendingSelection }) : t("home.selectionNone")}
            </p>
          </div>
        </div>
        <Button
          variant={pendingSelection > 0 ? "default" : "outline"}
          size="lg"
          className="h-10 shrink-0"
          nativeButton={false} render={<Link href="/applications?status=UNDER_REVIEW" />}
        >
          {t("home.selectionCta")}
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </section>

      <section aria-labelledby="my-projects-title" className="space-y-3">
        <div>
          <h2 id="my-projects-title" className="text-base font-semibold">{t("home.projectsTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("home.projectsHint")}</p>
        </div>
        {projects.length === 0 ? (
          <EmptyState icon={FolderKanban} title={t("home.noProjects")} description={t("home.noProjectsHint")} />
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => {
              const mid = statusOf(p.id, "MIDTERM");
              const fin = statusOf(p.id, "FINAL");
              const href = `/projects/${p.id}/evaluations`;
              const cta = mid === "SUBMITTED" ? t("home.view") : mid === "DRAFT" ? t("home.continue") : t("home.evaluate");
              return (
                <li key={p.id} className="flex min-w-0 flex-col rounded-xl border bg-card p-4 shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-mono text-xs font-semibold text-primary">{p.code}</p>
                    <EnumBadge enumName="ProjectStage" value={p.stage} />
                  </div>
                  <Link href={`/projects/${p.id}`} className="mt-1 text-base font-semibold hover:underline">
                    {p.title}
                  </Link>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{p.tagline}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Building2 className="size-3.5" aria-hidden />{p.university.shortName}</span>
                    <span>{tc(`categories.${p.category}` as never)}</span>
                  </p>
                  <dl className="mt-3 grid gap-1.5 border-t pt-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-muted-foreground">{te("RubricKind.MIDTERM")}</dt>
                      <dd><JurorStatusBadge status={mid} /></dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-muted-foreground">{te("RubricKind.FINAL")}</dt>
                      <dd><JurorStatusBadge status={fin} /></dd>
                    </div>
                  </dl>
                  <div className="mt-auto pt-4">
                    <Button
                      variant={mid === "SUBMITTED" ? "outline" : "default"}
                      size="lg"
                      className="h-10 w-full"
                      nativeButton={false} render={<Link href={href} />}
                      aria-label={`${cta}: ${p.title}`}
                    >
                      {cta}
                      <ArrowRight className="size-4" aria-hidden />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

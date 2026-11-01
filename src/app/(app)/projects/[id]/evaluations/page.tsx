import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarClock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getProjectAccess } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PROGRAM } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { HumanControlNote } from "@/components/shared/notice";
import { EmptyState } from "@/components/shared/empty-state";
import { KindSwitch } from "@/components/jury/kind-switch";
import { RubricForm } from "@/components/jury/rubric-form";
import { AggregatePanel } from "@/components/jury/aggregate-panel";
import { FeedbackView } from "@/components/jury/feedback-view";
import { ViewTabs } from "@/components/jury/view-tabs";
import { getProjectAggregate, getRubric, parseKind } from "@/components/jury/data";
import { daysUntil } from "@/components/jury/dates";

export async function generateMetadata() {
  const t = await getTranslations("nav.projectTabs");
  return { title: t("evaluations") };
}

export default async function EvaluationsPage(props: PageProps<"/projects/[id]/evaluations">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const user = await requireUser();
  const access = await getProjectAccess(user, id);
  if (!access.tabs.includes("evaluations")) notFound();

  const kind = parseKind(sp.kind);
  const [t, tc, te, locale, rubric] = await Promise.all([
    getTranslations("jury"),
    getTranslations("common"),
    getTranslations("enums"),
    getLocale(),
    getRubric(kind),
  ]);
  const basePath = `/projects/${id}/evaluations`;
  const date = kind === "FINAL" ? PROGRAM.mockFinal : PROGRAM.midtermJury;
  const days = daysUntil(date);

  const header = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight">
          {access.canEvaluate && !access.isAdmin ? t("page.juryTitle") : access.isAdmin ? t("page.adminTitle") : t("page.feedbackTitle")}
        </h2>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
          <CalendarClock className="size-4" aria-hidden />
          <span>{te(`RubricKind.${kind}`)}: {fmtDate(date, locale)}</span>
          <span aria-hidden>·</span>
          <span className={days < 0 ? "" : days <= 7 ? "font-medium text-warning" : ""}>
            {days < 0 ? t("page.datePassed") : days === 0 ? tc("today") : tc("daysLeft", { count: days })}
          </span>
        </p>
      </div>
      <KindSwitch basePath={basePath} kind={kind} />
    </div>
  );

  if (!rubric || rubric.criteria.length === 0) {
    return (
      <div className="space-y-5">
        {header}
        <EmptyState title={t("page.noRubric")} />
      </div>
    );
  }

  // TEAM / MENTOR: anonymised feedback
  if (!access.canEvaluate) {
    const agg = await getProjectAggregate(id, rubric);
    return (
      <div className="space-y-5">
        {header}
        <HumanControlNote />
        <FeedbackView agg={agg} kind={kind} />
      </div>
    );
  }

  // JURY / ADMIN: own rubric form
  const own = await prisma.evaluation.findUnique({
    where: { rubricId_evaluatorId_projectId: { rubricId: rubric.id, evaluatorId: user.id, projectId: id } },
    select: { status: true, submittedAt: true, updatedAt: true, comment: true, recommendation: true, scores: { select: { criterionId: true, score: true } } },
  });
  const form = (
    <RubricForm
      key={`${kind}-${own?.status ?? "new"}`}
      projectId={id}
      kind={kind}
      criteria={rubric.criteria}
      initial={{
        status: own?.status ?? null,
        submittedAt: own?.submittedAt?.toISOString() ?? null,
        updatedAt: own?.updatedAt?.toISOString() ?? null,
        scores: Object.fromEntries((own?.scores ?? []).map((s) => [s.criterionId, s.score])),
        comment: own?.comment ?? "",
        recommendation: own?.recommendation ?? "",
      }}
    />
  );

  if (!access.isAdmin) {
    return (
      <div className="space-y-5">
        {header}
        <HumanControlNote />
        <p className="text-sm text-muted-foreground">{t("page.juryIntro")}</p>
        {form}
      </div>
    );
  }

  const agg = await getProjectAggregate(id, rubric);
  return (
    <div className="space-y-5">
      {header}
      <HumanControlNote />
      <ViewTabs
        items={[
          { value: "panel", label: t("page.tabPanel"), content: <AggregatePanel agg={agg} /> },
          { value: "mine", label: t("page.tabMine"), content: form },
        ]}
      />
    </div>
  );
}

import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, Check, ChevronDown, Flag, Hourglass, MapIcon, X } from "lucide-react";
import { prisma } from "@/lib/db";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ToneBadge } from "@/components/shared/tone-badge";
import { isBranch, listStages, stageDescription, stageName, type StageRecord } from "@/lib/workflow";
import { deriveApplicationKey, deriveProjectKey } from "@/lib/workflow-core";
import { WorkflowMoveForm } from "./move-form";

type Props = { scope: "PROJECT" | "APPLICATION"; entityId: string; canManage: boolean; compact?: boolean };

/**
 * Process stepper for a project / application: passed · current · next stages with dates, "next step + responsible role",
 * the transition history, and (ADMIN/root) a manual "change stage" form.
 */
export async function WorkflowStepper({ scope, entityId, canManage, compact }: Props) {
  const locale = await getLocale();
  const t = await getTranslations("process");
  const [stagesAll, entity, transitions] = await Promise.all([
    listStages({ scope, includeInactive: true }),
    scope === "PROJECT"
      ? prisma.project.findUnique({
          where: { id: entityId },
          select: { workflowStageId: true, stage: true, result: true, evaluations: { where: { status: "SUBMITTED", rubric: { kind: "FINAL" } }, select: { id: true }, take: 1 } },
        })
      : prisma.application.findUnique({ where: { id: entityId }, select: { workflowStageId: true, status: true, projectId: true } }),
    prisma.workflowTransition.findMany({
      where: scope === "PROJECT" ? { projectId: entityId } : { applicationId: entityId },
      orderBy: { createdAt: "desc" },
      take: compact ? 6 : 50,
      select: {
        id: true, auto: true, note: true, createdAt: true, toStageId: true,
        fromStage: { select: { nameAz: true, nameTr: true, nameEn: true } },
        toStage: { select: { nameAz: true, nameTr: true, nameEn: true } },
        actor: { select: { name: true } },
      },
    }),
  ]);
  if (!entity) return null;

  // fall back to the derived system stage if the record has not been synced yet (e.g. before `workflow:sync`)
  let currentId = entity.workflowStageId;
  if (!currentId) {
    const key = "stage" in entity
      ? deriveProjectKey({ stage: entity.stage, result: entity.result, hasFinalEval: entity.evaluations.length > 0 })
      : deriveApplicationKey({ status: entity.status, projectId: entity.projectId });
    currentId = stagesAll.find((s) => s.systemKey === key)?.id ?? null;
  }
  const current = stagesAll.find((s) => s.id === currentId) ?? null;
  const main = stagesAll.filter((s) => !isBranch(s.kind) && (s.active || s.id === currentId));
  let curIdx = current ? main.findIndex((s) => s.id === current.id) : -1;
  const onBranch = !!current && isBranch(current.kind);
  if (onBranch) curIdx = main.filter((s) => s.order < current!.order).length - 1; // anchor = last main stage before the branch
  const reachedAt = new Map<string, Date>();
  for (const tr of [...transitions].reverse()) if (tr.toStageId) reachedAt.set(tr.toStageId, tr.createdAt);

  const next: StageRecord | null = !current || onBranch || current.kind === "DONE" ? null : (main[curIdx + 1] ?? null);
  const nm = (s: { nameAz: string; nameTr: string; nameEn: string } | null) => (s ? stageName(s, locale) : t("stepper.deletedStage"));
  const roleList = (s: StageRecord) => s.responsibleRoles.map((r) => t(`lanes.${r}`)).join(", ");

  const options = stagesAll
    .filter((s) => s.active)
    .map((s, i) => ({ value: s.id, label: `${i + 1}. ${stageName(s, locale)}${s.id === currentId ? ` (${t("stepper.current")})` : ""}${s.systemKey ? "" : ` · ${t("diagram.customStage")}`}`, disabled: s.id === currentId }));

  return (
    <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby={`wf-${scope}`} data-testid="workflow-stepper">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id={`wf-${scope}`} className="text-sm font-semibold">{t("stepper.title")}</h2>
          <p className="text-xs text-muted-foreground">{t(scope === "PROJECT" ? "stepper.hintProject" : "stepper.hintApplication")}</p>
        </div>
        <Link href={current ? `/process?stage=${current.id}` : "/process"} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-primary hover:bg-muted no-print">
          <MapIcon className="size-3.5" aria-hidden />{t("stepper.openProcess")}
        </Link>
      </div>

      <div className="mt-4 overflow-x-auto pb-1">
        <ol className={cn("grid gap-2 sm:grid-flow-col sm:auto-cols-[minmax(5.5rem,1fr)] sm:gap-0", compact && "sm:auto-cols-[minmax(6rem,1fr)]")} data-testid="stepper-steps">
          {main.map((s, i) => {
            const branchHere = onBranch && i === curIdx; // the decision point where this record left the main line
            const done = i < curIdx;
            const isCur = !onBranch && i === curIdx;
            const shown = branchHere && current ? current : s;
            const at = reachedAt.get(shown.id);
            const danger = branchHere && current?.kind === "REJECTED";
            return (
              <li key={s.id} aria-current={isCur || branchHere ? "step" : undefined} data-state={branchHere ? "branch" : isCur ? "current" : done ? "done" : "next"} className="relative flex items-center gap-3 sm:flex-col sm:items-center sm:gap-2 sm:px-1 sm:text-center">
                {i > 0 && <span aria-hidden className={cn("absolute top-4 right-1/2 hidden h-0.5 w-full -translate-y-1/2 sm:block", i <= curIdx ? (branchHere ? (danger ? "bg-danger" : "bg-warning") : "bg-primary") : "bg-border")} />}
                <span
                  className={cn(
                    "relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2 text-xs font-bold",
                    done && "border-primary bg-primary text-primary-foreground",
                    isCur && (s.kind === "DONE" ? "border-success bg-success-soft text-success ring-4 ring-success/15" : "border-primary bg-card text-primary ring-4 ring-primary/15"),
                    branchHere && (danger ? "border-danger bg-danger-soft text-danger ring-4 ring-danger/15" : "border-warning bg-warning-soft text-warning ring-4 ring-warning/15"),
                    !done && !isCur && !branchHere && "border-border bg-card text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-4" aria-hidden /> : branchHere ? (danger ? <X className="size-4" aria-hidden /> : <Hourglass className="size-3.5" aria-hidden />) : s.kind === "DONE" ? <Flag className="size-3.5" aria-hidden /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-sm font-medium sm:text-xs", isCur || branchHere ? "text-foreground" : "text-muted-foreground", branchHere && (danger ? "text-danger" : "text-warning"))}>{stageName(shown, locale)}</span>
                  <span className="block text-xs text-muted-foreground sm:text-[11px]">
                    {isCur || branchHere ? `${t("stepper.current")}${at ? ` · ${fmtDate(at, locale)}` : ""}` : done ? (at ? fmtDate(at, locale) : t("stepper.passed")) : t("stepper.upcoming")}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* next step + responsible role */}
      <div className="mt-4 rounded-lg border bg-muted/40 px-4 py-3" data-testid="stepper-next">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground">{t("stepper.nextTitle")}</p>
        {next ? (
          <>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm font-semibold">
              {current && <span className="text-muted-foreground">{stageName(current, locale)}</span>}
              <ArrowRight className="size-3.5 text-muted-foreground" aria-label="→" />
              <span>{stageName(next, locale)}</span>
            </p>
            {stageDescription(next, locale) && <p className="mt-0.5 text-sm text-pretty text-muted-foreground">{stageDescription(next, locale)}</p>}
            <p className="mt-1 text-xs text-muted-foreground">{t("stepper.responsible")}: <span className="font-medium text-foreground">{roleList(next)}</span></p>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            {!current ? t("stepper.noStage") : current.kind === "DONE" ? t("stepper.finished") : current.kind === "WAITING" ? t("stepper.waiting") : current.kind === "REJECTED" ? t("stepper.stopped") : t("stepper.last")}
          </p>
        )}
        {current && stageDescription(current, locale) && (
          <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
            {t("stepper.nowLabel")}: <span className="text-foreground">{stageDescription(current, locale)}</span> · {t("stepper.responsible")}: <span className="font-medium text-foreground">{roleList(current)}</span>
          </p>
        )}
      </div>

      <div className={cn("mt-5 grid gap-6", canManage && !compact && "xl:grid-cols-2")}>
        <div className="min-w-0">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">{t("stepper.history")}</h3>
          {transitions.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t("stepper.noHistory")}</p>
          ) : (
            <ol className="mt-2 space-y-3 border-l pl-4" data-testid="stepper-history">
              {transitions.map((h) => (
                <li key={h.id} className="relative">
                  <span aria-hidden className={cn("absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-card", h.auto ? "bg-muted-foreground" : "bg-primary")} />
                  <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
                    {h.fromStage || !h.auto ? <span className="font-medium">{h.fromStage ? nm(h.fromStage) : "—"}</span> : null}
                    {(h.fromStage || !h.auto) && <ArrowRight className="size-3.5 text-muted-foreground" aria-label="→" />}
                    <span className="font-medium">{nm(h.toStage)}</span>
                    <ToneBadge tone={h.auto ? "neutral" : "brand"} dot={false}>{h.auto ? t("stepper.auto") : t("stepper.manual")}</ToneBadge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {h.actor?.name ?? t("stepper.system")} · <time dateTime={h.createdAt.toISOString()}>{fmtDateTime(h.createdAt, locale)}</time>
                  </p>
                  {h.note && <p className="mt-1 text-sm text-pretty text-muted-foreground">{h.note}</p>}
                </li>
              ))}
            </ol>
          )}
        </div>
        {canManage && !compact && (
          <div className="min-w-0 border-t pt-5 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6">
            <h3 className="mb-3 text-sm font-semibold">{t("stepper.move.title")}</h3>
            <WorkflowMoveForm scope={scope} entityId={entityId} currentId={currentId} options={options} defaultTarget={next?.id} />
          </div>
        )}
        {canManage && compact && (
          <details className="group min-w-0 rounded-lg border" data-testid="workflow-move-details">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              {t("stepper.move.title")}
              <ChevronDown className="ml-auto size-4 text-muted-foreground transition-transform duration-150 group-open:rotate-180" aria-hidden />
            </summary>
            <div className="border-t p-4">
              <WorkflowMoveForm scope={scope} entityId={entityId} currentId={currentId} options={options} defaultTarget={next?.id} />
            </div>
          </details>
        )}
      </div>
    </section>
  );
}

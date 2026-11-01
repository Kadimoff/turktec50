import { getTranslations } from "next-intl/server";
import { AlertCircle, BadgeCheck, CheckCircle2, CircleDashed, Clock, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getProjectAccess } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { readinessFromChecklist } from "@/lib/kpi";
import { ProgressBar } from "@/components/shared/progress-bar";
import { ToneBadge } from "@/components/shared/tone-badge";
import { ChecklistItemCard, type ChecklistItemView } from "@/components/documents/checklist-item-card";
import { AnnexGuide } from "@/components/documents/annex-guide";
import { AddItemDialog } from "@/components/documents/add-item-dialog";
import { cn } from "@/lib/utils";

const CATEGORIES = ["CORE", "ANNEX", "CONDITIONAL"] as const;

export default async function ProjectDocumentsPage(props: PageProps<"/projects/[id]/documents">) {
  const { id } = await props.params;
  const user = await requireUser();
  const access = await getProjectAccess(user, id);

  const [project, rawItems, t, te] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id }, select: { packageQcPassed: true } }),
    prisma.checklistItem.findMany({
      where: { projectId: id },
      orderBy: [{ order: "asc" }],
      select: {
        id: true, key: true, title: true, category: true, required: true, status: true, reviewerNote: true, reviewedAt: true,
        reviewer: { select: { name: true } },
        documents: {
          // jury never sees confidential material — not even its existence
          where: access.isJury ? { confidential: false } : undefined,
          orderBy: { version: "desc" },
          select: { id: true, fileName: true, size: true, version: true, confidential: true, createdAt: true, uploadedBy: { select: { name: true } } },
        },
      },
    }),
    getTranslations("documents"),
    getTranslations("enums"),
  ]);

  const items: ChecklistItemView[] = rawItems.map((i) => ({ ...i, maxVersion: i.documents[0]?.version ?? 0 }));
  const labelOf = (i: ChecklistItemView) => (i.key ? t(`items.${i.key}.title` as never) : (i.title ?? "—"));
  const hintOf = (i: ChecklistItemView) => (i.key ? t(`items.${i.key}.hint` as never) : null);

  const readiness = readinessFromChecklist(items);
  const required = items.filter((i) => i.required);
  const approvedReq = required.filter((i) => i.status === "APPROVED").length;
  const missingReq = required.filter((i) => i.status === "MISSING");
  const awaiting = items.filter((i) => i.status === "UPLOADED" || i.status === "IN_REVIEW").length;
  const rejected = items.filter((i) => i.status === "REJECTED").length;

  const counters = [
    { label: t("readiness.approved"), value: `${approvedReq}/${required.length}`, icon: CheckCircle2, cls: "bg-success-soft text-success" },
    { label: t("readiness.missingRequired"), value: missingReq.length, icon: CircleDashed, cls: "bg-muted text-muted-foreground" },
    { label: t("readiness.awaitingReview"), value: awaiting, icon: Clock, cls: "bg-warning-soft text-warning" },
    { label: t("readiness.rejected"), value: rejected, icon: AlertCircle, cls: "bg-danger-soft text-danger" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        {access.isAdmin && <AddItemDialog projectId={id} />}
      </div>

      {/* readiness header */}
      <section className="rounded-xl border bg-card p-4 shadow-card sm:p-5" aria-labelledby="readiness-title">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-center">
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <h3 id="readiness-title" className="text-sm font-semibold">{t("readiness.title")}</h3>
              <span className="tabular text-3xl font-bold tracking-tight">{readiness}%</span>
            </div>
            <ProgressBar value={readiness} label={t("readiness.label")} showValue={false} className="mt-2" />
            <p className="mt-2 text-xs text-muted-foreground">{t("readiness.approvedOfRequired", { approved: approvedReq, required: required.length })}</p>
            <div className="mt-3">
              {project.packageQcPassed ? (
                <ToneBadge tone="success" dot={false}>
                  <BadgeCheck className="size-3.5" aria-hidden />
                  {t("readiness.qcPassed")}
                </ToneBadge>
              ) : (
                <ToneBadge tone="neutral" dot={false}>
                  <ShieldCheck className="size-3.5" aria-hidden />
                  {t("readiness.qcPending")}
                </ToneBadge>
              )}
              <p className="mt-1.5 text-[11px] text-muted-foreground">{t("readiness.qcNote")}</p>
            </div>
          </div>
          <div>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {counters.map((c) => (
                <div key={c.label} className="rounded-lg border bg-background/60 p-3">
                  <dt className="flex items-start gap-1.5 text-xs leading-tight font-medium text-muted-foreground">
                    <span className={cn("grid size-5 shrink-0 place-items-center rounded", c.cls)} aria-hidden>
                      <c.icon className="size-3" />
                    </span>
                    <span className="pt-0.5">{c.label}</span>
                  </dt>
                  <dd className="tabular mt-1 text-xl font-bold">{c.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground">{t("readiness.missingList")}</p>
              {missingReq.length === 0 ? (
                <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-success">
                  <CheckCircle2 className="size-3.5" aria-hidden />
                  {t("readiness.allPresent")}
                </p>
              ) : (
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {missingReq.map((i) => (
                    <li key={i.id}>
                      <a
                        href={`#item-${i.id}`}
                        className="inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-medium hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        {labelOf(i)}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          {CATEGORIES.map((cat) => {
            const group = items.filter((i) => i.category === cat);
            if (group.length === 0) return null;
            const approved = group.filter((i) => i.status === "APPROVED").length;
            return (
              <section key={cat} aria-labelledby={`group-${cat}`} className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                  <div className="min-w-0">
                    <h3 id={`group-${cat}`} className="text-sm font-semibold">
                      {te(`ChecklistCategory.${cat}`)}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">{t("itemsCount", { count: group.length })}</span>
                    </h3>
                    <p className="text-xs text-muted-foreground">{t(`groups.${cat}`)}</p>
                  </div>
                  <span className="tabular text-xs font-medium text-muted-foreground">{t("groupProgress", { approved, total: group.length })}</span>
                </div>
                <div className="grid gap-3">
                  {group.map((item) => (
                    <ChecklistItemCard
                      key={item.id}
                      item={item}
                      label={labelOf(item)}
                      hint={hintOf(item)}
                      projectId={id}
                      canWork={access.canWork}
                      canReview={access.canReview}
                      canDelete={access.isAdmin}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
        <aside className="xl:sticky xl:top-20 xl:self-start">
          <AnnexGuide jury={access.isJury} />
        </aside>
      </div>
    </div>
  );
}

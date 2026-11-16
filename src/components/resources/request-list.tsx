import { getLocale, getTranslations } from "next-intl/server";
import { CalendarClock, FlaskConical, Handshake, Package, UserRound } from "lucide-react";
import { prisma } from "@/lib/db";
import type { ProjectAccess } from "@/lib/rbac";
import { bakuYmd } from "@/lib/dates";
import { fmtDate, fmtDateTime, fmtRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EnumBadge } from "@/components/shared/enum-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { HumanControlNote } from "@/components/shared/notice";
import { ToneBadge } from "@/components/shared/tone-badge";
import { dueLabel } from "@/components/dashboard/parts";
import { resourceTone } from "@/lib/tones";
import { ResourceFormDialog } from "./resource-form-dialog";
import { DecisionDialog } from "./decision-dialog";
import { DECISION_FLOW, type ResourceOption, type ResourceStatusKey } from "./types";

const STATUSES: ResourceStatusKey[] = ["NEW", "UNDER_REVIEW", "APPROVED", "REJECTED", "DONE"];

/** Resource requests of one project: list, create/edit (canWork, own while NEW) and coordinator decisions (canManage). */
export async function ResourceRequestList({ projectId, userId, access }: { projectId: string; userId: string; access: ProjectAccess }) {
  const [t, te, tc, locale] = await Promise.all([getTranslations("resources"), getTranslations("enums"), getTranslations("common"), getLocale()]);
  const now = new Date();

  const [requests, labs, partners] = await Promise.all([
    prisma.resourceRequest.findMany({
      where: { projectId },
      // enum order = workflow order: NEW, UNDER_REVIEW, APPROVED, REJECTED, DONE
      orderBy: [{ status: "asc" }, { neededBy: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      select: {
        id: true, title: true, details: true, status: true, neededBy: true, createdAt: true, decisionNote: true, decidedAt: true,
        labId: true, partnerId: true, requestedById: true,
        lab: { select: { name: true, status: true } },
        partner: { select: { name: true, status: true } },
        requestedBy: { select: { name: true } },
        decidedBy: { select: { name: true } },
      },
    }),
    access.canWork
      ? prisma.lab.findMany({ where: { status: { not: "CLOSED" } }, orderBy: { name: "asc" }, select: { id: true, name: true, status: true } })
      : Promise.resolve([]),
    access.canWork
      ? prisma.partner.findMany({ where: { status: { in: ["ACTIVE", "NEGOTIATING"] } }, orderBy: { name: "asc" }, select: { id: true, name: true, status: true } })
      : Promise.resolve([]),
  ]);

  const labOptions: ResourceOption[] = labs.map((l) => ({ value: l.id, label: l.status === "AVAILABLE" ? l.name : `${l.name} · ${te(`LabStatus.${l.status}`)}` }));
  const partnerOptions: ResourceOption[] = partners.map((p) => ({ value: p.id, label: p.status === "ACTIVE" ? p.name : `${p.name} · ${te(`PartnerStatus.${p.status}`)}` }));
  const today = bakuYmd(now);
  const counts = STATUSES.map((s) => ({ s, n: requests.filter((r) => r.status === s).length })).filter((c) => c.n > 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">{t("title")}</h2>
          <p className="max-w-3xl text-sm text-pretty text-muted-foreground">{t("description")}</p>
        </div>
        {access.canWork && (
          <div className="shrink-0">
            <ResourceFormDialog projectId={projectId} labs={labOptions} partners={partnerOptions} minDate={today} />
          </div>
        )}
      </div>

      {counts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold text-muted-foreground">{t("summary", { count: requests.length })}</p>
          <ul className="flex flex-wrap gap-1.5" aria-label={t("summaryLabel")}>
            {counts.map(({ s, n }) => (
              <li key={s}>
                <ToneBadge tone={resourceTone[s]}>
                  {te(`ResourceStatus.${s}`)}
                  <span className="tabular">{n}</span>
                </ToneBadge>
              </li>
            ))}
          </ul>
        </div>
      )}

      <HumanControlNote />

      {requests.length === 0 ? (
        <EmptyState icon={Package} title={t("empty.title")} description={access.canWork ? t("empty.hint") : t("empty.hintReadonly")} />
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => {
            const status = r.status as ResourceStatusKey;
            const final = status === "DONE" || status === "REJECTED";
            const due = r.neededBy && !final ? dueLabel(r.neededBy, tc, locale, now) : null;
            const canEdit = access.canWork && status === "NEW" && r.requestedById === userId;
            const canDecide = access.canManage && DECISION_FLOW[status].length > 0;
            return (
              <li key={r.id} id={`rr-${r.id}`} className="scroll-mt-24 rounded-xl border bg-card p-4 shadow-card sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h3 className="text-sm font-semibold text-pretty">{r.title}</h3>
                      <EnumBadge enumName="ResourceStatus" value={r.status} />
                    </div>
                    {r.details && <p className="mt-1 text-sm whitespace-pre-line text-pretty text-muted-foreground">{r.details}</p>}
                  </div>
                  {(canEdit || canDecide) && (
                    <div className="flex shrink-0 items-center gap-1">
                      {canEdit && (
                        <ResourceFormDialog
                          projectId={projectId}
                          labs={labOptions}
                          partners={partnerOptions}
                          minDate={today}
                          request={{
                            id: r.id,
                            title: r.title,
                            details: r.details ?? "",
                            labId: r.labId ?? "",
                            partnerId: r.partnerId ?? "",
                            neededBy: r.neededBy ? bakuYmd(r.neededBy) : "",
                            labLabel: r.lab ? `${r.lab.name} · ${te(`LabStatus.${r.lab.status}`)}` : undefined,
                            partnerLabel: r.partner ? `${r.partner.name} · ${te(`PartnerStatus.${r.partner.status}`)}` : undefined,
                          }}
                        />
                      )}
                      {canDecide && <DecisionDialog projectId={projectId} requestId={r.id} title={r.title} status={status} humanNote={<HumanControlNote />} />}
                    </div>
                  )}
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:gap-x-6 xl:grid-cols-4">
                  <Fact icon={FlaskConical} label={t("fields.lab")}>{r.lab?.name ?? <span className="text-muted-foreground">{t("fields.none")}</span>}</Fact>
                  <Fact icon={Handshake} label={t("fields.partner")}>{r.partner?.name ?? <span className="text-muted-foreground">{t("fields.none")}</span>}</Fact>
                  <Fact icon={CalendarClock} label={t("fields.neededBy")}>
                    {r.neededBy ? (
                      <time dateTime={r.neededBy.toISOString()} className={cn("tabular", due?.overdue && "font-semibold text-danger")}>
                        {due ? due.text : fmtDate(r.neededBy, locale)}
                      </time>
                    ) : (
                      <span className="text-muted-foreground">{t("fields.noDate")}</span>
                    )}
                  </Fact>
                  <Fact icon={UserRound} label={t("fields.requestedBy")}>
                    <span>{r.requestedBy?.name ?? t("fields.unknown")}</span>
                    <span className="block text-xs text-muted-foreground">
                      <time dateTime={r.createdAt.toISOString()} title={fmtDateTime(r.createdAt, locale)}>{fmtRelative(r.createdAt, locale)}</time>
                    </span>
                  </Fact>
                </dl>

                {r.decidedAt && (
                  <div className="mt-3 rounded-lg border-l-2 border-primary/50 bg-muted/50 px-3 py-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {status === "UNDER_REVIEW" ? t("decision.reviewTitle") : t("decision.title")}
                      {" · "}
                      {r.decidedBy?.name ?? t("fields.unknown")}
                      {" · "}
                      <time dateTime={r.decidedAt.toISOString()}>{fmtDateTime(r.decidedAt, locale)}</time>
                    </p>
                    {r.decisionNote ? (
                      <p className="mt-0.5 text-sm whitespace-pre-line text-pretty">{r.decisionNote}</p>
                    ) : (
                      <p className="mt-0.5 text-xs text-muted-foreground">{t("decision.noNote")}</p>
                    )}
                  </div>
                )}
                {status === "NEW" && r.requestedById === userId && (
                  <p className="mt-3 text-xs text-muted-foreground">{t("editableHint")}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Fact({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm break-words">{children}</dd>
      </div>
    </div>
  );
}

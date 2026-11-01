import { getLocale, getTranslations } from "next-intl/server";
import { AlertCircle, CheckCircle2, CircleDashed, Clock, Download, FileText, History, Lock, MessageSquareWarning, UploadCloud } from "lucide-react";
import { EnumBadge } from "@/components/shared/enum-badge";
import { ToneBadge } from "@/components/shared/tone-badge";
import { fmtBytes, fmtDate, fmtDateTime, fmtRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { UploadDialog } from "./upload-dialog";
import { ReviewActions } from "./review-actions";
import { DeleteVersionButton } from "./delete-version-button";

export type ChecklistItemView = {
  id: string;
  key: string | null;
  title: string | null;
  category: "CORE" | "ANNEX" | "CONDITIONAL";
  required: boolean;
  status: "MISSING" | "UPLOADED" | "IN_REVIEW" | "APPROVED" | "REJECTED";
  reviewerNote: string | null;
  reviewedAt: Date | null;
  reviewer: { name: string } | null;
  maxVersion: number;
  documents: {
    id: string;
    fileName: string;
    size: number;
    version: number;
    confidential: boolean;
    createdAt: Date;
    uploadedBy: { name: string } | null;
  }[];
};

const statusIcon = {
  MISSING: { icon: CircleDashed, cls: "bg-muted text-muted-foreground" },
  UPLOADED: { icon: UploadCloud, cls: "bg-info-soft text-info" },
  IN_REVIEW: { icon: Clock, cls: "bg-warning-soft text-warning" },
  APPROVED: { icon: CheckCircle2, cls: "bg-success-soft text-success" },
  REJECTED: { icon: AlertCircle, cls: "bg-danger-soft text-danger" },
} as const;

export async function ChecklistItemCard({
  item,
  label,
  hint,
  projectId,
  canWork,
  canReview,
  canDelete,
}: {
  item: ChecklistItemView;
  label: string;
  hint: string | null;
  projectId: string;
  canWork: boolean;
  canReview: boolean;
  canDelete: boolean;
}) {
  const [t, locale] = await Promise.all([getTranslations("documents"), getLocale()]);
  const latest = item.documents[0];
  const older = item.documents.slice(1);
  const S = statusIcon[item.status];

  return (
    <article id={`item-${item.id}`} className="scroll-mt-20 rounded-xl border bg-card p-4 shadow-card target:ring-2 target:ring-ring/60">
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg", S.cls)} aria-hidden>
          <S.icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h4 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
                <span className="break-words">{label}</span>
                <span
                  className={cn(
                    "rounded-md border px-1.5 py-px text-[11px] font-semibold",
                    item.required ? "border-danger/30 text-danger" : "text-muted-foreground",
                  )}
                >
                  {item.required ? t("required") : t("optional")}
                </span>
                {!item.key && <span className="rounded-md bg-muted px-1.5 py-px text-[11px] font-medium text-muted-foreground">{t("custom")}</span>}
              </h4>
              {hint && <p className="mt-1 text-xs text-pretty text-muted-foreground">{hint}</p>}
            </div>
            <EnumBadge enumName="ChecklistStatus" value={item.status} className="self-start" />
          </div>

          {/* latest file */}
          {latest ? (
            <div className="mt-3 flex flex-col gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-2.5">
                <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <a
                    href={`/api/documents/${latest.id}`}
                    className="block truncate text-sm font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                    aria-label={t("downloadFile", { name: latest.fileName })}
                    title={latest.fileName}
                  >
                    {latest.fileName}
                  </a>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="tabular font-semibold text-foreground">{t("version", { n: latest.version })}</span>
                    <span aria-hidden>·</span>
                    <span className="tabular">{fmtBytes(latest.size)}</span>
                    <span aria-hidden>·</span>
                    <span>{latest.uploadedBy?.name ?? t("unknownUser")}</span>
                    <span aria-hidden>·</span>
                    <time dateTime={latest.createdAt.toISOString()} title={fmtDateTime(latest.createdAt, locale)}>
                      {fmtRelative(latest.createdAt, locale)}
                    </time>
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {latest.confidential && (
                  <ToneBadge tone="warning" dot={false}>
                    <Lock className="size-3" aria-hidden />
                    {t("confidential")}
                    <span className="sr-only">— {t("confidentialHint")}</span>
                  </ToneBadge>
                )}
                <a
                  href={`/api/documents/${latest.id}`}
                  className="inline-grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  aria-label={t("downloadFile", { name: latest.fileName })}
                >
                  <Download className="size-4" aria-hidden />
                </a>
                {canDelete && <DeleteVersionButton documentId={latest.id} fileName={latest.fileName} version={latest.version} />}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">{item.status === "MISSING" ? t("noFile") : t("noVisibleFile")}</p>
          )}

          {/* review outcome */}
          {item.status === "REJECTED" && item.reviewerNote && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-danger" role="note">
              <MessageSquareWarning className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="min-w-0 text-xs">
                <p className="font-semibold">{t("reviewerNote")}</p>
                <p className="mt-0.5 text-pretty break-words">{item.reviewerNote}</p>
                {item.reviewer && item.reviewedAt && (
                  <p className="mt-1 opacity-80">{t("reviewedBy", { name: item.reviewer.name, date: fmtDate(item.reviewedAt, locale) })}</p>
                )}
              </div>
            </div>
          )}
          {item.status === "APPROVED" && item.reviewer && item.reviewedAt && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-success">
              <CheckCircle2 className="size-3.5" aria-hidden />
              {t("approvedBy", { name: item.reviewer.name, date: fmtDate(item.reviewedAt, locale) })}
            </p>
          )}
          {item.status === "IN_REVIEW" && item.reviewer && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-warning">
              <Clock className="size-3.5" aria-hidden />
              {t("inReviewBy", { name: item.reviewer.name })}
            </p>
          )}

          {/* actions + history */}
          {(canWork || (canReview && latest) || older.length > 0) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {canWork && (
                <UploadDialog
                  projectId={projectId}
                  itemId={item.id}
                  itemLabel={label}
                  nextVersion={item.maxVersion + 1}
                  conditional={item.category === "CONDITIONAL"}
                />
              )}
              {canReview && latest && item.status !== "MISSING" && (
                <ReviewActions projectId={projectId} itemId={item.id} itemLabel={label} latestVersion={latest.version} status={item.status} />
              )}
            </div>
          )}
          {older.length > 0 && (
            <details className="group mt-3 rounded-lg border">
              <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                <History className="size-3.5" aria-hidden />
                {t("history", { count: older.length })}
                <span aria-hidden className="ml-auto transition-transform group-open:rotate-90">›</span>
              </summary>
              <ol className="divide-y border-t">
                {older.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 px-3 py-2">
                    <span className="tabular w-8 shrink-0 text-xs font-semibold">{t("version", { n: d.version })}</span>
                    <div className="min-w-0 flex-1">
                      <a
                        href={`/api/documents/${d.id}`}
                        className="block truncate text-xs font-medium underline-offset-4 hover:text-primary hover:underline"
                        aria-label={t("downloadFile", { name: d.fileName })}
                        title={d.fileName}
                      >
                        {d.fileName}
                      </a>
                      <p className="text-[11px] text-muted-foreground">
                        {fmtBytes(d.size)} · {d.uploadedBy?.name ?? t("unknownUser")} · {fmtDateTime(d.createdAt, locale)}
                      </p>
                    </div>
                    {d.confidential && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-warning">
                        <Lock className="size-3" aria-hidden />
                        {t("confidential")}
                      </span>
                    )}
                    {canDelete && <DeleteVersionButton documentId={d.id} fileName={d.fileName} version={d.version} />}
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      </div>
    </article>
  );
}

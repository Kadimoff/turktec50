import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, MessageSquareWarning } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { isIntakeTokenShape } from "@/components/intake/token";
import { STUDENT_EDITABLE_STATUSES } from "@/components/intake/shared";
import { getIntakeByToken, getIntakeFormOptions, intakeDraftOf } from "@/components/intake/public/server";
import { IntakeForm } from "@/components/intake/public/intake-form";
import type { IntakeStatus } from "@/generated/prisma/enums";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("intake.meta");
  return { title: t("edit"), referrer: "no-referrer", robots: { index: false, follow: false } };
}

export default async function IntakeEditPage(props: PageProps<"/apply/status/[token]/edit">) {
  const { token } = await props.params;
  if (!isIntakeTokenShape(token)) notFound();
  const r = await getIntakeByToken(token);
  if (!r) notFound();
  const statusPath = `/apply/status/${token}`;
  // Only while it waits for review or was returned for changes (the save action re-checks this atomically).
  if (!(STUDENT_EDITABLE_STATUSES as readonly IntakeStatus[]).includes(r.status)) redirect(statusPath);

  const [t, options] = await Promise.all([getTranslations("intake"), getIntakeFormOptions()]);
  const initial = intakeDraftOf(r, new Set(options.faculties.map((f) => f.id)));

  return (
    <div className="space-y-6">
      <Link
        href={statusPath}
        className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("status.back")}
      </Link>
      <PageHeader eyebrow={t("status.eyebrow", { code: r.code })} title={t("status.editTitle")} description={t("status.editDescription")} />
      {r.status === "NEEDS_CHANGES" && r.reviewNote && (
        <div role="note" className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4">
          <MessageSquareWarning className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-warning">{t("status.note.NEEDS_CHANGES")}</p>
            <p className="text-sm whitespace-pre-line text-pretty break-words text-foreground">{r.reviewNote}</p>
          </div>
        </div>
      )}
      <IntakeForm options={options} mode="edit" token={token} initial={initial} />
    </div>
  );
}

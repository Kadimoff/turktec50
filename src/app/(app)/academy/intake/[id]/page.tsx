import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { EnumBadge } from "@/components/shared/enum-badge";
import { Button } from "@/components/ui/button";
import { IntakeDetail } from "@/components/intake/admin/intake-detail";
import { fmtDateTime, fmtRelative } from "@/lib/format";

export async function generateMetadata() {
  const t = await getTranslations("intakeAdmin");
  return { title: t("detail.metaTitle") };
}

export default async function IntakeDetailPage(props: PageProps<"/academy/intake/[id]">) {
  await requireUser(["ADMIN"]);
  const [{ id }, t, locale] = await Promise.all([props.params, getTranslations("intakeAdmin"), getLocale()]);
  const head = await prisma.intakeRequest.findUnique({ where: { id }, select: { id: true, code: true, teamName: true, status: true, submittedAt: true } });
  if (!head) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("detail.eyebrow", { code: head.code })}
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="min-w-0 break-words">{head.teamName}</span>
            <EnumBadge enumName="IntakeStatus" value={head.status} className="align-middle" />
          </span>
        }
        description={t("detail.submitted", { date: fmtDateTime(head.submittedAt, locale), ago: fmtRelative(head.submittedAt, locale) })}
        actions={
          <Button variant="outline" size="lg" nativeButton={false} render={<Link href="/academy/intake" />}>
            <ArrowLeft aria-hidden />
            {t("detail.back")}
          </Button>
        }
      />
      <IntakeDetail id={head.id} />
    </div>
  );
}

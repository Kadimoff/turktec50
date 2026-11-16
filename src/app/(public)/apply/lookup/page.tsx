import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { LookupForm } from "@/components/intake/public/lookup-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("intake.meta");
  return { title: t("lookup"), robots: { index: false, follow: false } };
}

export default async function IntakeLookupPage() {
  const t = await getTranslations("intake");
  return (
    <div className="space-y-6">
      <Link
        href="/apply"
        className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("lookup.back")}
      </Link>
      <PageHeader eyebrow={t("lookup.eyebrow")} title={t("lookup.title")} description={t("lookup.description")} />
      <LookupForm />
      <p className="flex items-start gap-2 text-xs text-pretty text-muted-foreground">
        <KeyRound className="mt-px size-3.5 shrink-0" aria-hidden />
        <span>{t("lookup.lostLink")}</span>
      </p>
    </div>
  );
}

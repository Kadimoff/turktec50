import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Inbox } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { getIntakeFormOptions } from "@/components/intake/public/server";
import { IntakeApply } from "@/components/intake/public/intake-form";
import { getCurrentUser } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("intake.meta");
  return { title: t("apply"), description: t("applyDescription") };
}

export default async function ApplyPage(props: PageProps<"/apply">) {
  const [t, options, sp, user] = await Promise.all([getTranslations("intake"), getIntakeFormOptions(), props.searchParams, getCurrentUser()]);
  // ?competition=<id> from the catalog card; a signed-in team member is prefilled as the captain (all fields stay editable)
  const wanted = typeof sp.competition === "string" ? sp.competition : "";
  const preset = {
    competitionId: options.competitions.some((c) => c.id === wanted) ? wanted : "",
    captain: user?.role === "TEAM" ? { name: user.name, email: user.email } : null,
    universityId: user?.role === "TEAM" && options.universities.some((u) => u.id === user.universityId) ? user.universityId! : "",
  };
  const ready = options.competitions.length > 0 && options.universities.length > 0;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t("form.eyebrow")} title={t("form.title")} description={t("form.description")} />

      <section aria-labelledby="intake-how" className="rounded-xl border bg-card p-4 shadow-card sm:p-5">
        <h2 id="intake-how" className="text-sm font-semibold">{t("form.how.title")}</h2>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          {(["s1", "s2", "s3"] as const).map((k, i) => (
            <li key={k} className="flex items-start gap-2.5 text-sm">
              <span aria-hidden className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">{i + 1}</span>
              <span className="min-w-0 text-pretty">{t(`form.how.${k}`)}</span>
            </li>
          ))}
        </ol>
        <Link
          href="/apply/lookup"
          className="group mt-4 inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {t("form.lookupCta")}
          <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </section>

      {ready ? (
        <IntakeApply options={options} preset={preset} />
      ) : (
        <EmptyState icon={Inbox} title={t("form.unavailableTitle")} description={t("form.unavailableBody")} />
      )}
    </div>
  );
}

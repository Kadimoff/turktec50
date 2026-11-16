import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { HumanControlNote } from "@/components/shared/notice";
import { ProcessView } from "@/components/process/process-view";
import { getProcessData } from "@/components/process/data";

export async function generateMetadata() {
  const t = await getTranslations("process");
  return { title: t("title") };
}

/** Live process map for every role; data is filtered by rbac (TEAM: own project only, MENTOR/JURY: assigned, ADMIN: all). */
export default async function ProcessPage(props: PageProps<"/process">) {
  const user = await requireUser();
  const locale = await getLocale();
  const sp = await props.searchParams;
  const [t, data] = await Promise.all([getTranslations("process"), getProcessData(user, locale)]);
  const requested = typeof sp.stage === "string" ? sp.stage : null;
  const initial = (requested && data.stages.some((s) => s.id === requested) ? requested : null)
    ?? (user.role === "TEAM" ? (data.stages.filter((s) => s.mine && s.scope === "PROJECT")[0]?.id ?? data.stages.find((s) => s.mine)?.id ?? null) : null);
  const scopeKey = user.role === "ADMIN" ? "admin" : user.role === "TEAM" ? "team" : user.role === "MENTOR" ? "mentor" : "jury";
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <p className="rounded-lg border border-info/30 bg-info-soft px-4 py-2.5 text-sm text-info" data-testid="scope-note">{t(`scopeNote.${scopeKey}`)}</p>
      <ProcessView data={data} canManage={user.role === "ADMIN"} initialSelected={initial} />
      <HumanControlNote />
    </div>
  );
}

import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { RiskRegister } from "@/components/risks/risk-register";

export default async function RisksPage(props: PageProps<"/risks">) {
  const user = await requireUser(["ADMIN", "MENTOR", "TEAM"]);
  const [t, sp] = await Promise.all([getTranslations("risks"), props.searchParams]);
  const description = user.role === "ADMIN" ? t("descriptionAdmin") : user.role === "MENTOR" ? t("descriptionMentor") : t("descriptionTeam");
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={description} />
      <RiskRegister user={user} basePath="/risks" searchParams={sp} />
    </div>
  );
}

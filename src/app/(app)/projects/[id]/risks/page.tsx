import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { getProjectAccess } from "@/lib/rbac";
import { RiskRegister } from "@/components/risks/risk-register";

export default async function ProjectRisksPage(props: PageProps<"/projects/[id]/risks">) {
  const { id } = await props.params;
  const user = await requireUser();
  const access = await getProjectAccess(user, id);
  if (!access.tabs.includes("risks")) notFound(); // jury: no risk register
  const [t, sp] = await Promise.all([getTranslations("risks"), props.searchParams]);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t("projectTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("projectDescription")}</p>
      </div>
      <RiskRegister user={user} projectId={id} basePath={`/projects/${id}/risks`} searchParams={sp} />
    </div>
  );
}

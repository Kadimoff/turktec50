import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { HumanControlNote } from "@/components/shared/notice";
import { EmptyState } from "@/components/shared/empty-state";
import { JurorHome } from "@/components/jury/juror-home";
import { JuryOverview } from "@/components/jury/jury-overview";
import { RubricReference } from "@/components/jury/rubric-reference";
import { KindSwitch } from "@/components/jury/kind-switch";
import { getRubric, parseKind } from "@/components/jury/data";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("jury") };
}

export default async function JuryPage(props: PageProps<"/jury">) {
  const user = await requireUser(["ADMIN", "JURY"]);
  const sp = await props.searchParams;
  const t = await getTranslations("jury");

  if (user.role === "JURY") {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow={t("home.eyebrow")} title={t("home.title")} description={t("home.description")} />
        <HumanControlNote />
        <JurorHome user={user} />
        <RubricReference />
      </div>
    );
  }

  const kind = parseKind(sp.kind);
  const rubric = await getRubric(kind);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("overview.eyebrow")}
        title={t("overview.title")}
        description={t("overview.description")}
        actions={<KindSwitch basePath="/jury" kind={kind} />}
      />
      <HumanControlNote />
      {rubric ? <JuryOverview rubric={rubric} kind={kind} /> : <EmptyState title={t("page.noRubric")} />}
      <RubricReference />
    </div>
  );
}

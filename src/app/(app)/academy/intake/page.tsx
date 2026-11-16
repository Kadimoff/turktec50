import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { IntakeList } from "@/components/intake/admin/intake-list";

export async function generateMetadata() {
  const t = await getTranslations("intakeAdmin");
  return { title: t("title") };
}

export default async function IntakePage(props: PageProps<"/academy/intake">) {
  await requireUser(["ADMIN"]);
  const [t, sp] = await Promise.all([getTranslations("intakeAdmin"), props.searchParams]);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <IntakeList searchParams={sp} />
    </div>
  );
}

import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { StudentsView } from "@/components/academy/students/students-view";

export async function generateMetadata() {
  const t = await getTranslations("teams");
  return { title: t("students.title") };
}

export default async function StudentsPage(props: PageProps<"/academy/students">) {
  await requireUser(["ADMIN"]);
  const [t, sp] = await Promise.all([getTranslations("teams"), props.searchParams]);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t("eyebrow")} title={t("students.title")} description={t("students.description")} />
      <StudentsView searchParams={sp} />
    </div>
  );
}

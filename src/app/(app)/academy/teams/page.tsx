import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { TeamsView } from "@/components/academy/teams/teams-view";
import { MentorTeamsView } from "@/components/academy/teams/mentor-teams-view";

export async function generateMetadata() {
  const t = await getTranslations("teams");
  return { title: t("teams.title") };
}

export default async function TeamsPage(props: PageProps<"/academy/teams">) {
  const user = await requireUser(["ADMIN", "MENTOR"]);
  const [t, sp] = await Promise.all([getTranslations("teams"), props.searchParams]);
  if (user.role === "MENTOR") {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow={t("eyebrow")} title={t("mentor.title")} description={t("mentor.description")} />
        <MentorTeamsView user={user} />
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t("eyebrow")} title={t("teams.title")} description={t("teams.description")} />
      <TeamsView searchParams={sp} />
    </div>
  );
}

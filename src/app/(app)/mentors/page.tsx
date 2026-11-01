import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { AdminMentorsView, MentorSessionsView, TeamMentorsView } from "@/components/mentors/views";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mentors");
  return { title: t("title") };
}

/** ADMIN: mentor pool + all sessions · MENTOR: my sessions · TEAM: my mentors + project sessions. JURY: no access. */
export default async function MentorsPage(props: PageProps<"/mentors">) {
  const user = await requireUser(["ADMIN", "TEAM", "MENTOR"]);
  if (user.role === "ADMIN") return <AdminMentorsView user={user} showAll={(await props.searchParams).upcoming === "all"} />;
  if (user.role === "MENTOR") return <MentorSessionsView user={user} />;
  return <TeamMentorsView user={user} />;
}

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { TaskWorkspace } from "@/components/tasks/task-workspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tasks");
  return { title: t("title") };
}

/** Tasks across the user's project scope (TEAM: own project, MENTOR: assigned, ADMIN: all). JURY has no access. */
export default async function TasksPage(props: PageProps<"/tasks">) {
  const user = await requireUser(["ADMIN", "TEAM", "MENTOR"]);
  const sp = await props.searchParams;
  const t = await getTranslations("tasks");
  return (
    <TaskWorkspace
      user={user}
      searchParams={sp}
      basePath="/tasks"
      heading={{ kind: "page", eyebrow: t("eyebrow"), title: t("title"), description: t(`description.${user.role as "ADMIN" | "TEAM" | "MENTOR"}`) }}
    />
  );
}

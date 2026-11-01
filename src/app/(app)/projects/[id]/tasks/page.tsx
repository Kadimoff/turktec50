import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { getProjectAccess } from "@/lib/rbac";
import { TaskWorkspace } from "@/components/tasks/task-workspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tasks");
  return { title: t("title") };
}

/** Project tab: tasks of one project (board default, table, or grouped by program week). */
export default async function ProjectTasksPage(props: PageProps<"/projects/[id]/tasks">) {
  const { id } = await props.params;
  const user = await requireUser();
  const access = await getProjectAccess(user, id);
  if (!access.tabs.includes("tasks")) notFound();
  const sp = await props.searchParams;
  const t = await getTranslations("tasks");
  return (
    <TaskWorkspace
      user={user}
      searchParams={sp}
      projectId={id}
      basePath={`/projects/${id}/tasks`}
      heading={{ kind: "section", title: t("projectSection.title"), description: t("projectSection.description") }}
    />
  );
}

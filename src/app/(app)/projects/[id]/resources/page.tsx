import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getProjectAccess } from "@/lib/rbac";
import { ResourceRequestList } from "@/components/resources/request-list";

export default async function ProjectResourcesPage(props: PageProps<"/projects/[id]/resources">) {
  const { id } = await props.params;
  const user = await requireUser();
  const access = await getProjectAccess(user, id);
  if (!access.tabs.includes("resources")) notFound(); // jury: no resource requests
  return <ResourceRequestList projectId={id} userId={user.id} access={access} />;
}

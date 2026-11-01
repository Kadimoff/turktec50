import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { getProjectAccess } from "@/lib/rbac";
import { ProjectTimeline } from "@/components/audit/project-timeline";

const STEP = 60;
const MAX = 600;

export async function generateMetadata() {
  const t = await getTranslations("nav.projectTabs");
  return { title: t("activity") };
}

export default async function ActivityPage(props: PageProps<"/projects/[id]/activity">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const user = await requireUser();
  const access = await getProjectAccess(user, id);
  if (!access.tabs.includes("activity")) notFound();

  const raw = Number(Array.isArray(sp.limit) ? sp.limit[0] : sp.limit);
  const limit = Number.isInteger(raw) && raw > 0 ? Math.min(MAX, raw) : STEP;
  const t = await getTranslations("audit");

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t("activity.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("activity.description")}</p>
      </div>
      <ProjectTimeline projectId={id} limit={limit} moreHref={`/projects/${id}/activity?limit=${Math.min(MAX, limit + STEP)}`} />
    </div>
  );
}

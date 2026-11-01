import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getProjectAccess } from "@/lib/rbac";
import { getCadence, getPlanProjects, loadSessions } from "@/components/mentors/queries";
import { CadenceStrip, SessionTimeline } from "@/components/mentors/session-timeline";
import { PlanSessionButton } from "@/components/mentors/session-dialogs";
import { NotesExplainer } from "@/components/mentors/notes-explainer";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mentors");
  return { title: t("projectSection.title") };
}

/** Project tab: mentor session timeline (visible to the project team, its mentors and the coordinator only). */
export default async function ProjectSessionsPage(props: PageProps<"/projects/[id]/sessions">) {
  const { id } = await props.params;
  const user = await requireUser();
  const access = await getProjectAccess(user, id);
  if (!access.tabs.includes("sessions") || user.role === "JURY") notFound();
  const [t, locale] = await Promise.all([getTranslations("mentors"), getLocale()]);
  const now = new Date();

  const [upcoming, past, planProjects, cadence] = await Promise.all([
    loadSessions(user, locale, { projectId: id, status: { in: ["PLANNED", "CONFIRMED"] }, scheduledAt: { gte: now } }, { scheduledAt: "asc" }),
    loadSessions(
      user,
      locale,
      { projectId: id, OR: [{ status: { in: ["COMPLETED", "CANCELLED"] } }, { scheduledAt: { lt: now } }] },
      { scheduledAt: "desc" },
    ),
    getPlanProjects(user, id),
    getCadence([id], now),
  ]);
  // sessions whose time has passed without notes first in "past"
  past.sort((a, b) => Number(b.needsNotes) - Number(a.needsNotes));
  const c = cadence.get(id)!;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t("projectSection.title")}</h2>
          <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">{t("projectSection.description")}</p>
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5" aria-hidden />
            {t("visibility")}
          </p>
        </div>
        <PlanSessionButton projects={planProjects} mode={user.role === "TEAM" ? "request" : "plan"} defaultProjectId={id} size="default" />
      </div>
      <CadenceStrip last={c.last} next={c.next} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <SessionTimeline upcoming={upcoming} past={past} />
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <NotesExplainer />
        </aside>
      </div>
    </div>
  );
}

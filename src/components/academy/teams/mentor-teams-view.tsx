import { getTranslations } from "next-intl/server";
import { Crown, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { EnumBadge } from "@/components/shared/enum-badge";
import { EmptyState } from "@/components/shared/empty-state";

/** Read-only view for a MENTOR: the open Academy teams they are assigned to (target of the `team_mentor` notification). */
export async function MentorTeamsView({ user }: { user: CurrentUser }) {
  const t = await getTranslations("teams");
  const teams = await prisma.team.findMany({
    where: { mentorId: user.id, status: { not: "ARCHIVED" } },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, status: true, captainId: true,
      faculty: { select: { name: true } },
      competition: { select: { name: true } },
      members: { select: { id: true, name: true, email: true, skills: true }, orderBy: { name: "asc" } },
      applications: { select: { code: true, status: true }, orderBy: { submittedAt: "desc" }, take: 1 },
    },
  });

  if (teams.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-card">
        <EmptyState icon={Users} title={t("mentor.empty")} description={t("mentor.emptyHint")} />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {teams.map((tm) => {
        const app = tm.applications[0];
        return (
          <section key={tm.id} aria-labelledby={`team-${tm.id}`} className="rounded-xl border bg-card p-5 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 id={`team-${tm.id}`} className="text-sm font-semibold">{tm.name}</h2>
              <EnumBadge enumName="TeamStatus" value={tm.status} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {[tm.faculty?.name ?? t("teams.table.noFaculty"), tm.competition?.name ?? t("teams.table.noCompetition")].join(" · ")}
            </p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">{t("teams.table.application")}</dt>
                <dd className="mt-0.5 flex flex-wrap items-center gap-2">
                  {app ? (
                    <>
                      <span className="tabular font-medium">{app.code}</span>
                      <EnumBadge enumName="ApplicationStatus" value={app.status} />
                    </>
                  ) : (
                    <span className="text-muted-foreground">{t("teams.table.noApplication")}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("teams.table.members")}</dt>
                <dd className="tabular mt-0.5 font-medium">{tm.members.length}</dd>
              </div>
            </dl>
            {tm.members.length > 0 && (
              <ul className="mt-4 divide-y border-t" aria-label={t("teams.table.members")}>
                {tm.members.map((m) => (
                  <li key={m.id} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-0.5 py-2 text-sm">
                    <span className="flex items-center gap-1.5 font-medium">
                      {m.id === tm.captainId && <Crown className="size-3.5 text-warning" aria-hidden />}
                      {m.name}
                      {m.id === tm.captainId && <span className="sr-only"> ({t("teams.table.captain")})</span>}
                    </span>
                    <a href={`mailto:${m.email}`} className="min-w-0 truncate text-xs text-muted-foreground hover:text-foreground">{m.email}</a>
                    {m.skills && <span className="w-full text-xs text-muted-foreground">{m.skills}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

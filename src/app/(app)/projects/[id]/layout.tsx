import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Building2, ChevronLeft, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getProjectAccess } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { EnumBadge } from "@/components/shared/enum-badge";
import { ProjectTabs } from "@/components/shell/project-tabs";

/** Shared header + role-based tabs for every /projects/[id]/* page. */
export default async function ProjectLayout(props: LayoutProps<"/projects/[id]">) {
  const { id } = await props.params;
  const user = await requireUser();
  const access = await getProjectAccess(user, id);
  const project = await prisma.project.findUniqueOrThrow({
    where: { id },
    select: {
      code: true, title: true, tagline: true, stage: true, health: true, category: true, result: true,
      university: { select: { shortName: true } }, competition: { select: { name: true } },
    },
  });
  const [t, tn] = await Promise.all([getTranslations("common"), getTranslations("nav")]);
  return (
    <div className="space-y-5">
      {user.role !== "TEAM" && (
        <Link href="/projects" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground no-print">
          <ChevronLeft className="size-3.5" aria-hidden />
          {tn("projects")}
        </Link>
      )}
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-primary">{project.code}</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-balance">{project.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{project.tagline}</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Building2 className="size-3.5" aria-hidden />{project.university.shortName}</span>
            <span>{t(`categories.${project.category}` as never)}</span>
            {project.competition && <span className="inline-flex items-center gap-1.5"><Trophy className="size-3.5" aria-hidden />{project.competition.name}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EnumBadge enumName="ProjectStage" value={project.stage} />
          <EnumBadge enumName="ProjectHealth" value={project.health} />
          {project.result === "FINALIST" && <EnumBadge enumName="CompetitionResult" value={project.result} />}
        </div>
      </header>
      <ProjectTabs projectId={id} tabs={access.tabs} />
      <div>{props.children}</div>
    </div>
  );
}

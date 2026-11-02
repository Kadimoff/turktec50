import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Workflow } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stageName, STAGE_SELECT } from "@/lib/workflow";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { CreateStageDialog, StageTable, type AdminStage } from "@/components/process/stage-admin";

export async function generateMetadata() {
  const t = await getTranslations("process.admin");
  return { title: t("title") };
}

/** Coordinator / root: configure process stages (add, rename in 3 languages, reorder, deactivate, delete custom). */
export default async function WorkflowAdminPage() {
  await requireUser(["ADMIN"]);
  const locale = await getLocale();
  const [t, rows] = await Promise.all([
    getTranslations("process.admin"),
    prisma.workflowStage.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { ...STAGE_SELECT, _count: { select: { projects: true, applications: true } } },
    }),
  ]);
  const stages: AdminStage[] = rows.map((s) => ({
    id: s.id, scope: s.scope, systemKey: s.systemKey, name: stageName(s, locale),
    nameAz: s.nameAz, nameTr: s.nameTr, nameEn: s.nameEn,
    descriptionAz: s.descriptionAz ?? "", descriptionTr: s.descriptionTr ?? "", descriptionEn: s.descriptionEn ?? "",
    kind: s.kind, roles: s.responsibleRoles, active: s.active,
    count: s.scope === "PROJECT" ? s._count.projects : s._count.applications,
  }));
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          <>
            <Button variant="outline" size="lg" className="h-10" nativeButton={false} render={<Link href="/process" />}><Workflow aria-hidden />{t("openProcess")}</Button>
            <CreateStageDialog stages={stages.filter((s) => s.active)} />
          </>
        }
      />
      <p className="rounded-lg border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">{t("rules")}</p>
      {(["APPLICATION", "PROJECT"] as const).map((scope) => (
        <section key={scope} className="rounded-xl border bg-card shadow-card" aria-labelledby={`wf-admin-${scope}`}>
          <div className="border-b p-5 pb-3">
            <h2 id={`wf-admin-${scope}`} className="text-sm font-semibold">{t(`scopeTitle.${scope}`)}</h2>
            <p className="text-xs text-muted-foreground">{t(`scopeHint.${scope}`)}</p>
          </div>
          <StageTable scope={scope} stages={stages.filter((s) => s.scope === scope)} allStages={stages} />
        </section>
      ))}
    </div>
  );
}

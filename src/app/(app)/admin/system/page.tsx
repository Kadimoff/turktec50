import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Check, Crown, Database, FileInput, FolderX, ShieldAlert, UserCog, X } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { WIPE_PHRASE } from "@/lib/constants";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { DeleteRecordForm, WipeForm } from "@/components/admin/system-forms";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("system") };
}

/** Root-only system console: database overview, role assignment pointer, permanent deletes, full wipe. */
export default async function SystemPage() {
  const user = await requireUser(["ADMIN"]);
  if (!user.isRoot) redirect("/dashboard?denied=1");
  const t = await getTranslations("admin.system");

  const [counts, projects, applications] = await Promise.all([
    Promise.all([
      prisma.user.count(), prisma.application.count(), prisma.project.count(), prisma.task.count(), prisma.mentorSession.count(),
      prisma.document.count(), prisma.risk.count(), prisma.evaluation.count(), prisma.auditLog.count(), prisma.notification.count(),
    ]),
    prisma.project.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, title: true } }),
    prisma.application.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, projectTitle: true, teamName: true } }),
  ]);
  const tables = ["users", "applications", "projects", "tasks", "sessions", "documents", "risks", "evaluations", "audit", "notifications"] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<span className="inline-flex items-center gap-1.5"><Crown className="size-3.5" aria-hidden />{t("eyebrow")}</span>}
        title={t("title")}
        description={t("description")}
      />

      <section aria-labelledby="db-title" className="rounded-xl border bg-card p-5 shadow-card">
        <h2 id="db-title" className="flex items-center gap-2 text-sm font-semibold"><Database className="size-4 text-primary" aria-hidden />{t("db.title")}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("db.subtitle")}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {tables.map((k, i) => (
            <div key={k} className="rounded-lg border bg-background px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">{t(`db.tables.${k}`)}</dt>
              <dd className="tabular text-xl font-bold">{counts[i]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="roles-title" className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="roles-title" className="flex items-center gap-2 text-sm font-semibold"><UserCog className="size-4 text-primary" aria-hidden />{t("roles.title")}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("roles.body")}</p>
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href="/admin/users" />}>{t("roles.open")}</Button>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="del-project" className="rounded-xl border border-danger/30 bg-card p-5 shadow-card">
          <h2 id="del-project" className="flex items-center gap-2 text-sm font-semibold"><FolderX className="size-4 text-danger" aria-hidden />{t("project.title")}</h2>
          <p className="mt-1 mb-4 text-xs text-muted-foreground">{t("project.body")}</p>
          <DeleteRecordForm kind="project" options={projects.map((p) => ({ id: p.id, code: p.code, label: p.title }))} />
        </section>
        <section aria-labelledby="del-app" className="rounded-xl border border-danger/30 bg-card p-5 shadow-card">
          <h2 id="del-app" className="flex items-center gap-2 text-sm font-semibold"><FileInput className="size-4 text-danger" aria-hidden />{t("application.title")}</h2>
          <p className="mt-1 mb-4 text-xs text-muted-foreground">{t("application.body")}</p>
          <DeleteRecordForm kind="application" options={applications.map((a) => ({ id: a.id, code: a.code, label: `${a.projectTitle} · ${a.teamName}` }))} />
        </section>
      </div>

      <section aria-labelledby="wipe-title" className="rounded-xl border-2 border-danger/50 bg-danger-soft/40 p-5">
        <h2 id="wipe-title" className="flex items-center gap-2 text-sm font-semibold text-danger"><ShieldAlert className="size-4" aria-hidden />{t("wipe.title")}</h2>
        <p className="mt-1 max-w-3xl text-sm text-foreground">{t("wipe.body")}</p>
        <ul className="mt-2 mb-4 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <li className="flex items-start gap-1.5"><Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />{t("wipe.keeps")}</li>
          <li className="flex items-start gap-1.5"><X className="mt-0.5 size-3.5 shrink-0 text-danger" aria-hidden />{t("wipe.removes")}</li>
        </ul>
        <div className="max-w-md"><WipeForm phrase={WIPE_PHRASE} /></div>
      </section>

      <p className="text-xs text-muted-foreground">{t("auditNote")}</p>
    </div>
  );
}

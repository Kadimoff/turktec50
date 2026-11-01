import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, Building2, CalendarDays, ClipboardCheck, ChevronLeft, FolderKanban, Lightbulb, Mail, Tag, Target, Trophy, UserRound, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { weightedScore } from "@/lib/kpi";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { EnumBadge } from "@/components/shared/enum-badge";
import { HumanControlNote } from "@/components/shared/notice";
import { UserAvatar } from "@/components/shared/user-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SelectionRubricForm } from "@/components/applications/rubric-form";
import { CreateWorkspaceButton, DecisionForm } from "@/components/applications/decision-panel";

export async function generateMetadata(props: PageProps<"/applications/[id]">) {
  const { id } = await props.params;
  const app = await prisma.application.findUnique({ where: { id }, select: { code: true, projectTitle: true } });
  return { title: app ? `${app.code} · ${app.projectTitle}` : undefined };
}

export default async function ApplicationDetailPage(props: PageProps<"/applications/[id]">) {
  const user = await requireUser(["ADMIN", "JURY"]);
  const isAdmin = user.role === "ADMIN";
  const { id } = await props.params;
  const locale = await getLocale();

  const [app, rubric, submittedCount] = await Promise.all([
    prisma.application.findUnique({
      where: { id },
      include: {
        university: { select: { name: true, shortName: true, city: true, country: true } },
        competition: { select: { name: true, organizer: true, applicationDeadline: true } },
        project: { select: { id: true, code: true, title: true } },
        evaluations: {
          where: isAdmin ? {} : { evaluatorId: user.id },
          orderBy: { submittedAt: "asc" },
          include: { evaluator: { select: { id: true, name: true, title: true } }, scores: { select: { criterionId: true, score: true } } },
        },
      },
    }),
    prisma.rubric.findUnique({
      where: { kind: "SELECTION" },
      select: { criteria: { orderBy: { order: "asc" }, select: { id: true, key: true, weight: true, maxScore: true } } },
    }),
    prisma.evaluation.count({ where: { applicationId: id, status: "SUBMITTED" } }),
  ]);
  if (!app || !rubric) notFound();

  const [t, tc, tj] = await Promise.all([getTranslations("applications"), getTranslations("common"), getTranslations("jury")]);
  const criteria = rubric.criteria;
  const mine = app.evaluations.find((e) => e.evaluatorId === user.id);
  const submitted = app.evaluations.filter((e) => e.status === "SUBMITTED");
  const drafts = app.evaluations.filter((e) => e.status === "DRAFT" && e.evaluatorId !== user.id).length;
  const scoreMap = (e: (typeof submitted)[number]) => Object.fromEntries(e.scores.map((s) => [s.criterionId, s.score]));
  const totals = submitted.map((e) => weightedScore(criteria, scoreMap(e)));
  const avgTotal = totals.length ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10 : null;
  const critAvg = (cid: string) => {
    const vals = submitted.map((e) => e.scores.find((s) => s.criterionId === cid)?.score).filter((v): v is number => typeof v === "number");
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "—";
  };

  return (
    <div className="space-y-6">
      <Link href="/applications" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground no-print">
        <ChevronLeft className="size-3.5" aria-hidden />
        {t("title")}
      </Link>
      <PageHeader
        eyebrow={<span className="font-mono">{app.code}</span>}
        title={app.projectTitle}
        description={app.teamName}
        actions={<EnumBadge enumName="ApplicationStatus" value={app.status} />}
      />
      <HumanControlNote />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* application content */}
          <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby="app-content">
            <h2 id="app-content" className="text-sm font-semibold">{t("detail.content")}</h2>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <div>
                <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground">
                  <Target className="size-3.5" aria-hidden />
                  {t("detail.problem")}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-pretty">{app.problem}</p>
              </div>
              <div>
                <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground">
                  <Lightbulb className="size-3.5" aria-hidden />
                  {t("detail.solution")}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-pretty">{app.solution}</p>
              </div>
            </div>
          </section>

          {/* rubric */}
          <section className="rounded-xl border bg-card p-4 shadow-card sm:p-5" aria-labelledby="rubric-title">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 id="rubric-title" className="text-sm font-semibold">{t("rubric.title")}</h2>
                <p className="text-xs text-muted-foreground">{t("rubric.subtitle")}</p>
              </div>
              {mine && <EnumBadge enumName="EvaluationStatus" value={mine.status} />}
            </div>
            <div className="mt-4">
              <SelectionRubricForm
                applicationId={app.id}
                criteria={criteria}
                initial={{
                  scores: Object.fromEntries((mine?.scores ?? []).map((s) => [s.criterionId, s.score])),
                  comment: mine?.comment ?? "",
                  status: mine?.status ?? null,
                }}
                submittedAtLabel={mine?.submittedAt ? fmtDateTime(mine.submittedAt, locale) : undefined}
              />
            </div>
          </section>

          {/* admin: all evaluators */}
          {isAdmin && (
            <section className="rounded-xl border bg-card shadow-card" aria-labelledby="all-evals">
              <div className="flex flex-wrap items-start justify-between gap-2 p-5 pb-3">
                <div>
                  <h2 id="all-evals" className="text-sm font-semibold">{t("panel.title")}</h2>
                  <p className="text-xs text-muted-foreground">
                    {t("panel.subtitle", { count: submitted.length })}
                    {drafts > 0 && ` · ${t("panel.drafts", { count: drafts })}`}
                  </p>
                </div>
                {avgTotal !== null && (
                  <p className="text-right">
                    <span className="block text-xs text-muted-foreground">{t("panel.average")}</span>
                    <span className="tabular text-xl font-bold">{avgTotal}</span>
                    <span className="text-xs text-muted-foreground"> / 100</span>
                  </p>
                )}
              </div>
              {submitted.length === 0 ? (
                <div className="px-5 pb-5">
                  <EmptyState title={t("panel.empty")} description={t("panel.emptyHint")} className="py-8" />
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-5 text-xs font-semibold text-muted-foreground">{t("panel.criterion")}</TableHead>
                        {submitted.map((e) => (
                          <TableHead key={e.id} className="text-right text-xs font-semibold text-muted-foreground">
                            <span className="inline-block max-w-32 truncate align-bottom" title={e.evaluator.name}>{e.evaluator.name}</span>
                          </TableHead>
                        ))}
                        <TableHead className="pr-5 text-right text-xs font-semibold text-muted-foreground">{t("panel.avg")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {criteria.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="pl-5">
                            <span className="text-sm">{tj(`criteria.${c.key}.title`)}</span>
                            <span className="tabular ml-1.5 text-xs text-muted-foreground">{c.weight}%</span>
                          </TableCell>
                          {submitted.map((e) => (
                            <TableCell key={e.id} className="tabular text-right text-sm">
                              {e.scores.find((s) => s.criterionId === c.id)?.score ?? "—"}
                            </TableCell>
                          ))}
                          <TableCell className="tabular pr-5 text-right text-sm font-semibold">{critAvg(c.id)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="hover:bg-transparent">
                        <TableCell className="pl-5 text-sm font-semibold">{t("panel.weighted")}</TableCell>
                        {totals.map((v, i) => (
                          <TableCell key={i} className="tabular text-right text-sm font-semibold">{v}</TableCell>
                        ))}
                        <TableCell className="tabular pr-5 text-right text-sm font-bold">{avgTotal}</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                  <ul className="divide-y border-t">
                    {submitted.map((e) => (
                      <li key={e.id} className="flex gap-3 px-5 py-3">
                        <UserAvatar name={e.evaluator.name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                            <span className="font-semibold">{e.evaluator.name}</span>
                            <span className="text-xs text-muted-foreground">{e.evaluator.title}</span>
                            <span className="text-xs text-muted-foreground">· {fmtDate(e.submittedAt, locale)}</span>
                          </p>
                          <p className="mt-0.5 text-sm text-pretty text-muted-foreground">{e.comment || t("panel.noComment")}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
        </div>

        {/* side column */}
        <aside className="space-y-6">
          <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby="facts">
            <h2 id="facts" className="text-sm font-semibold">{t("detail.facts")}</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <Fact icon={Tag} label={t("detail.category")} value={tc(`categories.${app.category}` as never)} />
              <Fact icon={Building2} label={t("detail.university")} value={`${app.university.name} (${app.university.shortName})`} sub={`${app.university.city} · ${tc(`countries.${app.university.country}` as never)}`} />
              <Fact icon={Trophy} label={t("detail.competition")} value={app.competition?.name ?? "—"} sub={app.competition ? `${app.competition.organizer} · ${t("detail.deadline", { date: fmtDate(app.competition.applicationDeadline, locale) })}` : undefined} />
              <Fact icon={Users} label={t("detail.teamSize")} value={tc("members", { count: app.memberCount })} />
              <Fact icon={CalendarDays} label={t("detail.submittedAt")} value={fmtDate(app.submittedAt, locale)} />
              <Fact icon={ClipboardCheck} label={t("detail.evaluations")} value={t("detail.evaluationsValue", { count: submittedCount })} />
            </dl>
            {isAdmin && (
              <div className="mt-4 rounded-lg border border-dashed p-3">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground">{t("detail.contact")}</p>
                <p className="mt-1.5 flex items-center gap-2 text-sm"><UserRound className="size-4 text-muted-foreground" aria-hidden />{app.contactName}</p>
                <p className="mt-1 flex items-center gap-2 text-sm break-all">
                  <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <a href={`mailto:${app.contactEmail}`} className="text-primary hover:underline">{app.contactEmail}</a>
                </p>
                <p className="mt-2 text-xs text-muted-foreground">{t("detail.contactNote")}</p>
              </div>
            )}
          </section>

          {isAdmin && (
            <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby="decision">
              <h2 id="decision" className="text-sm font-semibold">{t("decision.title")}</h2>
              <p className="text-xs text-muted-foreground">{t("decision.subtitle")}</p>
              {app.decidedAt && (
                <div className="mt-3 rounded-lg bg-muted/60 p-3 text-sm">
                  <p className="flex flex-wrap items-center gap-2">
                    <EnumBadge enumName="ApplicationStatus" value={app.status} />
                    <span className="text-xs text-muted-foreground">{fmtDateTime(app.decidedAt, locale)}</span>
                  </p>
                  {app.decisionNote && <p className="mt-2 text-pretty text-muted-foreground">{app.decisionNote}</p>}
                </div>
              )}
              <div className="mt-4">
                {app.project ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">{t("decision.lockedByProject")}</p>
                    <Button variant="outline" className="h-10 w-full" nativeButton={false} render={<Link href={`/projects/${app.project.id}`} />}>
                      <FolderKanban aria-hidden />
                      {t("workspace.open", { code: app.project.code })}
                      <ArrowRight aria-hidden />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <DecisionForm applicationId={app.id} current={app.status} note={app.decisionNote} />
                    {app.status === "ACCEPTED" && (
                      <div className="space-y-2 border-t pt-4">
                        <p className="text-sm font-semibold">{t("workspace.title")}</p>
                        <p className="text-xs text-muted-foreground">{t("workspace.hint")}</p>
                        <CreateWorkspaceButton applicationId={app.id} contactEmail={app.contactEmail} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {!isAdmin && app.project && (
            <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground shadow-card">
              {t("detail.hasProject", { code: app.project.code })}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function Fact({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
  return (
    <div className="flex gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="font-medium text-pretty">{value}</dd>
        {sub && <dd className="text-xs text-muted-foreground">{sub}</dd>}
      </div>
    </div>
  );
}

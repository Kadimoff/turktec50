import { getLocale, getTranslations } from "next-intl/server";
import { Clock, Download, FileSpreadsheet, Handshake, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PROGRAM } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { DemoNote } from "@/components/shared/notice";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Panel } from "@/components/dashboard/parts";
import { getKpiReport } from "@/components/kpi/data";
import { KpiFunnel } from "@/components/kpi/funnel";
import { BarList } from "@/components/kpi/bar-list";
import { WeekChart } from "@/components/kpi/week-chart";
import { PrintButton } from "@/components/kpi/print-button";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("kpi") };
}

const DEFINITIONS = ["applicationsEvaluated", "teamsAccepted", "prototypes", "qcPackages", "finalists", "mentoringHours", "taskCompletion", "turkicReach"] as const;

export default async function KpiPage() {
  await requireUser(["ADMIN"]);
  const [t, tc, te, locale, r] = await Promise.all([
    getTranslations("kpi"),
    getTranslations("common"),
    getTranslations("enums"),
    getLocale(),
    getKpiReport(),
  ]);
  const now = new Date();
  const T = r.kpis.targets;
  const taskPct = r.tasksTotal ? Math.round((r.tasksDone / r.tasksTotal) * 100) : 0;
  const targetFor: Record<(typeof DEFINITIONS)[number], string> = {
    applicationsEvaluated: String(T.applicationsEvaluated),
    teamsAccepted: String(T.teamsAccepted),
    prototypes: String(T.prototypes),
    qcPackages: String(T.qcPackages),
    finalists: `${T.finalists} / ${T.finalistsScale}`,
    mentoringHours: "—",
    taskCompletion: "—",
    turkicReach: "—",
  };

  const eyebrow = [r.currentWeek > 0 ? tc("week", { current: r.currentWeek, total: PROGRAM.incubationWeeks }) : null, t("snapshot", { date: fmtDateTime(now, locale) })]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="kpi-report space-y-6">
      <style>{`@media print {
  [data-slot="sidebar-gap"], [data-slot="sidebar-container"], header.sticky { display: none !important; }
  [data-slot="sidebar-inset"] { margin: 0 !important; background: white !important; }
  .kpi-report section, .kpi-report [data-print-block] { break-inside: avoid; box-shadow: none !important; }
  html, body, [data-slot="sidebar-wrapper"] { background: white !important; }
  @page { size: A4; margin: 14mm; }
}`}</style>
      <div className="hidden border-b pb-3 print:block">
        <p className="text-xs font-semibold">{tc("appName")} · {tc("university")}</p>
        <p className="text-lg font-bold">{t("printTitle")}</p>
      </div>
      <PageHeader
        eyebrow={eyebrow}
        title={t("title")}
        description={t("description")}
        actions={
          <>
            <a href="/kpi/export?type=projects" download className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-3")}>
              <FileSpreadsheet aria-hidden />
              {t("export.projects")}
            </a>
            <a href="/kpi/export?type=kpi" download className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-3")}>
              <Download aria-hidden />
              {t("export.kpi")}
            </a>
            <PrintButton label={t("print")} />
          </>
        }
      />

      <Panel id="funnel" title={t("funnel.title")} subtitle={t("funnel.subtitle")}>
        <KpiFunnel steps={r.funnel} />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel id="by-stage" title={t("charts.stage")} subtitle={t("charts.stageSub", { count: r.kpis.teamsAccepted })}>
          <BarList
            label={t("charts.stage")}
            total={r.kpis.teamsAccepted}
            items={r.stages.map((s) => ({
              key: s.key,
              label: te(`ProjectStage.${s.key}`),
              value: s.value,
              href: `/projects?stage=${s.key}`,
              title: `${te(`ProjectStage.${s.key}`)}: ${s.value}`,
            }))}
          />
        </Panel>

        <Panel id="turkic" title={t("charts.turkic")} subtitle={t("charts.turkicSub", { unis: r.partnerUniversities, countries: r.partnerCountries })}>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground">{t("charts.byCountry")}</h3>
              <BarList
                label={t("charts.byCountry")}
                items={r.countries.map((c) => ({
                  key: c.key,
                  label: tc.has(`countries.${c.key}` as never) ? tc(`countries.${c.key}` as never) : c.key,
                  value: c.value,
                  title: `${c.key}: ${c.value}`,
                }))}
              />
            </div>
            <div>
              <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground">{t("charts.byUniversity")}</h3>
              <BarList
                label={t("charts.byUniversity")}
                items={r.universities.slice(0, 7).map((u) => ({
                  key: u.key,
                  label: u.shortName,
                  sub: u.country,
                  value: u.value,
                  title: `${u.name} (${u.country}): ${u.value}`,
                }))}
                total={r.kpis.teamsAccepted}
              />
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel id="completion" title={t("charts.completion")} subtitle={t("charts.completionSub", { done: r.tasksDone, total: r.tasksTotal, pct: taskPct })}>
          <WeekChart
            data={r.completion}
            weekLabel={t("charts.weekPrefix")}
            valueLabel={t("charts.completedTasks")}
            currentLabel={t("charts.currentWeek")}
            tableLabel={t("charts.showTable")}
          />
          <p className="mt-1 text-xs text-muted-foreground">{t("charts.weekNote")}</p>
        </Panel>

        <Panel id="mentoring" title={t("charts.mentoring")} subtitle={t("charts.mentoringSub")}>
          <dl className="mb-3 grid grid-cols-3 gap-3">
            {[
              { k: "hours", v: r.mentoringHours, icon: Clock },
              { k: "sessions", v: r.sessionsCompleted, icon: Handshake },
              { k: "projects", v: `${r.projectsMentored}/${r.kpis.teamsAccepted}`, icon: Users },
            ].map(({ k, v, icon: Icon }) => (
              <div key={k} className="rounded-lg border px-3 py-2">
                <dt className="flex items-start gap-1.5 text-xs leading-tight text-muted-foreground">
                  <Icon className="mt-px hidden size-3.5 shrink-0 sm:block" aria-hidden />
                  <span>{t(`mentoring.${k}`)}</span>
                </dt>
                <dd className="mt-0.5 text-lg font-bold">{v}</dd>
              </div>
            ))}
          </dl>
          <WeekChart
            data={r.mentoring}
            weekLabel={t("charts.weekPrefix")}
            valueLabel={t("mentoring.hoursPerWeek")}
            currentLabel={t("charts.currentWeek")}
            tableLabel={t("charts.showTable")}
            unit={t("mentoring.hUnit")}
            color="var(--chart-2)"
          />
          <p className="mt-1 text-xs text-muted-foreground">{t("charts.weekNote")}</p>
        </Panel>
      </div>

      <Panel id="by-category" title={t("charts.category")} subtitle={t("charts.categorySub", { count: r.categories.length })}>
        <BarList
          className="grid gap-x-10 md:grid-cols-2 md:space-y-0"
          label={t("charts.category")}
          total={r.kpis.teamsAccepted}
          items={r.categories.map((c) => ({
            key: c.key,
            label: tc(`categories.${c.key}` as never),
            value: c.value,
            href: `/projects?category=${c.key}`,
            title: `${tc(`categories.${c.key}` as never)}: ${c.value}`,
          }))}
        />
      </Panel>

      <Panel id="definitions" title={t("definitions.title")} subtitle={t("definitions.subtitle")} bodyClassName="px-0 pb-2 sm:px-0">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-48 pl-5 text-xs font-semibold text-muted-foreground">{t("definitions.indicator")}</TableHead>
              <TableHead className="w-20 text-right text-xs font-semibold text-muted-foreground">{tc("target")}</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">{t("definitions.definition")}</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">{t("definitions.evidence")}</TableHead>
              <TableHead className="w-32 pr-5 text-xs font-semibold text-muted-foreground">{t("definitions.frequency")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {DEFINITIONS.map((k) => (
              <TableRow key={k} className="align-top">
                <TableCell className="pl-5 font-medium whitespace-normal">{t(`definitions.rows.${k}.name`)}</TableCell>
                <TableCell className="tabular text-right font-semibold">{targetFor[k]}</TableCell>
                <TableCell className="text-sm whitespace-normal text-muted-foreground">{t(`definitions.rows.${k}.definition`)}</TableCell>
                <TableCell className="text-sm whitespace-normal text-muted-foreground">{t(`definitions.rows.${k}.evidence`)}</TableCell>
                <TableCell className="pr-5 text-sm whitespace-normal">{t(`definitions.rows.${k}.frequency`)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{t("footnote")}</p>
        <DemoNote />
      </div>
    </div>
  );
}

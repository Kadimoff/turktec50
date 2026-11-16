import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, CalendarClock, CheckCircle2, Columns3, ListChecks, ListTodo, Rows3 } from "lucide-react";
import { prisma } from "@/lib/db";
import { currentWeek } from "@/lib/constants";
import type { CurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { buildHref, one, type SearchParams } from "@/lib/search-params";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TaskProvider } from "./task-context";
import { NewTaskButton } from "./task-dialog";
import { TaskFilters } from "./task-filters";
import { TaskBoard } from "./task-board";
import { TaskTable } from "./task-table";
import { TaskWeekView } from "./task-week-view";
import {
  baseTaskWhere, fullTaskWhere, getBoardData, getTablePage, getTaskFormProjects, getTaskStats, parseTaskFilters, parseView,
  PAGE_SIZE, taskSelect, toTaskItem, type TaskView,
} from "./queries";
import { TASK_STATUSES } from "./types";
import type { TaskStatus } from "@/generated/prisma/enums";

/**
 * Shared tasks workspace used by /tasks and /projects/[id]/tasks:
 * stat row, filters, view toggle (board / table / week) and the selected view.
 */
export async function TaskWorkspace({
  user,
  searchParams,
  projectId,
  basePath,
  heading,
}: {
  user: CurrentUser;
  searchParams: SearchParams;
  /** fixed project (project tab) */
  projectId?: string;
  basePath: string;
  heading: { kind: "page" | "section"; eyebrow?: string; title: string; description?: string };
}) {
  const [t, locale] = await Promise.all([getTranslations("tasks"), getLocale()]);
  const now = new Date();
  const filters = parseTaskFilters(searchParams);
  const defaultView: TaskView = projectId ? "board" : user.role === "ADMIN" ? "table" : "board";
  const view = parseView(searchParams, defaultView, !!projectId);

  const formProjects = await getTaskFormProjects(user, projectId);
  const contextProjectId = projectId ?? filters.project ?? (formProjects.length === 1 ? formProjects[0]!.id : undefined);
  const contextProject = formProjects.find((p) => p.id === contextProjectId);
  // a member filter belongs to one project: drop it when that member is not offered (e.g. after the project changed)
  if (filters.assignee && filters.assignee !== "mine" && filters.assignee !== "none" && !contextProject?.members.some((m) => m.id === filters.assignee)) {
    filters.assignee = undefined;
  }
  const canCreate = user.role !== "JURY" && formProjects.length > 0;

  const base = baseTaskWhere(user, filters, projectId);
  const where = fullTaskWhere(base, filters, now);
  const stats = await getTaskStats(base, now);

  const params: Record<string, string | undefined> = Object.fromEntries(Object.entries(searchParams).map(([k, v]) => [k, one(v)]));
  const href = (patch: Record<string, string | number | null>) =>
    buildHref(basePath, params, Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === null ? undefined : String(v)])));

  const hasFilters = !!(filters.status || filters.priority || filters.due || filters.q || filters.assignee || (!projectId && filters.project));

  let body: React.ReactNode;
  if (view === "board") {
    const cap = user.role === "ADMIN" && !contextProjectId ? 30 : 200;
    const { counts, columns } = await getBoardData(where, cap);
    const items = TASK_STATUSES.flatMap((s) => columns[s].map((r) => toTaskItem(r, user, locale, now)));
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const capped = TASK_STATUSES.some((s) => counts[s] > columns[s].length);
    body =
      total === 0 ? (
        <Empty filtered={hasFilters} resetHref={href({ status: null, priority: null, due: null, q: null, assignee: null, project: null })} />
      ) : (
        <TaskBoard
          items={items}
          counts={counts}
          tableHrefs={capped ? (Object.fromEntries(TASK_STATUSES.map((s) => [s, href({ view: "table", status: s, page: null })])) as Record<TaskStatus, string>) : undefined}
        />
      );
  } else if (view === "table") {
    const { rows, total, page } = await getTablePage(where, filters.page);
    const items = rows.map((r) => toTaskItem(r, user, locale, now));
    body =
      total === 0 ? (
        <Empty filtered={hasFilters} resetHref={href({ status: null, priority: null, due: null, q: null, assignee: null, project: null, page: null })} />
      ) : (
        <div className="space-y-3">
          <TaskTable items={items} caption={t("table.caption")} />
          <Pagination basePath={basePath} params={params} page={page} pageSize={PAGE_SIZE} total={total} />
        </div>
      );
  } else {
    const rows = await prisma.task.findMany({ where, select: taskSelect, orderBy: [{ week: "asc" }, { dueDate: "asc" }], take: 400 });
    body =
      rows.length === 0 ? (
        <Empty filtered={hasFilters} resetHref={href({ status: null, priority: null, due: null, q: null, assignee: null })} />
      ) : (
        <TaskWeekView items={rows.map((r) => toTaskItem(r, user, locale, now))} />
      );
  }

  const views: { key: TaskView; icon: typeof Columns3 }[] = [
    { key: "board", icon: Columns3 },
    { key: "table", icon: Rows3 },
    ...(projectId ? [{ key: "week" as const, icon: ListChecks }] : []),
  ];

  const newButton = <NewTaskButton projectId={contextProjectId} />;
  const showProjectFilter = !projectId && formProjects.length > 1;

  return (
    <TaskProvider value={{ projects: formProjects, canCreate, currentWeek: currentWeek(now), showProject: !projectId }}>
      <div className="space-y-6">
        {heading.kind === "page" ? (
          <PageHeader eyebrow={heading.eyebrow} title={heading.title} description={heading.description} actions={newButton} />
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{heading.title}</h2>
              {heading.description && <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">{heading.description}</p>}
            </div>
            {newButton}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard label={t("stats.open")} value={stats.open} icon={ListTodo} tone="brand" hint={t("stats.openHint")} />
          <StatCard label={t("stats.dueWeek")} value={stats.dueWeek} icon={CalendarClock} tone="warning" hint={t("stats.dueWeekHint")} />
          <StatCard label={t("stats.overdue")} value={stats.overdue} icon={AlertTriangle} tone={stats.overdue > 0 ? "danger" : "success"} hint={t("stats.overdueHint")} />
          <StatCard label={t("stats.doneWeek")} value={stats.doneWeek} icon={CheckCircle2} tone="success" hint={t("stats.doneWeekHint")} />
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <nav aria-label={t("views.label")} className="inline-flex w-fit rounded-lg border bg-card p-0.5 shadow-xs">
              {views.map(({ key, icon: Icon }) => (
                <Link
                  key={key}
                  href={href({ view: key, page: null })}
                  aria-current={view === key ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    view === key && "bg-accent text-accent-foreground hover:text-accent-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {t(`views.${key}`)}
                </Link>
              ))}
            </nav>
            {view === "board" && <p className="hidden text-xs text-muted-foreground lg:block">{t("board.dragHint")}</p>}
          </div>
          <TaskFilters
            action={basePath}
            values={{ project: projectId ? undefined : filters.project, assignee: filters.assignee, status: filters.status, priority: filters.priority, due: filters.due, q: filters.q }}
            view={params.view}
            projects={showProjectFilter ? formProjects.map((p) => ({ id: p.id, label: `${p.code} · ${p.title}` })) : undefined}
            members={contextProject?.members.map((m) => ({ id: m.id, label: m.name }))}
            showMine={user.role === "TEAM"}
          />
        </div>

        {body}
      </div>
    </TaskProvider>
  );
}

async function Empty({ filtered, resetHref }: { filtered: boolean; resetHref: string }) {
  const t = await getTranslations("tasks.empty");
  return filtered ? (
    <EmptyState
      icon={ListTodo}
      title={t("filtered")}
      description={t("filteredDescription")}
      action={
        <Button variant="outline" size="lg" nativeButton={false} render={<Link href={resetHref} />}>
          {t("reset")}
        </Button>
      }
    />
  ) : (
    <EmptyState icon={ListTodo} title={t("title")} description={t("description")} />
  );
}

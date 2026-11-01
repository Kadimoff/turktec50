"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  CalendarClock, Check, CheckCircle2, ClipboardList, Clock, Loader2, ListPlus, MapPin, MoreHorizontal, NotebookPen, Pencil,
  Video, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ToneBadge } from "@/components/shared/tone-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { sessionTone, taskStatusTone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { cancelSession, confirmSession, convertStep } from "@/app/(app)/mentors/actions";
import { AgendaDialog, CompleteSessionDialog, RescheduleDialog } from "./session-dialogs";
import type { SessionItem, SessionStep } from "./types";

export function SessionStatusBadge({ session }: { session: SessionItem }) {
  const t = useTranslations("mentors");
  const te = useTranslations("enums");
  if (session.needsNotes) return <ToneBadge tone="danger">{t("session.awaitingNotes")}</ToneBadge>;
  return <ToneBadge tone={sessionTone[session.status]}>{te(`SessionStatus.${session.status}`)}</ToneBadge>;
}

/** Date tile: weekday / day / month + time. */
export function DateTile({ session, className }: { session: SessionItem; className?: string }) {
  return (
    <div
      className={cn(
        "flex w-14 shrink-0 flex-col items-center rounded-lg border bg-background py-1.5 text-center",
        session.status === "CANCELLED" && "opacity-60",
        className,
      )}
      aria-hidden
    >
      <span className="text-[10px] font-semibold text-muted-foreground">{session.weekday}</span>
      <span className="tabular text-lg leading-tight font-bold">{session.day}</span>
      <span className="text-[11px] font-medium text-muted-foreground">{session.month}</span>
      <span className="tabular mt-0.5 border-t px-1 pt-0.5 text-[11px] font-semibold text-primary">{session.time}</span>
    </div>
  );
}

function Meta({ session, showProject, showMentor }: { session: SessionItem; showProject: boolean; showMentor: boolean }) {
  const t = useTranslations("mentors");
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span className="sr-only">{session.whenAbs}</span>
      {showProject && (
        <Link href={`/projects/${session.projectId}/sessions`} className="font-mono font-semibold text-primary hover:underline" title={session.projectTitle}>
          {session.projectCode}
          <span className="font-sans font-normal text-muted-foreground"> · {session.projectTitle}</span>
        </Link>
      )}
      {showMentor && (
        <span className="inline-flex items-center gap-1.5">
          <UserAvatar name={session.mentor.name} size="sm" className="size-5 text-[9px]" />
          <span aria-hidden>{session.mentor.name}</span>
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <Clock className="size-3.5" aria-hidden />
        {t("session.duration", { min: session.durationMin })}
      </span>
      <span className="inline-flex items-center gap-1">
        {session.online ? <Video className="size-3.5" aria-hidden /> : <MapPin className="size-3.5" aria-hidden />}
        {session.online ? t("session.online") : t("session.inPerson")}
      </span>
      <span className="inline-flex items-center gap-1">
        <CalendarClock className="size-3.5" aria-hidden />
        {session.whenRel}
      </span>
    </p>
  );
}

/** Confirm / reschedule / record notes / cancel — inline buttons (primary) + overflow menu. */
export function SessionActions({ session, compact }: { session: SessionItem; compact?: boolean }) {
  const t = useTranslations("mentors");
  const tc = useTranslations("common");
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<null | "complete" | "reschedule" | "agenda" | "cancel">(null);
  const { can } = session;
  if (!can.confirm && !can.reschedule && !can.cancel && !can.complete && !can.editAgenda) return null;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(ok);
        setDialog(null);
      } else toast.error(t(r.error ?? "errors.generic"));
    });

  const primary = can.complete ? "complete" : can.confirm ? "confirm" : !compact && can.editAgenda && !session.agenda ? "agenda" : null;
  const menuItems = [
    can.confirm && primary !== "confirm" && "confirm",
    can.editAgenda && primary !== "agenda" && "agenda",
    can.reschedule && "reschedule",
    can.cancel && "cancel",
  ].filter(Boolean) as ("confirm" | "agenda" | "reschedule" | "cancel")[];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {primary === "complete" && (
        <Button size={compact ? "sm" : "default"} onClick={() => setDialog("complete")}>
          <NotebookPen aria-hidden />
          {t("actions.complete")}
        </Button>
      )}
      {primary === "confirm" && (
        <Button size={compact ? "sm" : "default"} disabled={pending} onClick={() => run(() => confirmSession(session.id), t("toast.confirmed"))}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
          {t("actions.confirm")}
        </Button>
      )}
      {primary === "agenda" && (
        <Button size={compact ? "sm" : "default"} variant="outline" onClick={() => setDialog("agenda")}>
          <ClipboardList aria-hidden />
          {t("actions.addAgenda")}
        </Button>
      )}
      {menuItems.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon-sm" className="size-8 text-muted-foreground" aria-label={t("actions.more", { topic: session.topic })} disabled={pending} />}
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MoreHorizontal className="size-4" aria-hidden />}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {menuItems.includes("confirm") && (
              <DropdownMenuItem onClick={() => run(() => confirmSession(session.id), t("toast.confirmed"))}>
                <Check aria-hidden />
                {t("actions.confirm")}
              </DropdownMenuItem>
            )}
            {menuItems.includes("agenda") && (
              <DropdownMenuItem onClick={() => setDialog("agenda")}>
                <Pencil aria-hidden />
                {session.agenda ? t("actions.editAgenda") : t("actions.addAgenda")}
              </DropdownMenuItem>
            )}
            {menuItems.includes("reschedule") && (
              <DropdownMenuItem onClick={() => setDialog("reschedule")}>
                <CalendarClock aria-hidden />
                {t("actions.reschedule")}
              </DropdownMenuItem>
            )}
            {menuItems.includes("cancel") && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setDialog("cancel")}>
                  <XCircle aria-hidden />
                  {t("actions.cancel")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {can.complete && <CompleteSessionDialog session={session} open={dialog === "complete"} onOpenChange={(o) => setDialog(o ? "complete" : null)} />}
      {can.reschedule && <RescheduleDialog session={session} open={dialog === "reschedule"} onOpenChange={(o) => setDialog(o ? "reschedule" : null)} />}
      {can.editAgenda && <AgendaDialog session={session} open={dialog === "agenda"} onOpenChange={(o) => setDialog(o ? "agenda" : null)} />}
      {can.cancel && (
        <AlertDialog open={dialog === "cancel"} onOpenChange={(o) => setDialog(o ? "cancel" : null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("cancel.title")}</AlertDialogTitle>
              <AlertDialogDescription>{t("cancel.description", { topic: session.topic, when: session.whenAbs })}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tc("actions.back")}</AlertDialogCancel>
              <Button variant="destructive" disabled={pending} aria-busy={pending} onClick={() => run(() => cancelSession(session.id), t("toast.cancelled"))}>
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {t("cancel.confirm")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

function StepRow({ session, step }: { session: SessionItem; step: SessionStep }) {
  const t = useTranslations("mentors");
  const te = useTranslations("enums");
  const [pending, start] = useTransition();
  const convert = () =>
    start(async () => {
      const r = await convertStep(session.id, step.index);
      if (r.ok) toast.success(t("toast.converted"));
      else toast.error(t(r.error ?? "errors.generic"));
    });
  const taskHref = `/projects/${session.projectId}/tasks?view=table&q=${encodeURIComponent(step.text.slice(0, 60))}`;
  return (
    <li className="flex flex-col gap-2 rounded-lg border bg-background px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex min-w-0 items-start gap-2 text-sm">
        <span aria-hidden className="tabular mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
          {step.index + 1}
        </span>
        <span className="text-pretty">{step.text}</span>
      </p>
      {step.task ? (
        <Link
          href={taskHref}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-md px-1 py-1 text-xs font-medium text-success hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:self-auto"
        >
          <CheckCircle2 className="size-3.5" aria-hidden />
          {t("session.converted")}
          <ToneBadge tone={taskStatusTone[step.task.status]} className="ml-0.5">
            {te(`TaskStatus.${step.task.status}`)}
          </ToneBadge>
          <span className="sr-only">— {t("session.viewTask")}</span>
        </Link>
      ) : session.can.convert ? (
        <Button size="sm" variant="outline" className="h-8 shrink-0 self-start sm:self-auto" disabled={pending} aria-busy={pending} onClick={convert}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <ListPlus aria-hidden />}
          {pending ? t("session.converting") : t("session.convert")}
          <span className="sr-only">: {step.text}</span>
        </Button>
      ) : null}
    </li>
  );
}

/** Full session card: before (agenda) → after (mentor notes) → follow-up (next steps → tasks). */
export function SessionCard({
  session,
  showProject = true,
  showMentor = true,
  defaultExpanded = true,
}: {
  session: SessionItem;
  showProject?: boolean;
  showMentor?: boolean;
  defaultExpanded?: boolean;
}) {
  const t = useTranslations("mentors");
  const done = session.status === "COMPLETED";
  return (
    <article
      id={`session-${session.id}`}
      aria-labelledby={`session-${session.id}-title`}
      className={cn(
        "scroll-mt-20 rounded-xl border bg-card p-4 shadow-card target:ring-2 target:ring-primary/50",
        session.needsNotes && "border-l-2 border-l-danger",
        session.status === "CANCELLED" && "bg-card/60",
      )}
    >
      <div className="flex gap-3 sm:gap-4">
        <DateTile session={session} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 id={`session-${session.id}-title`} className={cn("text-sm font-semibold text-pretty sm:text-[15px]", session.status === "CANCELLED" && "text-muted-foreground line-through")}>
              {session.topic}
            </h3>
            <SessionStatusBadge session={session} />
          </div>
          <Meta session={session} showProject={showProject} showMentor={showMentor} />
        </div>
      </div>

      {(session.agenda || done || session.can.editAgenda) && (
        <div className={cn("mt-3 grid gap-3", done && defaultExpanded && "lg:grid-cols-2")}>
          <Block icon={ClipboardList} title={t("session.agenda")} subtitle={t("session.agendaWho")}>
            {session.agenda ? (
              <p className="whitespace-pre-line text-muted-foreground">{session.agenda}</p>
            ) : (
              <p className="text-muted-foreground italic">{t("session.noAgenda")}</p>
            )}
          </Block>
          {done && defaultExpanded && (
            <Block icon={NotebookPen} title={t("session.notes")} subtitle={t("session.notesWho", { name: session.mentor.name })}>
              <p className="whitespace-pre-line text-muted-foreground">{session.notes || "—"}</p>
            </Block>
          )}
        </div>
      )}

      {done && defaultExpanded && (
        <div className="mt-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <ListPlus className="size-3.5 text-primary" aria-hidden />
            {t("session.nextSteps")}
          </p>
          {session.steps.length > 0 ? (
            <ul className="grid gap-1.5">
              {session.steps.map((s) => (
                <StepRow key={s.index} session={session} step={s} />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground italic">{t("session.noSteps")}</p>
          )}
        </div>
      )}

      {(session.can.complete || session.can.confirm || session.can.reschedule || session.can.cancel || session.can.editAgenda) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          {session.needsNotes ? <p className="text-xs font-medium text-danger">{t("session.needsNotesHint")}</p> : <span />}
          <SessionActions session={session} />
        </div>
      )}
    </article>
  );
}

function Block({ icon: Icon, title, subtitle, children }: { icon: typeof ClipboardList; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold">
        <Icon className="size-3.5 text-primary" aria-hidden />
        {title}
        <span className="font-normal text-muted-foreground">· {subtitle}</span>
      </h4>
      <div className="mt-1">{children}</div>
    </section>
  );
}

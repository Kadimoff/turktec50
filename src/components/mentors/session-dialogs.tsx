"use client";
import { useActionState, useId, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { addDays, format, setHours, setMinutes, startOfDay } from "date-fns";
import { CalendarPlus, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Field, NativeSelect } from "@/components/shared/form";
import { completeSession, planSession, rescheduleSession, updateAgenda } from "@/app/(app)/mentors/actions";
import { initialActionState, type ActionState, type PlanProject, type SessionItem } from "./types";

type Act = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/** useActionState wrapper: toast + close on success; submit without React's automatic form reset (keeps input on error). */
function useDialogAction(action: Act, successMsg: string, onDone: () => void) {
  const t = useTranslations("mentors");
  const [, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const r = await action(prev, fd);
    if (r.ok) {
      toast.success(successMsg);
      onDone();
    } else if (r.error && !r.fieldErrors) toast.error(t(r.error));
    return r;
  }, initialActionState);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  };
  const err = (k: string) => (state.fieldErrors?.[k] ? t(state.fieldErrors[k]) : undefined);
  return { state, pending, onSubmit, err };
}

function Footer({ pending, label }: { pending: boolean; label: string }) {
  const t = useTranslations("mentors");
  const tc = useTranslations("common");
  return (
    <DialogFooter>
      <DialogClose render={<Button type="button" variant="outline" />}>{tc("actions.cancel")}</DialogClose>
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {pending ? t("pending") : label}
      </Button>
    </DialogFooter>
  );
}

const contentCls = "max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg";

/* ---------------------------------------------------------------- plan / request */

export function PlanSessionButton({
  projects,
  mode,
  defaultProjectId,
  size = "lg",
  variant,
}: {
  projects: PlanProject[];
  mode: "plan" | "request";
  defaultProjectId?: string;
  size?: React.ComponentProps<typeof Button>["size"];
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const t = useTranslations("mentors");
  const [open, setOpen] = useState(false);
  if (projects.length === 0) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size={size} variant={variant} />}>
        {mode === "plan" ? <CalendarPlus className="size-4" aria-hidden /> : <Send className="size-4" aria-hidden />}
        {mode === "plan" ? t("actions.plan") : t("actions.request")}
      </DialogTrigger>
      <DialogContent className={contentCls}>
        <DialogHeader>
          <DialogTitle>{mode === "plan" ? t("plan.titlePlan") : t("plan.titleRequest")}</DialogTitle>
          <DialogDescription>{mode === "plan" ? t("plan.descriptionPlan") : t("plan.descriptionRequest")}</DialogDescription>
        </DialogHeader>
        <PlanForm projects={projects} mode={mode} defaultProjectId={defaultProjectId} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function defaultWhen() {
  return format(setMinutes(setHours(startOfDay(addDays(new Date(), 3)), 15), 0), "yyyy-MM-dd'T'HH:mm");
}

function PlanForm({ projects, mode, defaultProjectId, onDone }: { projects: PlanProject[]; mode: "plan" | "request"; defaultProjectId?: string; onDone: () => void }) {
  const t = useTranslations("mentors");
  const { state, pending, onSubmit, err } = useDialogAction(planSession, mode === "plan" ? t("toast.planned") : t("toast.requested"), onDone);
  const [projectId, setProjectId] = useState(defaultProjectId ?? (projects.length === 1 ? projects[0]!.id : ""));
  const project = projects.find((p) => p.id === projectId);
  const [online, setOnline] = useState(false);
  const id = useId();
  const f = (k: string) => `${id}-${k}`;
  const desc = (k: string, hint?: boolean) => (state.fieldErrors?.[k] ? `${f(k)}-error` : hint ? `${f(k)}-hint` : undefined);

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-4">
      {projects.length > 1 ? (
        <Field label={t("plan.project")} htmlFor={f("projectId")} required error={err("projectId")}>
          <NativeSelect id={f("projectId")} name="projectId" value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-invalid={!!state.fieldErrors?.projectId} aria-describedby={desc("projectId")}>
            <option value="">{t("plan.projectPlaceholder")}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.title}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : (
        <>
          <input type="hidden" name="projectId" value={projectId} />
          {project && (
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{t("plan.project")}:</span> <span className="font-mono">{project.code}</span> · {project.title}
            </p>
          )}
        </>
      )}

      <Field label={t("plan.mentor")} htmlFor={f("mentorId")} required error={err("mentorId")} hint={project ? undefined : t("plan.mentorHint")}>
        <NativeSelect id={f("mentorId")} name="mentorId" key={projectId} defaultValue={project?.mentors[0]?.id ?? ""} disabled={!project} aria-invalid={!!state.fieldErrors?.mentorId} aria-describedby={desc("mentorId", !project)}>
          {!project && <option value="">—</option>}
          {project?.mentors.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <Field label={t("plan.when")} htmlFor={f("scheduledAt")} required error={err("scheduledAt")} hint={t("plan.whenHint")}>
          <Input id={f("scheduledAt")} name="scheduledAt" type="datetime-local" required defaultValue={defaultWhen()} className="h-9" aria-invalid={!!state.fieldErrors?.scheduledAt} aria-describedby={desc("scheduledAt", true)} />
        </Field>
        <Field label={t("plan.duration")} htmlFor={f("durationMin")} required error={err("durationMin")}>
          <NativeSelect id={f("durationMin")} name="durationMin" defaultValue="45">
            {[30, 45, 60, 90].map((m) => (
              <option key={m} value={m}>
                {t("session.duration", { min: m })}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <Field label={t("plan.topic")} htmlFor={f("topic")} required error={err("topic")}>
        <Input id={f("topic")} name="topic" required maxLength={160} placeholder={t("plan.topicPlaceholder")} className="h-9" aria-invalid={!!state.fieldErrors?.topic} aria-describedby={desc("topic")} />
      </Field>

      <Field label={t("plan.agenda")} htmlFor={f("agenda")} required={mode === "request"} error={err("agenda")} hint={t("plan.agendaHint")}>
        <Textarea id={f("agenda")} name="agenda" rows={3} maxLength={2000} placeholder={t("plan.agendaPlaceholder")} aria-invalid={!!state.fieldErrors?.agenda} aria-describedby={desc("agenda", true)} />
      </Field>

      <div className="flex items-start justify-between gap-4 rounded-lg border px-3 py-2.5">
        <div>
          <Label htmlFor={f("online")} className="text-[13px] font-medium">
            {t("plan.online")}
          </Label>
          <p className="text-xs text-muted-foreground">{t("plan.onlineHint")}</p>
        </div>
        <Switch id={f("online")} checked={online} onCheckedChange={setOnline} />
        {online && <input type="hidden" name="online" value="on" />}
      </div>

      <Footer pending={pending} label={mode === "plan" ? t("plan.submitPlan") : t("plan.submitRequest")} />
    </form>
  );
}

/* ---------------------------------------------------------------- complete (notes + next steps) */

export function CompleteSessionDialog({ session, open, onOpenChange }: { session: SessionItem; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("mentors");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={contentCls}>
        <DialogHeader>
          <DialogTitle>{t("complete.title")}</DialogTitle>
          <DialogDescription>
            {session.topic} · {session.whenAbs}
          </DialogDescription>
        </DialogHeader>
        <CompleteForm session={session} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CompleteForm({ session, onDone }: { session: SessionItem; onDone: () => void }) {
  const t = useTranslations("mentors");
  const { state, pending, onSubmit, err } = useDialogAction(completeSession, t("toast.completed"), onDone);
  const [steps, setSteps] = useState<{ key: number; value: string }[]>([{ key: 0, value: "" }]);
  const [nextKey, setNextKey] = useState(1);
  const id = useId();

  const add = () => {
    setSteps((s) => [...s, { key: nextKey, value: "" }]);
    setNextKey((k) => k + 1);
    // focus the new input after render
    requestAnimationFrame(() => document.getElementById(`${id}-step-${nextKey}`)?.focus());
  };

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="id" value={session.id} />
      {session.agenda && (
        <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs">
          <p className="font-semibold text-foreground">{t("session.agenda")}</p>
          <p className="mt-0.5 whitespace-pre-line text-muted-foreground">{session.agenda}</p>
        </div>
      )}
      <Field label={t("complete.notes")} htmlFor={`${id}-notes`} required hint={t("complete.notesHint")} error={err("notes")}>
        <Textarea
          id={`${id}-notes`}
          name="notes"
          rows={4}
          maxLength={4000}
          required
          autoFocus
          aria-invalid={!!state.fieldErrors?.notes}
          aria-describedby={state.fieldErrors?.notes ? `${id}-notes-error` : `${id}-notes-hint`}
        />
      </Field>

      <fieldset className="grid gap-2" aria-describedby={`${id}-steps-hint`}>
        <legend className="text-[13px] font-medium">{t("complete.steps")}</legend>
        <p id={`${id}-steps-hint`} className="-mt-1 text-xs text-muted-foreground">
          {t("complete.stepsHint")}
        </p>
        <ol className="grid gap-2">
          {steps.map((s, i) => (
            <li key={s.key} className="flex items-center gap-2">
              <span aria-hidden className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
                {i + 1}
              </span>
              <Input
                id={`${id}-step-${s.key}`}
                name="step"
                value={s.value}
                maxLength={160}
                onChange={(e) => setSteps((all) => all.map((x) => (x.key === s.key ? { ...x, value: e.target.value } : x)))}
                aria-label={t("complete.stepLabel", { n: i + 1 })}
                placeholder={t("complete.stepPlaceholder")}
                className="h-9"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-9 text-muted-foreground"
                onClick={() => setSteps((all) => (all.length === 1 ? [{ key: s.key, value: "" }] : all.filter((x) => x.key !== s.key)))}
                aria-label={t("complete.removeStep", { n: i + 1 })}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ol>
        {err("steps") && (
          <p role="alert" className="text-xs font-medium text-danger">
            {err("steps")}
          </p>
        )}
        {steps.length < 10 && (
          <Button type="button" variant="outline" size="sm" className="h-8 w-fit" onClick={add}>
            <Plus aria-hidden />
            {t("complete.addStep")}
          </Button>
        )}
      </fieldset>

      <Footer pending={pending} label={t("complete.submit")} />
    </form>
  );
}

/* ---------------------------------------------------------------- reschedule */

export function RescheduleDialog({ session, open, onOpenChange }: { session: SessionItem; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("mentors");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={contentCls}>
        <DialogHeader>
          <DialogTitle>{t("reschedule.title")}</DialogTitle>
          <DialogDescription>{t("reschedule.description", { topic: session.topic })}</DialogDescription>
        </DialogHeader>
        <RescheduleForm session={session} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function RescheduleForm({ session, onDone }: { session: SessionItem; onDone: () => void }) {
  const t = useTranslations("mentors");
  const { state, pending, onSubmit, err } = useDialogAction(rescheduleSession, t("toast.rescheduled"), onDone);
  const id = useId();
  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="id" value={session.id} />
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <Field label={t("plan.when")} htmlFor={`${id}-when`} required error={err("scheduledAt")} hint={t("plan.whenHint")}>
          <Input
            id={`${id}-when`}
            name="scheduledAt"
            type="datetime-local"
            defaultValue={session.isPast ? defaultWhen() : session.scheduledLocal}
            className="h-9"
            autoFocus
            aria-invalid={!!state.fieldErrors?.scheduledAt}
            aria-describedby={state.fieldErrors?.scheduledAt ? `${id}-when-error` : `${id}-when-hint`}
          />
        </Field>
        <Field label={t("plan.duration")} htmlFor={`${id}-dur`} required error={err("durationMin")}>
          <NativeSelect id={`${id}-dur`} name="durationMin" defaultValue={String(session.durationMin)}>
            {[...new Set([30, 45, 60, 90, session.durationMin])].sort((a, b) => a - b).map((m) => (
              <option key={m} value={m}>
                {t("session.duration", { min: m })}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Footer pending={pending} label={t("reschedule.submit")} />
    </form>
  );
}

/* ---------------------------------------------------------------- agenda (before the meeting) */

export function AgendaDialog({ session, open, onOpenChange }: { session: SessionItem; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("mentors");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={contentCls}>
        <DialogHeader>
          <DialogTitle>{t("agendaDialog.title")}</DialogTitle>
          <DialogDescription>{t("agendaDialog.description")}</DialogDescription>
        </DialogHeader>
        <AgendaForm session={session} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AgendaForm({ session, onDone }: { session: SessionItem; onDone: () => void }) {
  const t = useTranslations("mentors");
  const { state, pending, onSubmit, err } = useDialogAction(updateAgenda, t("toast.agendaSaved"), onDone);
  const id = useId();
  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="id" value={session.id} />
      <Field label={t("plan.agenda")} htmlFor={`${id}-agenda`} required error={err("agenda")} hint={t("plan.agendaHint")}>
        <Textarea
          id={`${id}-agenda`}
          name="agenda"
          rows={5}
          maxLength={2000}
          defaultValue={session.agenda ?? ""}
          autoFocus
          placeholder={t("plan.agendaPlaceholder")}
          aria-invalid={!!state.fieldErrors?.agenda}
          aria-describedby={state.fieldErrors?.agenda ? `${id}-agenda-error` : `${id}-agenda-hint`}
        />
      </Field>
      <Footer pending={pending} label={t("agendaDialog.submit")} />
    </form>
  );
}

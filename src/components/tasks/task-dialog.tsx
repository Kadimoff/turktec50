"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Field, NativeSelect, SubmitButton } from "@/components/shared/form";
import { useFormAction } from "@/components/shared/use-form-action";
import { bakuAddDays, bakuYmd } from "@/lib/dates";
import { createTask, updateTask } from "@/app/(app)/tasks/actions";
import { useTaskContext } from "./task-context";
import { PRIORITIES, type TaskItem } from "./types";

/** "New task" button + dialog (uses the projects from TaskProvider). */
export function NewTaskButton({ projectId }: { projectId?: string }) {
  const t = useTranslations("tasks");
  const { canCreate, projects } = useTaskContext();
  const [open, setOpen] = useState(false);
  if (!canCreate || projects.length === 0) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" />}>
        <Plus className="size-4" aria-hidden />
        {t("actions.new")}
      </DialogTrigger>
      <TaskDialogContent mode="create" defaultProjectId={projectId} onDone={() => setOpen(false)} />
    </Dialog>
  );
}

/** Edit dialog, controlled by the row/card actions menu. */
export function EditTaskDialog({ task, open, onOpenChange }: { task: TaskItem; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <TaskDialogContent mode="edit" task={task} onDone={() => onOpenChange(false)} />
    </Dialog>
  );
}

function TaskDialogContent(props: { mode: "create" | "edit"; task?: TaskItem; defaultProjectId?: string; onDone: () => void }) {
  const t = useTranslations("tasks");
  return (
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{props.mode === "create" ? t("form.createTitle") : t("form.editTitle")}</DialogTitle>
        <DialogDescription>{props.mode === "create" ? t("form.createDescription") : t("form.editDescription")}</DialogDescription>
      </DialogHeader>
      {/* Mounted only while open → form state resets on every open */}
      <TaskForm {...props} />
    </DialogContent>
  );
}

function TaskForm({ mode, task, defaultProjectId, onDone }: { mode: "create" | "edit"; task?: TaskItem; defaultProjectId?: string; onDone: () => void }) {
  const t = useTranslations("tasks");
  const te = useTranslations("enums");
  const tc = useTranslations("common");
  const { projects, currentWeek } = useTaskContext();
  const [projectId, setProjectId] = useState(task?.projectId ?? defaultProjectId ?? (projects.length === 1 ? projects[0]!.id : ""));
  const project = projects.find((p) => p.id === projectId);

  const { state, pending, onSubmit, error } = useFormAction(mode === "create" ? createTask : updateTask, {
    onDone: () => {
      toast.success(mode === "create" ? t("toast.created") : t("toast.updated"));
      onDone();
    },
    // field errors are shown inline; anything else (forbidden, not found…) as a toast
    onFail: (r) => {
      if (!r.errors && r.message) toast.error(t(r.message));
    },
  });

  const err = (k: string) => {
    const e = error(k);
    return e ? t(e) : undefined;
  };
  const fid = (k: string) => `task-${k}`;
  const desc = (k: string, hint?: boolean) => (error(k) ? `${fid(k)}-error` : hint ? `${fid(k)}-hint` : undefined);
  const defaultDue = task?.dueISO ?? bakuYmd(bakuAddDays(new Date(), 7));

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-4">
      {task && <input type="hidden" name="id" value={task.id} />}

      {mode === "create" && projects.length > 1 ? (
        <Field label={t("form.project")} htmlFor={fid("projectId")} required error={err("projectId")}>
          <NativeSelect
            id={fid("projectId")}
            name="projectId"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            required
            aria-invalid={!!error("projectId")}
            aria-describedby={desc("projectId")}
          >
            <option value="">{t("form.projectPlaceholder")}</option>
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
              <span className="font-medium text-foreground">{t("form.project")}:</span>{" "}
              <span className="font-mono">{project.code}</span> · {project.title}
            </p>
          )}
        </>
      )}

      <Field label={t("form.title")} htmlFor={fid("title")} required error={err("title")}>
        <Input
          id={fid("title")}
          name="title"
          defaultValue={task?.title}
          required
          maxLength={160}
          placeholder={t("form.titlePlaceholder")}
          aria-invalid={!!error("title")}
          aria-describedby={desc("title")}
          autoFocus
        />
      </Field>

      <Field label={t("form.criterion")} htmlFor={fid("acceptanceCriteria")} required hint={t("form.criterionHint")} error={err("acceptanceCriteria")}>
        <Textarea
          id={fid("acceptanceCriteria")}
          name="acceptanceCriteria"
          defaultValue={task?.acceptanceCriteria ?? ""}
          required
          maxLength={400}
          rows={2}
          placeholder={t("form.criterionPlaceholder")}
          aria-invalid={!!error("acceptanceCriteria")}
          aria-describedby={desc("acceptanceCriteria", true)}
        />
      </Field>

      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label={t("form.assignee")} htmlFor={fid("assigneeId")} hint={t("form.assigneeHint")} error={err("assigneeId")}>
          <NativeSelect
            id={fid("assigneeId")}
            name="assigneeId"
            defaultValue={task?.assignee?.id ?? ""}
            key={projectId}
            disabled={!project}
            aria-invalid={!!error("assigneeId")}
            aria-describedby={desc("assigneeId", true)}
          >
            <option value="">{t("form.noAssignee")}</option>
            {project?.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.isLead ? `${m.name} (${t("form.lead")})` : m.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t("form.due")} htmlFor={fid("dueDate")} required error={err("dueDate")}>
          <Input
            id={fid("dueDate")}
            name="dueDate"
            type="date"
            required
            defaultValue={defaultDue}
            aria-invalid={!!error("dueDate")}
            aria-describedby={desc("dueDate")}
          />
        </Field>
        <Field label={t("form.priority")} htmlFor={fid("priority")} required>
          <NativeSelect id={fid("priority")} name="priority" defaultValue={task?.priority ?? "MEDIUM"}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {te(`Priority.${p}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t("form.week")} htmlFor={fid("week")} error={err("week")}>
          <NativeSelect id={fid("week")} name="week" defaultValue={String(task ? (task.week ?? "") : currentWeek || "")}>
            <option value="">—</option>
            {Array.from({ length: 8 }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>
                {t("weekLabel", { n: w })}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <Field label={t("form.description")} htmlFor={fid("description")} hint={t("form.descriptionHint")} error={err("description")}>
        <Textarea
          id={fid("description")}
          name="description"
          defaultValue={task?.description ?? ""}
          rows={3}
          maxLength={2000}
          aria-describedby={desc("description", true)}
        />
      </Field>

      {!state.ok && state.errors && state.message === "errors.invalid" && (
        <p role="alert" className="text-xs font-medium text-danger">
          {t(state.message)}
        </p>
      )}

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" size="lg" />}>{tc("actions.cancel")}</DialogClose>
        <SubmitButton pending={pending} pendingLabel={t("form.pending")}>
          {mode === "create" ? t("form.submitCreate") : t("form.submitEdit")}
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}

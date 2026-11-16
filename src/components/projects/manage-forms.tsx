"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Field, NativeSelect, SubmitButton } from "@/components/shared/form";
import { useFormAction } from "@/components/shared/use-form-action";
import type { ActionState } from "@/lib/action-state";
import {
  assignJury, assignMentor, changeHealth, changeStage, unassignJury, unassignMentor, updateAcademyLinks, updateFlags,
} from "@/app/(app)/projects/[id]/actions";

type Opt = { value: string; label: string };

/** `useFormAction` + toasts for the coordinator forms (keys of `projects.manage`); field errors are shown inline. */
function useManageAction(action: (prev: ActionState, fd: FormData) => Promise<ActionState>) {
  const t = useTranslations("projects.manage");
  const form = useFormAction(action, {
    onDone: (s) => toast.success(t(s.message ?? "save")),
    onFail: (s) => {
      if (!s.errors) toast.error(t(s.message ?? "errors.invalid"));
    },
  });
  const err = (field: string) => {
    const key = form.error(field);
    return key ? t(key) : undefined;
  };
  const aria = (field: string, id: string, hint?: boolean) => ({
    "aria-invalid": !!form.error(field) || undefined,
    "aria-describedby": form.error(field) ? `${id}-error` : hint ? `${id}-hint` : undefined,
  });
  return { ...form, err, aria };
}

export function StageForm({ projectId, current, stages, defaultTarget }: { projectId: string; current: string; stages: Opt[]; defaultTarget?: string }) {
  const t = useTranslations("projects.manage");
  const { pending, onSubmit, err, aria } = useManageAction(changeStage);
  return (
    <form onSubmit={onSubmit} className="grid gap-4" key={current} noValidate>
      <input type="hidden" name="projectId" value={projectId} />
      <Field label={t("toStage")} htmlFor="mg-stage" required error={err("toStage")}>
        <NativeSelect id="mg-stage" name="toStage" defaultValue={defaultTarget ?? ""} required {...aria("toStage", "mg-stage")}>
          {stages.map((s) => (
            <option key={s.value} value={s.value} disabled={s.value === current}>{s.label}</option>
          ))}
        </NativeSelect>
      </Field>
      <Field label={t("stageNote")} htmlFor="mg-stage-note" required hint={t("stageNoteHint")} error={err("note")}>
        <Textarea id="mg-stage-note" name="note" rows={2} required minLength={5} maxLength={1000} {...aria("note", "mg-stage-note", true)} />
      </Field>
      <SubmitButton pending={pending} pendingLabel={t("saving")} className="sm:justify-self-start">{t("changeStage")}</SubmitButton>
    </form>
  );
}

export function HealthForm({ projectId, current, options }: { projectId: string; current: string; options: Opt[] }) {
  const t = useTranslations("projects.manage");
  const { pending, onSubmit, err, aria } = useManageAction(changeHealth);
  return (
    <form onSubmit={onSubmit} className="flex items-end gap-2" key={current}>
      <input type="hidden" name="projectId" value={projectId} />
      <Field label={t("health")} htmlFor="mg-health" className="flex-1" error={err("health")}>
        <NativeSelect id="mg-health" name="health" defaultValue={current} {...aria("health", "mg-health")}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </NativeSelect>
      </Field>
      <SubmitButton pending={pending} variant="outline" pendingLabel={t("saving")}>{t("save")}</SubmitButton>
    </form>
  );
}

export function FlagsForm({
  projectId,
  initial,
  results,
}: {
  projectId: string;
  initial: { prototypeVerified: boolean; packageQcPassed: boolean; submittedAt: string; result: string };
  results: Opt[];
}) {
  const t = useTranslations("projects.manage");
  const { pending, onSubmit, err, aria } = useManageAction(updateFlags);
  const [proto, setProto] = useState(initial.prototypeVerified);
  const [qc, setQc] = useState(initial.packageQcPassed);
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <input type="hidden" name="projectId" value={projectId} />
      {proto && <input type="hidden" name="prototypeVerified" value="on" />}
      {qc && <input type="hidden" name="packageQcPassed" value="on" />}
      <div className="grid gap-3">
        <label className="flex min-h-10 cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 hover:bg-muted/50">
          <Checkbox checked={proto} onCheckedChange={(v) => setProto(!!v)} className="mt-0.5" />
          <span className="min-w-0">
            <span className="block text-sm font-medium">{t("prototypeVerified")}</span>
            <span className="block text-xs text-muted-foreground">{t("prototypeVerifiedHint")}</span>
          </span>
        </label>
        <label className="flex min-h-10 cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 hover:bg-muted/50">
          <Checkbox checked={qc} onCheckedChange={(v) => setQc(!!v)} className="mt-0.5" />
          <span className="min-w-0">
            <span className="block text-sm font-medium">{t("packageQcPassed")}</span>
            <span className="block text-xs text-muted-foreground">{t("packageQcPassedHint")}</span>
          </span>
        </label>
      </div>
      {/* one column at xl, where the form sits in half of the management card */}
      <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <Field label={t("submittedAt")} htmlFor="mg-submitted" hint={t("submittedAtHint")} error={err("submittedAt")}>
          <Input id="mg-submitted" name="submittedAt" type="date" defaultValue={initial.submittedAt} {...aria("submittedAt", "mg-submitted", true)} />
        </Field>
        <Field label={t("result")} htmlFor="mg-result" hint={t("resultHint")} error={err("result")}>
          <NativeSelect id="mg-result" name="result" defaultValue={initial.result} {...aria("result", "mg-result", true)}>
            {results.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </NativeSelect>
        </Field>
      </div>
      <SubmitButton pending={pending} pendingLabel={t("saving")} className="sm:justify-self-start">{t("saveFlags")}</SubmitButton>
    </form>
  );
}

export function AcademyLinksForm({
  projectId,
  initial,
  faculties,
  labs,
  partners,
  university,
}: {
  projectId: string;
  initial: { facultyId: string; labId: string; partnerId: string };
  faculties: Opt[];
  labs: Opt[];
  partners: Opt[];
  /** short name of the project's university (faculty options are limited to it) */
  university: string;
}) {
  const t = useTranslations("projects.manage");
  const { pending, onSubmit, err, aria } = useManageAction(updateAcademyLinks);
  const fields = [
    { name: "facultyId", label: t("faculty"), hint: t("facultyHint", { university }), options: faculties, value: initial.facultyId },
    { name: "labId", label: t("lab"), hint: undefined, options: labs, value: initial.labId },
    { name: "partnerId", label: t("partner"), hint: undefined, options: partners, value: initial.partnerId },
  ];
  return (
    <form onSubmit={onSubmit} className="grid gap-4" key={`${initial.facultyId}|${initial.labId}|${initial.partnerId}`} noValidate>
      <input type="hidden" name="projectId" value={projectId} />
      <div className="grid items-start gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <Field key={f.name} label={f.label} htmlFor={`mg-${f.name}`} hint={f.hint} error={err(f.name)} className={f.name === "facultyId" ? "sm:col-span-2" : undefined}>
            <NativeSelect id={`mg-${f.name}`} name={f.name} defaultValue={f.value} {...aria(f.name, `mg-${f.name}`, !!f.hint)}>
              <option value="">{t("notLinked")}</option>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </NativeSelect>
          </Field>
        ))}
      </div>
      <SubmitButton pending={pending} variant="outline" pendingLabel={t("saving")} className="sm:justify-self-start">{t("saveAcademy")}</SubmitButton>
    </form>
  );
}

export function AssignForm({ projectId, kind, options }: { projectId: string; kind: "mentor" | "jury"; options: Opt[] }) {
  const t = useTranslations("projects.manage");
  const { pending, onSubmit, err, aria } = useManageAction(kind === "mentor" ? assignMentor : assignJury);
  const id = `mg-assign-${kind}`;
  if (options.length === 0) return <p className="text-xs text-muted-foreground">{t(kind === "mentor" ? "noMentorsLeft" : "noJuryLeft")}</p>;
  return (
    <form onSubmit={onSubmit} key={options.length} className="grid gap-4" noValidate>
      <input type="hidden" name="projectId" value={projectId} />
      <Field label={t(kind === "mentor" ? "addMentor" : "addJury")} htmlFor={id} error={err("userId")}>
        <NativeSelect id={id} name="userId" required defaultValue="" {...aria("userId", id)}>
          <option value="" disabled>{t("choosePerson")}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </NativeSelect>
      </Field>
      {kind === "mentor" && (
        <Field label={t("focus")} htmlFor={`${id}-focus`} error={err("focus")}>
          <Input id={`${id}-focus`} name="focus" maxLength={60} placeholder={t("focusPlaceholder")} {...aria("focus", `${id}-focus`)} />
        </Field>
      )}
      <SubmitButton pending={pending} variant="outline" pendingLabel={t("saving")}>{t("assign")}</SubmitButton>
    </form>
  );
}

export function UnassignButton({ projectId, userId, name, kind }: { projectId: string; userId: string; name: string; kind: "mentor" | "jury" }) {
  const t = useTranslations("projects.manage");
  const tc = useTranslations("common.actions");
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={t("unassignLabel", { name })} disabled={pending} />}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <X aria-hidden />}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("unassignTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("unassignBody", { name })}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() =>
              start(async () => {
                const res = await (kind === "mentor" ? unassignMentor(projectId, userId) : unassignJury(projectId, userId));
                setOpen(false);
                if (res.ok) toast.success(t(res.message ?? "unassigned"));
                else toast.error(t(res.message ?? "errors.invalid"));
              })
            }
          >
            {t("unassign")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

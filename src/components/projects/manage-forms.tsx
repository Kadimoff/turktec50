"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
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
import {
  assignJury, assignMentor, changeHealth, changeStage, unassignJury, unassignMentor, updateFlags, type ManageState,
} from "@/app/(app)/projects/[id]/actions";

type Opt = { value: string; label: string };

function useResultToast(state: ManageState, successKey: string) {
  const t = useTranslations("projects.manage");
  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(t(successKey));
    else toast.error(t(`errors.${state.error}`));
  }, [state, t, successKey]);
}

export function StageForm({ projectId, current, stages, defaultTarget }: { projectId: string; current: string; stages: Opt[]; defaultTarget?: string }) {
  const t = useTranslations("projects.manage");
  const [state, action] = useActionState<ManageState, FormData>(changeStage, undefined);
  useResultToast(state, "stageSaved");
  const noteErr = state && !state.ok && state.error === "noteRequired" ? t("errors.noteRequired") : undefined;
  return (
    <form action={action} className="grid gap-3" key={current}>
      <input type="hidden" name="projectId" value={projectId} />
      <Field label={t("toStage")} htmlFor="mg-stage" required>
        <NativeSelect id="mg-stage" name="toStage" defaultValue={defaultTarget ?? ""} required className="h-10">
          {stages.map((s) => (
            <option key={s.value} value={s.value} disabled={s.value === current}>{s.label}</option>
          ))}
        </NativeSelect>
      </Field>
      <Field label={t("stageNote")} htmlFor="mg-stage-note" required hint={t("stageNoteHint")} error={noteErr}>
        <Textarea
          id="mg-stage-note" name="note" rows={2} required minLength={5} maxLength={1000}
          aria-invalid={!!noteErr} aria-describedby={noteErr ? "mg-stage-note-error" : "mg-stage-note-hint"}
        />
      </Field>
      <SubmitButton className="h-10" pendingLabel={t("saving")}>{t("changeStage")}</SubmitButton>
    </form>
  );
}

export function HealthForm({ projectId, current, options }: { projectId: string; current: string; options: Opt[] }) {
  const t = useTranslations("projects.manage");
  const [state, action] = useActionState<ManageState, FormData>(changeHealth, undefined);
  useResultToast(state, "healthSaved");
  return (
    <form action={action} className="flex items-end gap-2" key={current}>
      <input type="hidden" name="projectId" value={projectId} />
      <Field label={t("health")} htmlFor="mg-health" className="flex-1">
        <NativeSelect id="mg-health" name="health" defaultValue={current} className="h-10">
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </NativeSelect>
      </Field>
      <SubmitButton className="h-10" variant="outline" pendingLabel={t("saving")}>{t("save")}</SubmitButton>
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
  const [state, action] = useActionState<ManageState, FormData>(updateFlags, undefined);
  useResultToast(state, "flagsSaved");
  const [proto, setProto] = useState(initial.prototypeVerified);
  const [qc, setQc] = useState(initial.packageQcPassed);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      {proto && <input type="hidden" name="prototypeVerified" value="on" />}
      {qc && <input type="hidden" name="packageQcPassed" value="on" />}
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
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("submittedAt")} htmlFor="mg-submitted" hint={t("submittedAtHint")}>
          <Input id="mg-submitted" name="submittedAt" type="date" defaultValue={initial.submittedAt} className="h-10" />
        </Field>
        <Field label={t("result")} htmlFor="mg-result" hint={t("resultHint")}>
          <NativeSelect id="mg-result" name="result" defaultValue={initial.result} className="h-10">
            {results.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </NativeSelect>
        </Field>
      </div>
      <SubmitButton className="h-10" pendingLabel={t("saving")}>{t("saveFlags")}</SubmitButton>
    </form>
  );
}

export function AssignForm({ projectId, kind, options }: { projectId: string; kind: "mentor" | "jury"; options: Opt[] }) {
  const t = useTranslations("projects.manage");
  const [state, action] = useActionState<ManageState, FormData>(kind === "mentor" ? assignMentor : assignJury, undefined);
  useResultToast(state, kind === "mentor" ? "mentorAssigned" : "juryAssigned");
  const id = `mg-assign-${kind}`;
  if (options.length === 0) return <p className="text-xs text-muted-foreground">{t(kind === "mentor" ? "noMentorsLeft" : "noJuryLeft")}</p>;
  return (
    <form action={action} key={options.length} className="grid gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="grid gap-3">
        <Field label={t(kind === "mentor" ? "addMentor" : "addJury")} htmlFor={id}>
          <NativeSelect id={id} name="userId" required defaultValue="" className="h-10">
            <option value="" disabled>{t("choosePerson")}</option>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </NativeSelect>
        </Field>
        {kind === "mentor" && (
          <Field label={t("focus")} htmlFor={`${id}-focus`}>
            <Input id={`${id}-focus`} name="focus" maxLength={60} placeholder={t("focusPlaceholder")} className="h-10" />
          </Field>
        )}
      </div>
      <SubmitButton className="h-10" variant="outline" pendingLabel={t("saving")}>{t("assign")}</SubmitButton>
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
                if (res?.ok) toast.success(t("unassigned"));
                else toast.error(t(`errors.${res?.error ?? "invalid"}`));
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

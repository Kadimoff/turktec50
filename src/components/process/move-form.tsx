"use client";
import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect, SubmitButton } from "@/components/shared/form";
import { moveApplicationStage, moveProjectStage, type MoveState } from "@/app/(app)/process/actions";

type Opt = { value: string; label: string; disabled?: boolean };

/** ADMIN/root: move a project / application to any active stage of its scope, with a mandatory note (audited). */
export function WorkflowMoveForm({ scope, entityId, currentId, options, defaultTarget }: { scope: "PROJECT" | "APPLICATION"; entityId: string; currentId: string | null; options: Opt[]; defaultTarget?: string }) {
  const t = useTranslations("process.stepper.move");
  const [state, action] = useActionState<MoveState, FormData>(scope === "PROJECT" ? moveProjectStage : moveApplicationStage, undefined);
  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(t("saved"));
    else toast.error(t(`errors.${state.error}`));
  }, [state, t]);
  const noteErr = state && !state.ok && state.error === "noteRequired" ? t("errors.noteRequired") : undefined;
  const id = `wf-move-${scope.toLowerCase()}`;
  return (
    <form action={action} className="grid gap-3" key={currentId ?? "none"} data-testid="workflow-move-form">
      <input type="hidden" name="entityId" value={entityId} />
      <Field label={t("stage")} htmlFor={`${id}-stage`} required hint={t("systemHint")}>
        <NativeSelect id={`${id}-stage`} name="stageId" defaultValue={defaultTarget ?? ""} required className="h-10">
          <option value="" disabled>{t("choose")}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
          ))}
        </NativeSelect>
      </Field>
      <Field label={t("note")} htmlFor={`${id}-note`} required hint={t("noteHint")} error={noteErr}>
        <Textarea id={`${id}-note`} name="note" rows={2} required minLength={5} maxLength={1000} aria-invalid={!!noteErr} aria-describedby={noteErr ? `${id}-note-error` : `${id}-note-hint`} />
      </Field>
      <SubmitButton className="h-10" pendingLabel={t("saving")}>{t("submit")}</SubmitButton>
    </form>
  );
}

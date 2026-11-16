"use client";
import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, NativeSelect } from "@/components/shared/form";
import { ToneBadge } from "@/components/shared/tone-badge";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/tones";
import {
  createStage, deleteStage, reorderStage, setStageActive, updateStage, type StageFormState,
} from "@/app/(app)/admin/workflow/actions";

export type AdminStage = {
  id: string;
  scope: "APPLICATION" | "PROJECT";
  systemKey: string | null;
  name: string;
  nameAz: string; nameTr: string; nameEn: string;
  descriptionAz: string; descriptionTr: string; descriptionEn: string;
  kind: "NORMAL" | "DECISION" | "WAITING" | "REJECTED" | "DONE";
  roles: ("TEAM" | "ADMIN" | "MENTOR" | "JURY")[];
  active: boolean;
  count: number;
};

const ROLES = ["TEAM", "ADMIN", "MENTOR", "JURY"] as const;
const KINDS = ["NORMAL", "DECISION", "WAITING", "REJECTED", "DONE"] as const;
const KIND_TONE: Record<string, Tone> = { NORMAL: "brand", DECISION: "info", WAITING: "warning", REJECTED: "danger", DONE: "success" };

function useSubmitWith(dispatch: (fd: FormData) => void) {
  const [, start] = useTransition();
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(() => dispatch(fd));
  };
}

function useStageAction(fn: (prev: StageFormState, fd: FormData) => Promise<StageFormState>, okKey: string, onOk: () => void) {
  const t = useTranslations("process.admin");
  return useActionState(async (prev: StageFormState, fd: FormData) => {
    const res = await fn(prev, fd);
    if (res?.ok) { toast.success(t(`toasts.${okKey}`)); onOk(); }
    else if (res && !res.ok) toast.error(t(`errors.${res.error}`));
    return res;
  }, undefined);
}

function PendingButton({ pending, children, variant, testId }: { pending: boolean; children: React.ReactNode; variant?: "default" | "destructive"; testId?: string }) {
  const t = useTranslations("process.admin");
  return (
    <Button type="submit" variant={variant} disabled={pending} aria-busy={pending} data-testid={testId}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? t("saving") : children}
    </Button>
  );
}

/** Shared fields of the create / edit dialogs (names + descriptions in 3 languages, kind, responsible roles). */
function StageFields({ prefix, stage, state, lockKind }: { prefix: string; stage?: AdminStage; state: StageFormState; lockKind: boolean }) {
  const t = useTranslations("process.admin");
  const tp = useTranslations("process");
  const fe = (k: string) => (state && !state.ok && state.fieldErrors?.[k] ? t(`errors.${state.fieldErrors[k]}`) : undefined);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        {(["Az", "Tr", "En"] as const).map((l) => (
          <Field key={l} label={t(`fields.name${l}`)} htmlFor={`${prefix}-name${l}`} required={l === "Az"} error={fe(`name${l}`)} hint={l !== "Az" ? t("fields.fallbackHint") : undefined}>
            <Input id={`${prefix}-name${l}`} name={`name${l}`} defaultValue={stage?.[`name${l}`] ?? ""} maxLength={80} required={l === "Az"} className="h-10" />
          </Field>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {(["Az", "Tr", "En"] as const).map((l) => (
          <Field key={l} label={t(`fields.description${l}`)} htmlFor={`${prefix}-desc${l}`} error={fe(`description${l}`)}>
            <Textarea id={`${prefix}-desc${l}`} name={`description${l}`} defaultValue={stage?.[`description${l}`] ?? ""} maxLength={400} rows={3} />
          </Field>
        ))}
      </div>
      <Field label={t("fields.kind")} htmlFor={`${prefix}-kind`} hint={lockKind ? t("fields.kindLocked") : t("fields.kindHint")}>
        <NativeSelect id={`${prefix}-kind`} name="kind" defaultValue={stage?.kind ?? "NORMAL"} disabled={lockKind} className="h-10">
          {KINDS.map((k) => <option key={k} value={k}>{tp(`kinds.${k}`)}</option>)}
        </NativeSelect>
      </Field>
      <fieldset className="grid gap-1.5">
        <legend className="text-[13px] font-medium">{t("fields.roles")}<span className="text-danger" aria-hidden> *</span></legend>
        <p className="text-xs text-muted-foreground">{t("fields.rolesHint")}</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <label key={r} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm hover:bg-muted/50">
              <input type="checkbox" name="roles" value={r} defaultChecked={stage ? stage.roles.includes(r) : r === "TEAM"} className="size-4 accent-primary" />
              {tp(`lanes.${r}`)}
            </label>
          ))}
        </div>
        {fe("roles") && <p className="text-xs font-medium text-danger" role="alert">{fe("roles")}</p>}
      </fieldset>
    </>
  );
}

export function CreateStageDialog({ stages }: { stages: AdminStage[] }) {
  const t = useTranslations("process.admin");
  const tp = useTranslations("process");
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"APPLICATION" | "PROJECT">("PROJECT");
  const [state, action, pending] = useStageAction(createStage, "created", () => setOpen(false));
  const onSubmit = useSubmitWith(action);
  const inScope = stages.filter((s) => s.scope === scope);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" className="h-10" data-testid="add-stage" />}>
        <Plus className="size-4" aria-hidden />{t("add")}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("addTitle")}</DialogTitle>
          <DialogDescription>{t("addHint")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate data-testid="add-stage-form">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("fields.scope")} htmlFor="cs-scope" required>
              <NativeSelect id="cs-scope" name="scope" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className="h-10">
                <option value="APPLICATION">{tp("scopes.APPLICATION")}</option>
                <option value="PROJECT">{tp("scopes.PROJECT")}</option>
              </NativeSelect>
            </Field>
            <Field label={t("fields.after")} htmlFor="cs-after" hint={t("fields.afterHint")}>
              <NativeSelect id="cs-after" name="afterId" key={scope} defaultValue={inScope[inScope.length - 1]?.id ?? ""} className="h-10">
                <option value="">{t("fields.first")}</option>
                {inScope.map((s, i) => <option key={s.id} value={s.id}>{`${i + 1}. ${s.name}`}</option>)}
              </NativeSelect>
            </Field>
          </div>
          <StageFields prefix="cs" state={state} lockKind={false} />
          <DialogFooter>
            <PendingButton pending={pending} testId="add-stage-submit">{t("create")}</PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditStageDialog({ stage }: { stage: AdminStage }) {
  const t = useTranslations("process.admin");
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useStageAction(updateStage, "saved", () => setOpen(false));
  const onSubmit = useSubmitWith(action);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={t("editLabel", { name: stage.name })} data-testid={`edit-${stage.id}`} />}>
        <Pencil aria-hidden />
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("editTitle", { name: stage.name })}</DialogTitle>
          <DialogDescription>{stage.systemKey ? t("systemHint") : t("customHint")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate data-testid="edit-stage-form">
          <input type="hidden" name="id" value={stage.id} />
          <StageFields prefix={`es-${stage.id}`} stage={stage} state={state} lockKind={!!stage.systemKey} />
          <DialogFooter>
            <PendingButton pending={pending} testId="edit-stage-submit">{t("save")}</PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Deactivate or delete a custom stage; when it still holds items they must be moved to another active stage first. */
function RemoveStageDialog({ stage, stages, mode }: { stage: AdminStage; stages: AdminStage[]; mode: "deactivate" | "delete" }) {
  const t = useTranslations("process.admin");
  const [open, setOpen] = useState(false);
  const [, action, pending] = useStageAction(mode === "delete" ? deleteStage : setStageActive, mode === "delete" ? "deleted" : "deactivated", () => setOpen(false));
  const onSubmit = useSubmitWith(action);
  const targets = stages.filter((s) => s.scope === stage.scope && s.id !== stage.id && s.active);
  const Icon = mode === "delete" ? Trash2 : PowerOff;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={t(`${mode}Label`, { name: stage.name })} data-testid={`${mode}-${stage.id}`} className={mode === "delete" ? "text-danger" : undefined} />}>
        <Icon aria-hidden />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t(`${mode}Title`, { name: stage.name })}</DialogTitle>
          <DialogDescription>{stage.count > 0 ? t("hasItemsHint", { count: stage.count }) : t(`${mode}Hint`)}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" data-testid={`${mode}-form`}>
          <input type="hidden" name="id" value={stage.id} />
          <input type="hidden" name="active" value="false" />
          {stage.count > 0 && (
            <Field label={t("moveTo")} htmlFor={`mv-${stage.id}`} required hint={t("moveToHint")}>
              <NativeSelect id={`mv-${stage.id}`} name="moveToId" required defaultValue={targets[0]?.id ?? ""} className="h-10">
                {targets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </NativeSelect>
            </Field>
          )}
          <DialogFooter>
            <PendingButton pending={pending} variant="destructive" testId={`${mode}-submit`}>{t(`${mode}Confirm`)}</PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ActivateButton({ stage }: { stage: AdminStage }) {
  const t = useTranslations("process.admin");
  const [, action, pending] = useStageAction(setStageActive, "activated", () => {});
  const onSubmit = useSubmitWith(action);
  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="id" value={stage.id} />
      <input type="hidden" name="active" value="true" />
      <Button type="submit" variant="ghost" size="icon-sm" disabled={pending} aria-label={t("activateLabel", { name: stage.name })} data-testid={`activate-${stage.id}`}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Power aria-hidden />}
      </Button>
    </form>
  );
}

function ReorderButtons({ stage, first, last }: { stage: AdminStage; first: boolean; last: boolean }) {
  const t = useTranslations("process.admin");
  const [pending, start] = useTransition();
  const move = (dir: "up" | "down") => start(async () => {
    const r = await reorderStage(stage.id, dir);
    if (r?.ok) toast.success(t("toasts.reordered"));
    else if (r) toast.error(t(`errors.${r.error}`));
  });
  return (
    <div className="flex items-center">
      <Button variant="ghost" size="icon-sm" disabled={first || pending} onClick={() => move("up")} aria-label={t("moveUp", { name: stage.name })} data-testid={`up-${stage.id}`}><ArrowUp aria-hidden /></Button>
      <Button variant="ghost" size="icon-sm" disabled={last || pending} onClick={() => move("down")} aria-label={t("moveDown", { name: stage.name })} data-testid={`down-${stage.id}`}><ArrowDown aria-hidden /></Button>
    </div>
  );
}

export function StageTable({ scope, stages, allStages }: { scope: "APPLICATION" | "PROJECT"; stages: AdminStage[]; allStages: AdminStage[] }) {
  const t = useTranslations("process.admin");
  const tp = useTranslations("process");
  return (
    <ol className="divide-y" data-testid={`stages-${scope}`}>
      {stages.map((s, i) => (
        <li key={s.id} className={cn("flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-5", !s.active && "bg-muted/40")} data-stage-row={s.id} data-stage-name={s.nameAz}>
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="tabular mt-0.5 w-6 shrink-0 text-sm font-semibold text-muted-foreground">{i + 1}.</span>
            <div className="min-w-0">
              <p className={cn("text-sm font-semibold", !s.active && "text-muted-foreground line-through")}>{s.name}</p>
              <p className="text-xs text-muted-foreground">{[s.nameAz, s.nameTr, s.nameEn].filter((n, j, a) => a.indexOf(n) === j && n !== s.name).join(" · ") || "\u00a0"}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <ToneBadge tone={KIND_TONE[s.kind]} dot={false}>{tp(`kinds.${s.kind}`)}</ToneBadge>
                <ToneBadge tone="neutral" dot={false}>{s.systemKey ? t("system") : t("custom")}</ToneBadge>
                {!s.active && <ToneBadge tone="warning">{t("inactive")}</ToneBadge>}
                <span className="text-xs text-muted-foreground">{s.roles.map((r) => tp(`lanes.${r}`)).join(", ")}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 pl-9 sm:justify-end sm:pl-0">
            <span className="tabular min-w-16 text-sm text-muted-foreground sm:text-right">{tp(scope === "PROJECT" ? "list.projects" : "list.applications", { count: s.count })}</span>
            <div className="flex items-center">
              <ReorderButtons stage={s} first={i === 0} last={i === stages.length - 1} />
              <EditStageDialog stage={s} />
              {!s.systemKey && (s.active ? <RemoveStageDialog stage={s} stages={allStages} mode="deactivate" /> : <ActivateButton stage={s} />)}
              {!s.systemKey && <RemoveStageDialog stage={s} stages={allStages} mode="delete" />}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect, SubmitButton } from "@/components/shared/form";
import { useFormAction } from "@/components/shared/use-form-action";
import { ToneBadge } from "@/components/shared/tone-badge";
import { riskLevelTone } from "@/lib/tones";
import { loadOwnerOptions, saveRisk } from "@/app/(app)/risks/actions";
import { RISK_LEVELS, riskLevel } from "./level";
import type { OwnerOption, RiskFormValue, ScopeOption } from "./types";

type Props =
  | { mode: "create"; scopes: ScopeOption[]; defaultScope?: string; risk?: undefined }
  | { mode: "edit"; risk: RiskFormValue; scopes?: undefined; defaultScope?: undefined };

export function RiskFormDialog(props: Props) {
  const t = useTranslations("risks");
  const [open, setOpen] = useState(false);
  // owner lists survive closing the dialog (one request per scope)
  const [cache] = useState(() => new Map<string, OwnerOption[]>());
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.mode === "create" ? (
        <DialogTrigger render={<Button size="lg" />}>
          <Plus aria-hidden />
          {t("form.create")}
        </DialogTrigger>
      ) : (
        <DialogTrigger
          render={<Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-foreground" aria-label={t("actions.editLabel", { title: props.risk.title })} />}
        >
          <Pencil aria-hidden />
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{props.mode === "create" ? t("form.createTitle") : t("form.editTitle")}</DialogTitle>
          <DialogDescription>{t("form.dialogDescription")}</DialogDescription>
        </DialogHeader>
        {/* mounted per opening: a reopened dialog starts from the stored values without old errors */}
        <RiskForm {...props} cache={cache} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function RiskForm(props: Props & { cache: Map<string, OwnerOption[]>; onSaved: () => void }) {
  const t = useTranslations("risks");
  const te = useTranslations("enums");
  const tc = useTranslations("common.actions");
  const uid = useId();
  const id = (s: string) => `${uid}-${s}`;
  const { risk, cache } = props;
  const [scope, setScope] = useState(risk?.scope ?? props.defaultScope ?? (props.scopes?.length === 1 ? props.scopes[0]!.value : ""));
  const [probability, setProbability] = useState<string>(risk?.probability ?? "MEDIUM");
  const [impact, setImpact] = useState<string>(risk?.impact ?? "MEDIUM");
  const [owners, setOwners] = useState<OwnerOption[] | null>(null);
  const [ownersPending, startOwners] = useTransition();

  useEffect(() => {
    if (!scope) return;
    const hit = cache.get(scope);
    startOwners(async () => {
      const list = hit ?? (await loadOwnerOptions(scope));
      cache.set(scope, list);
      setOwners(list);
    });
  }, [scope, cache]);

  const { pending, onSubmit, error } = useFormAction(saveRisk, {
    onDone: (s) => {
      toast.success(t((s.message ?? "toast.updated") as never));
      props.onSaved();
    },
    onFail: (s) => toast.error(t((s.message ?? "errors.generic") as never)),
  });
  const err = (k: string) => {
    const key = error(k);
    return key ? t(key as never) : undefined;
  };
  const aria = (k: string, hint?: boolean) => ({
    "aria-invalid": !!error(k) || undefined,
    "aria-describedby": error(k) ? `${id(k)}-error` : hint ? `${id(k)}-hint` : undefined,
  });

  const derived = riskLevel(probability, impact);
  const ownerList: OwnerOption[] = [...(owners ?? [])];
  if (risk?.ownerId && risk.ownerName && !ownerList.some((o) => o.id === risk.ownerId)) {
    ownerList.unshift({ id: risk.ownerId, name: risk.ownerName, role: "" });
  }
  const scopeLabel = props.mode === "create" ? props.scopes.find((s) => s.value === scope)?.label : undefined;

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {risk && <input type="hidden" name="riskId" value={risk.id} />}
      {props.mode === "create" && props.scopes.length > 1 ? (
        <Field label={t("form.scope")} htmlFor={id("scope")} required error={err("scope")}>
          <NativeSelect id={id("scope")} name="scope" value={scope} onChange={(e) => { setOwners(null); setScope(e.target.value); }} required {...aria("scope")}>
            <option value="" disabled>{t("form.chooseProject")}</option>
            {props.scopes.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </NativeSelect>
        </Field>
      ) : (
        <>
          <input type="hidden" name="scope" value={scope} />
          {scopeLabel && <p className="text-xs text-muted-foreground">{t("form.scope")}: <span className="font-medium text-foreground">{scopeLabel}</span></p>}
          {err("scope") && <p className="text-xs font-medium text-danger" role="alert">{err("scope")}</p>}
        </>
      )}
      <Field label={t("form.title")} htmlFor={id("title")} required hint={t("form.titleHint")} error={err("title")}>
        <Input id={id("title")} name="title" defaultValue={risk?.title} required minLength={3} maxLength={160} {...aria("title", true)} />
      </Field>
      <Field label={t("form.description")} htmlFor={id("description")} hint={t("form.descriptionHint")} error={err("description")}>
        <Textarea id={id("description")} name="description" defaultValue={risk?.description ?? ""} rows={2} maxLength={2000} {...aria("description", true)} />
      </Field>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label={t("form.probability")} htmlFor={id("probability")} required error={err("probability")}>
          <NativeSelect id={id("probability")} name="probability" value={probability} onChange={(e) => setProbability(e.target.value)} {...aria("probability")}>
            {RISK_LEVELS.map((l) => <option key={l} value={l}>{te(`RiskLevel.${l}`)}</option>)}
          </NativeSelect>
        </Field>
        <Field label={t("form.impact")} htmlFor={id("impact")} required error={err("impact")}>
          <NativeSelect id={id("impact")} name="impact" value={impact} onChange={(e) => setImpact(e.target.value)} {...aria("impact")}>
            {RISK_LEVELS.map((l) => <option key={l} value={l}>{te(`RiskLevel.${l}`)}</option>)}
          </NativeSelect>
        </Field>
      </div>
      <div className="-mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
        {t("form.derived")}:
        <ToneBadge tone={riskLevelTone[derived]}>{te(`RiskLevel.${derived}`)}</ToneBadge>
      </div>
      {props.mode === "create" && (probability === "HIGH" || impact === "HIGH") && (
        <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs font-medium text-warning">
          <AlertTriangle className="mt-px size-4 shrink-0" aria-hidden />
          {t("form.highNotice")}
        </p>
      )}
      <Field label={t("form.mitigation")} htmlFor={id("mitigation")} hint={t("form.mitigationHint")} error={err("mitigation")}>
        <Textarea id={id("mitigation")} name="mitigation" defaultValue={risk?.mitigation ?? ""} rows={3} maxLength={2000} {...aria("mitigation", true)} />
      </Field>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label={t("form.owner")} htmlFor={id("ownerId")} hint={ownersPending ? t("form.ownersLoading") : t("form.ownerHint")} error={err("ownerId")}>
          <NativeSelect
            key={`${scope}-${owners ? "loaded" : "pending"}`}
            id={id("ownerId")}
            name="ownerId"
            defaultValue={risk?.ownerId ?? ""}
            disabled={!scope || (owners === null && ownersPending)}
            aria-busy={ownersPending}
            {...aria("ownerId", true)}
          >
            <option value="">{t("form.ownerNone")}</option>
            {ownerList.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}{o.role ? ` · ${te(`Role.${o.role}` as never)}` : ""}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t("form.reviewDate")} htmlFor={id("reviewDate")} hint={t("form.reviewHint")} error={err("reviewDate")}>
          <Input id={id("reviewDate")} name="reviewDate" type="date" defaultValue={risk?.reviewDate ?? ""} {...aria("reviewDate", true)} />
        </Field>
      </div>
      {risk && risk.status !== "CLOSED" && (
        <Field label={t("form.status")} htmlFor={id("status")} error={err("status")}>
          <NativeSelect id={id("status")} name="status" defaultValue={risk.status} {...aria("status")}>
            <option value="OPEN">{te("RiskStatus.OPEN")}</option>
            <option value="MITIGATING">{te("RiskStatus.MITIGATING")}</option>
          </NativeSelect>
        </Field>
      )}
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" size="lg" />}>{tc("cancel")}</DialogClose>
        <SubmitButton pending={pending} pendingLabel={t("form.pending")}>{props.mode === "create" ? t("form.submitCreate") : t("form.submitEdit")}</SubmitButton>
      </DialogFooter>
    </form>
  );
}

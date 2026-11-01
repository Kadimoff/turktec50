"use client";

import { useActionState, useEffect, useId, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect, SubmitButton } from "@/components/shared/form";
import { ToneBadge } from "@/components/shared/tone-badge";
import { riskLevelTone } from "@/lib/tones";
import { loadOwnerOptions, saveRisk } from "@/app/(app)/risks/actions";
import { initialActionState, type ActionState } from "@/components/documents/types";
import { RISK_LEVELS, riskLevel } from "./level";
import type { OwnerOption, RiskFormValue, ScopeOption } from "./types";

type Props =
  | { mode: "create"; scopes: ScopeOption[]; defaultScope?: string; risk?: undefined }
  | { mode: "edit"; risk: RiskFormValue; scopes?: undefined; defaultScope?: undefined };

export function RiskFormDialog(props: Props) {
  const t = useTranslations("risks");
  const te = useTranslations("enums");
  const tc = useTranslations("common.actions");
  const uid = useId();
  const id = (s: string) => `${uid}-${s}`;
  const risk = props.risk;
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState(risk?.scope ?? props.defaultScope ?? (props.scopes?.length === 1 ? props.scopes[0]!.value : ""));
  const [probability, setProbability] = useState<string>(risk?.probability ?? "MEDIUM");
  const [impact, setImpact] = useState<string>(risk?.impact ?? "MEDIUM");
  const [owners, setOwners] = useState<OwnerOption[] | null>(null);
  const [ownersPending, startOwners] = useTransition();
  const cache = useRef(new Map<string, OwnerOption[]>());

  useEffect(() => {
    if (!open || !scope) return;
    const hit = cache.current.get(scope);
    startOwners(async () => {
      const list = hit ?? (await loadOwnerOptions(scope));
      cache.current.set(scope, list);
      setOwners(list);
    });
  }, [open, scope]);

  const [state, formAction] = useActionState(async (prev: ActionState, fd: FormData) => {
    const res = await saveRisk(prev, fd);
    if (res.ok) {
      toast.success(t((res.message ?? "toast.updated") as never));
      setOpen(false);
    } else {
      toast.error(t((res.message ?? "errors.generic") as never));
    }
    return res;
  }, initialActionState);
  const err = (k: string) => (!state.ok && state.errors?.[k] ? t(state.errors[k] as never) : undefined);

  const derived = riskLevel(probability, impact);
  const ownerList: OwnerOption[] = [...(owners ?? [])];
  if (risk?.ownerId && risk.ownerName && !ownerList.some((o) => o.id === risk.ownerId)) {
    ownerList.unshift({ id: risk.ownerId, name: risk.ownerName, role: "" });
  }
  const scopeLabel = props.mode === "create" ? props.scopes.find((s) => s.value === scope)?.label : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && props.mode === "create") {
          setProbability("MEDIUM");
          setImpact("MEDIUM");
        }
      }}
    >
      {props.mode === "create" ? (
        <DialogTrigger render={<Button className="h-9" />}>
          <Plus aria-hidden />
          {t("form.create")}
        </DialogTrigger>
      ) : (
        <DialogTrigger
          render={<Button size="icon-sm" variant="ghost" className="size-8 text-muted-foreground hover:text-foreground" aria-label={t("actions.editLabel", { title: props.risk.title })} />}
        >
          <Pencil aria-hidden />
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{props.mode === "create" ? t("form.createTitle") : t("form.editTitle")}</DialogTitle>
          <DialogDescription>{t("form.dialogDescription")}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          {risk && <input type="hidden" name="riskId" value={risk.id} />}
          {props.mode === "create" && props.scopes.length > 1 ? (
            <Field label={t("form.scope")} htmlFor={id("scope")} required error={err("scope")}>
              <NativeSelect id={id("scope")} name="scope" aria-invalid={!!err("scope")} value={scope} onChange={(e) => { setOwners(null); setScope(e.target.value); }} required className="h-9">
                <option value="" disabled>{t("form.chooseProject")}</option>
                {props.scopes.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </NativeSelect>
            </Field>
          ) : (
            <>
              <input type="hidden" name="scope" aria-invalid={!!err("scope")} value={scope} />
              {scopeLabel && <p className="text-xs text-muted-foreground">{t("form.scope")}: <span className="font-medium text-foreground">{scopeLabel}</span></p>}
            </>
          )}
          <Field label={t("form.title")} htmlFor={id("title")} required hint={t("form.titleHint")} error={err("title")}>
            <Input id={id("title")} name="title" defaultValue={risk?.title} required minLength={3} maxLength={160} className="h-9" aria-invalid={!!err("title")} />
          </Field>
          <Field label={t("form.description")} htmlFor={id("description")} hint={t("form.descriptionHint")}>
            <Textarea id={id("description")} name="description" defaultValue={risk?.description ?? ""} rows={2} maxLength={2000} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("form.probability")} htmlFor={id("p")} required>
              <NativeSelect id={id("p")} name="probability" value={probability} onChange={(e) => setProbability(e.target.value)} className="h-9">
                {RISK_LEVELS.map((l) => <option key={l} value={l}>{te(`RiskLevel.${l}`)}</option>)}
              </NativeSelect>
            </Field>
            <Field label={t("form.impact")} htmlFor={id("i")} required>
              <NativeSelect id={id("i")} name="impact" value={impact} onChange={(e) => setImpact(e.target.value)} className="h-9">
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
          <Field label={t("form.mitigation")} htmlFor={id("mitigation")} hint={t("form.mitigationHint")}>
            <Textarea id={id("mitigation")} name="mitigation" defaultValue={risk?.mitigation ?? ""} rows={3} maxLength={2000} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("form.owner")} htmlFor={id("owner")} hint={ownersPending ? t("form.ownersLoading") : t("form.ownerHint")} error={err("ownerId")}>
              <NativeSelect
                key={`${scope}-${owners ? "loaded" : "pending"}`}
                id={id("owner")}
                name="ownerId"
                aria-invalid={!!err("ownerId")}
                defaultValue={risk?.ownerId ?? ""}
                disabled={!scope || (owners === null && ownersPending)}
                aria-busy={ownersPending}
                className="h-9"
              >
                <option value="">{t("form.ownerNone")}</option>
                {ownerList.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}{o.role ? ` · ${te(`Role.${o.role}` as never)}` : ""}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t("form.reviewDate")} htmlFor={id("review")} hint={t("form.reviewHint")} error={err("reviewDate")}>
              <Input id={id("review")} name="reviewDate" type="date" aria-invalid={!!err("reviewDate")} defaultValue={risk?.reviewDate ?? ""} className="h-9" />
            </Field>
          </div>
          {risk && risk.status !== "CLOSED" && (
            <Field label={t("form.status")} htmlFor={id("status")}>
              <NativeSelect id={id("status")} name="status" defaultValue={risk.status} className="h-9">
                <option value="OPEN">{te("RiskStatus.OPEN")}</option>
                <option value="MITIGATING">{te("RiskStatus.MITIGATING")}</option>
              </NativeSelect>
            </Field>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <SubmitButton pendingLabel={t("form.pending")}>{props.mode === "create" ? t("form.submitCreate") : t("form.submitEdit")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

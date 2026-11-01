"use client";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/shared/form";
import {
  deleteApplicationPermanently, deleteProjectPermanently, deleteUserPermanently, wipeProgramData, type SystemResult,
} from "@/app/(app)/admin/system/actions";

type Option = { id: string; code: string; label: string };

function useResultToast() {
  const t = useTranslations("admin.system");
  return (res: SystemResult, okMsg: string) => {
    if (res.ok) toast.success(okMsg);
    else toast.error(t(`errors.${res.error}`));
  };
}

/** Pick a record, retype its code to confirm, delete permanently. */
export function DeleteRecordForm({ kind, options }: { kind: "project" | "application"; options: Option[] }) {
  const t = useTranslations("admin.system");
  const id = useId();
  const router = useRouter();
  const show = useResultToast();
  const [selected, setSelected] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  const target = options.find((o) => o.id === selected);
  const matches = !!target && confirm.trim().toUpperCase() === target.code.toUpperCase();

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!target || !matches) return;
        start(async () => {
          const fn = kind === "project" ? deleteProjectPermanently : deleteApplicationPermanently;
          const res = await fn({ id: target.id, confirm });
          show(res, t(`${kind}.done`, { code: target.code }));
          if (res.ok) {
            setSelected("");
            setConfirm("");
            router.refresh();
          }
        });
      }}
    >
      <Field label={t(`${kind}.select`)} htmlFor={`${id}-sel`}>
        <NativeSelect id={`${id}-sel`} value={selected} onChange={(e) => { setSelected(e.target.value); setConfirm(""); }}>
          <option value="">{t("choose")}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.code} — {o.label}</option>
          ))}
        </NativeSelect>
      </Field>
      <Field
        label={t("confirmLabel", { value: target?.code ?? "…" })}
        htmlFor={`${id}-confirm`}
        hint={t(`${kind}.hint`)}
      >
        <Input id={`${id}-confirm`} value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={!target} autoComplete="off" spellCheck={false} />
      </Field>
      <div>
        <Button type="submit" variant="destructive" disabled={!matches || pending} aria-busy={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
          {t(`${kind}.button`)}
        </Button>
      </div>
    </form>
  );
}

export function WipeForm({ phrase }: { phrase: string }) {
  const t = useTranslations("admin.system");
  const id = useId();
  const router = useRouter();
  const show = useResultToast();
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  const matches = confirm.trim() === phrase;
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!matches) return;
        start(async () => {
          const res = await wipeProgramData({ confirm });
          show(res, t("wipe.done", { count: res.ok ? res.count ?? 0 : 0 }));
          if (res.ok) {
            setConfirm("");
            router.refresh();
          }
        });
      }}
    >
      <Field label={t("confirmLabel", { value: phrase })} htmlFor={`${id}-wipe`} hint={t("wipe.hint")}>
        <Input id={`${id}-wipe`} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" spellCheck={false} className="font-mono" />
      </Field>
      <div>
        <Button type="submit" variant="destructive" disabled={!matches || pending} aria-busy={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
          {t("wipe.button")}
        </Button>
      </div>
    </form>
  );
}

/** Used from the users list (root only): retype the e-mail to delete permanently. */
export function DeleteUserForm({ userId, email, onDone }: { userId: string; email: string; onDone?: () => void }) {
  const t = useTranslations("admin.system");
  const id = useId();
  const router = useRouter();
  const show = useResultToast();
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  const matches = confirm.trim().toLowerCase() === email.toLowerCase();
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!matches) return;
        start(async () => {
          const res = await deleteUserPermanently({ id: userId, confirm });
          show(res, t("user.done", { email }));
          if (res.ok) {
            onDone?.();
            router.refresh();
          }
        });
      }}
    >
      <Field label={t("confirmLabel", { value: email })} htmlFor={`${id}-del`} hint={t("user.hint")}>
        <Input id={`${id}-del`} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" spellCheck={false} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" variant="destructive" disabled={!matches || pending} aria-busy={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
          {t("user.button")}
        </Button>
      </div>
    </form>
  );
}

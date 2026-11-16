"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertCircle, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field, SubmitButton } from "@/components/shared/form";
import { useFormAction } from "@/components/shared/use-form-action";
import { fmtDateTime } from "@/lib/format";
import { ToneBadge } from "@/components/shared/tone-badge";
import { intakeTone } from "@/lib/tones";
import { lookupIntake } from "@/app/(public)/apply/actions";
import type { LookupState } from "./types";

/** Code + captain e-mail → read-only status and dates (no members, notes or link). */
export function LookupForm() {
  const t = useTranslations("intake");
  const te = useTranslations("enums");
  const locale = useLocale();
  const uid = useId();
  const id = (s: string) => `${uid}-${s}`;
  const { state, pending, onSubmit, error } = useFormAction<LookupState>(lookupIntake);
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const err = (k: string) => (error(k) ? t(error(k) as never) : undefined);
  const formError = !state.ok && state.message && state.message !== "errors.fix" ? t(state.message as never) : undefined;
  const when = (iso: string | undefined) => (iso ? fmtDateTime(iso, locale) : "—");

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-xl border bg-card p-4 shadow-card sm:p-5">
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field label={t("lookup.code")} htmlFor={id("code")} required hint={t("lookup.codeHint")} error={err("code")}>
            <Input
              id={id("code")}
              name="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              maxLength={20}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-invalid={!!err("code")}
              aria-describedby={err("code") ? id("code-error") : id("code-hint")}
              className="h-10 font-mono"
            />
          </Field>
          <Field label={t("lookup.email")} htmlFor={id("email")} required error={err("email")}>
            <Input
              id={id("email")}
              name="email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={160}
              autoComplete="email"
              spellCheck={false}
              aria-invalid={!!err("email")}
              aria-describedby={err("email") ? id("email-error") : undefined}
              className="h-10"
            />
          </Field>
        </div>
        {formError && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{formError}</span>
          </p>
        )}
        <div className="flex justify-end">
          <SubmitButton pending={pending} className="h-10 px-4" pendingLabel={t("lookup.pending")}>{t("lookup.submit")}</SubmitButton>
        </div>
      </form>

      {state.ok && state.status && (
        <section aria-labelledby={id("result")} aria-live="polite" className="space-y-4 rounded-xl border bg-card p-4 shadow-card sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id={id("result")} className="font-mono text-lg font-bold">{state.code}</h2>
            <ToneBadge tone={intakeTone[state.status] ?? "neutral"}>{te(`IntakeStatus.${state.status}` as never)}</ToneBadge>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">{t("lookup.submittedAt")}</dt>
              <dd className="font-medium">{when(state.submittedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("lookup.changedAt")}</dt>
              <dd className="font-medium">{when(state.changedAt)}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">{t(`status.info.${state.status}` as never)}</p>
          <p className="flex items-start gap-2 rounded-lg border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
            <Eye className="mt-px size-4 shrink-0" aria-hidden />
            <span>{t("lookup.readOnly")}</span>
          </p>
        </section>
      )}
    </div>
  );
}

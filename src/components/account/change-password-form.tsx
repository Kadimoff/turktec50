"use client";
import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field, SubmitButton } from "@/components/shared/form";
import { useFormAction } from "@/components/shared/use-form-action";
import { changePassword } from "@/app/actions/auth";

/** Current + new + confirmation. On success the action redirects to the dashboard. */
export function ChangePasswordForm({ email, min }: { email: string; min: number }) {
  const t = useTranslations("auth");
  const { state, pending, onSubmit, error } = useFormAction(changePassword);
  const msg = (key: string | undefined) => (key ? t(key as never, { min } as never) : undefined);
  const fieldKeys = new Set(Object.values(state.errors ?? {}));
  const formError = !state.ok && state.message && !fieldKeys.has(state.message) ? msg(state.message) : undefined;
  const described = (id: string, hint?: boolean) => (error(id) ? `${id}-error` : hint ? `${id}-hint` : undefined);

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {/* lets password managers attach the new password to the right account */}
      <input type="text" name="username" value={email} autoComplete="username" readOnly hidden />
      <Field label={t("account.current")} htmlFor="current" required error={msg(error("current"))}>
        <Input
          id="current" name="current" type="password" autoComplete="current-password" required className="h-10"
          aria-invalid={!!error("current")} aria-describedby={described("current")}
        />
      </Field>
      <Field label={t("account.new")} htmlFor="password" required hint={t("account.newHint", { min })} error={msg(error("password"))}>
        <Input
          id="password" name="password" type="password" autoComplete="new-password" required minLength={min} className="h-10"
          aria-invalid={!!error("password")} aria-describedby={described("password", true)}
        />
      </Field>
      <Field label={t("account.confirm")} htmlFor="confirm" required error={msg(error("confirm"))}>
        <Input
          id="confirm" name="confirm" type="password" autoComplete="new-password" required className="h-10"
          aria-invalid={!!error("confirm")} aria-describedby={described("confirm")}
        />
      </Field>
      {formError && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{formError}</span>
        </p>
      )}
      <SubmitButton pending={pending} pendingLabel={t("account.pending")} className="h-10 w-full">
        {t("account.submit")}
      </SubmitButton>
    </form>
  );
}

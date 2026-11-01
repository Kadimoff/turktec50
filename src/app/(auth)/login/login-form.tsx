"use client";
import { useActionState, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Briefcase, Gavel, ShieldCheck, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field, SubmitButton } from "@/components/shared/form";
import { login, type LoginState } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

export const DEMO_PASSWORD = "Demo2026!";
const DEMO = [
  { role: "ADMIN", email: "koordinator@turktech50.az", icon: ShieldCheck },
  { role: "TEAM", email: "rena.mammadli@student.asoiu.az", icon: Briefcase },
  { role: "MENTOR", email: "elvin.quliyev@mentor.turktech50.az", icon: Users },
  { role: "JURY", email: "sebine.kerimova@jury.turktech50.az", icon: Gavel },
] as const;

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("auth");
  const te = useTranslations("enums.Role");
  const [state, action] = useActionState<LoginState, FormData>(login, undefined);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <form ref={formRef} action={action} className="mt-8 grid gap-4" noValidate>
        {next && <input type="hidden" name="next" value={next} />}
        <Field label={t("email")} htmlFor="email" required>
          <Input id="email" name="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" />
        </Field>
        <Field label={t("password")} htmlFor="password" required error={state?.error ? t(state.error) : undefined}>
          <Input
            id="password" name="password" type="password" autoComplete="current-password" required value={password}
            onChange={(e) => setPassword(e.target.value)} className="h-10" aria-invalid={!!state?.error}
            aria-describedby={state?.error ? "password-error" : undefined}
          />
        </Field>
        <SubmitButton className="h-10 w-full" pendingLabel={t("signingIn")}>{t("signIn")}</SubmitButton>
      </form>

      <section className="mt-8" aria-labelledby="demo-accounts">
        <div className="flex items-center gap-3">
          <h2 id="demo-accounts" className="text-xs font-semibold tracking-wide text-muted-foreground">{t("demoAccounts")}</h2>
          <span className="h-px flex-1 bg-border" aria-hidden />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{t("demoHint")}</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DEMO.map(({ role, email: e, icon: Icon }) => (
            <button
              key={role}
              type="button"
              onClick={() => {
                setEmail(e);
                setPassword(DEMO_PASSWORD);
                requestAnimationFrame(() => formRef.current?.requestSubmit());
              }}
              className={cn(
                "group flex min-h-14 items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-left transition-colors duration-150",
                "hover:border-primary/50 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              )}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground group-hover:bg-card" aria-hidden>
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{te(role)}</span>
                <span className="block truncate text-xs text-muted-foreground">{t(`roleHint.${role}`)}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

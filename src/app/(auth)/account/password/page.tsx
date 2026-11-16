import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, LogOut, ShieldAlert } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PASSWORD_MIN } from "@/lib/passwords";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher, ThemeToggle } from "@/components/shell/topbar-controls";
import { ChangePasswordForm } from "@/components/account/change-password-form";

export async function generateMetadata() {
  const t = await getTranslations("auth.account");
  return { title: t("title") };
}

/** Own password change. Outside the app shell: users with a generated temporary password are sent here before anything else. */
export default async function ChangePasswordPage() {
  const user = await requireUser();
  const [t, tc] = await Promise.all([getTranslations("auth"), getTranslations("common")]);
  const forced = user.mustChangePassword;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="flex items-center justify-between p-4 sm:p-6">
        <span className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">T50</span>
          <span className="text-sm font-bold">{tc("appName")}</span>
        </span>
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pb-12 sm:items-center sm:px-8">
        <div className="w-full max-w-md">
          {!forced && (
            <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-3.5" aria-hidden />
              {t("account.back")}
            </Link>
          )}
          <h1 className="text-2xl font-bold tracking-tight">{t("account.title")}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t("account.subtitle", { email: user.email })}</p>
          {forced && (
            <p className="mt-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2.5 text-sm text-warning">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{t("account.forced")}</span>
            </p>
          )}
          <div className="mt-6 rounded-xl border bg-card p-4 shadow-card sm:p-5">
            <ChangePasswordForm email={user.email} min={PASSWORD_MIN} />
          </div>
          <form action={logout} className="mt-4 flex justify-center">
            <Button type="submit" variant="ghost" size="lg" className="text-muted-foreground">
              <LogOut aria-hidden />
              {tc("user.logout")}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}

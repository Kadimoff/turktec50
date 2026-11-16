import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FlaskConical, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher, ThemeToggle } from "@/components/shell/topbar-controls";
import { getCurrentUser } from "@/lib/auth";

/** Public student pages (/apply…): no session needed; a signed-in user may open them too. */
export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const [tc, t, user] = await Promise.all([getTranslations("common"), getTranslations("intake.layout"), getCurrentUser()]);
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-3 px-4">
          <Link
            href="/apply"
            className="flex min-w-0 items-center gap-2 rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            aria-label={t("home")}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">T50</span>
            <span className="min-w-0">
              <span className="block truncate text-sm leading-tight font-bold">{tc("appName")}</span>
              <span className="hidden truncate text-2xs leading-tight text-muted-foreground sm:block">{tc("university")}</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            {user && (
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2" nativeButton={false} render={<Link href="/dashboard" />}>
                <LayoutDashboard aria-hidden />
                <span className="hidden sm:inline">{t("panel")}</span>
                <span className="sr-only sm:hidden">{t("panel")}</span>
              </Button>
            )}
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:py-10">{children}</main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-5 text-xs text-muted-foreground">
          <nav aria-label={t("footerNav")} className="flex flex-wrap gap-x-4 gap-y-2">
            <Link href="/apply" className="rounded-sm hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">{t("apply")}</Link>
            <Link href="/apply/lookup" className="rounded-sm hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">{t("lookup")}</Link>
            {!user && (
              <Link href="/login" className="rounded-sm hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">{t("staff")}</Link>
            )}
          </nav>
          <p>{t("contact", { office: tc("university") })}</p>
          <p className="flex items-start gap-2">
            <FlaskConical className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>{tc("demoNotice")}</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

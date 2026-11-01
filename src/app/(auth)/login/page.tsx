import { getTranslations } from "next-intl/server";
import { CheckCircle2 } from "lucide-react";
import { LoginForm } from "./login-form";
import { LocaleSwitcher, ThemeToggle } from "@/components/shell/topbar-controls";
import { KPI_TARGETS, PROGRAM } from "@/lib/constants";

export const metadata = { title: "Login" };

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const [t, tc] = await Promise.all([getTranslations("auth"), getTranslations("common")]);
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-sidebar text-sidebar-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(currentColor_1px,transparent_1px),linear-gradient(90deg,currentColor_1px,transparent_1px)] [background-size:44px_44px]" />
        <div aria-hidden className="pointer-events-none absolute -right-24 -bottom-24 size-[28rem] rounded-full bg-sidebar-primary/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-sidebar-primary text-sm font-extrabold text-sidebar-primary-foreground">T50</span>
          <div>
            <p className="text-base font-bold tracking-wide text-white">{tc("appName")}</p>
            <p className="text-xs tracking-wide text-sidebar-foreground/75">{tc("university")}</p>
          </div>
        </div>
        <div className="relative max-w-lg space-y-6">
          <p className="text-xs font-semibold tracking-wide text-sidebar-primary">TÜRK FORUM 2026</p>
          <h2 className="text-4xl leading-tight font-bold text-balance text-white">{tc("academy")}</h2>
          <ul className="space-y-3">
            {(["f1", "f2", "f3"] as const).map((k) => (
              <li key={k} className="flex items-start gap-3 text-[15px]">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-sidebar-primary" aria-hidden />
                <span>{t(`features.${k}`)}</span>
              </li>
            ))}
          </ul>
        </div>
        <dl className="relative grid grid-cols-3 gap-4 border-t border-sidebar-border pt-6">
          {[
            [KPI_TARGETS.teamsAccepted, t("stats.teams")],
            [KPI_TARGETS.prototypes, t("stats.prototypes")],
            [PROGRAM.incubationWeeks, t("stats.weeks")],
          ].map(([v, l]) => (
            <div key={String(l)}>
              <dt className="sr-only">{l}</dt>
              <dd className="tabular text-3xl font-bold text-white">{v}</dd>
              <dd className="mt-1 text-xs text-sidebar-foreground/80">{l}</dd>
            </div>
          ))}
        </dl>
      </aside>
      <main className="flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6">
          <span className="flex items-center gap-2 lg:invisible">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-xs font-extrabold text-primary-foreground">T50</span>
            <span className="text-sm font-bold">{tc("appName")}</span>
          </span>
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-12 sm:px-8">
          <div className="w-full max-w-md">
            <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{t("subtitle")}</p>
            <LoginForm next={next} />
            <p className="mt-8 text-xs text-muted-foreground">{tc("demoNotice")}</p>
          </div>
        </div>
      </main>
    </div>
  );
}

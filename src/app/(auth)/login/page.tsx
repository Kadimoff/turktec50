import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
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
      <aside className="relative hidden overflow-hidden bg-sidebar gradient-brand text-sidebar-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(currentColor_1px,transparent_1px),linear-gradient(90deg,currentColor_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">T50</span>
          <div>
            <p className="text-base font-bold text-white">{tc("appName")}</p>
            <p className="text-xs text-sidebar-foreground/75">{tc("university")}</p>
          </div>
        </div>
        <div className="relative max-w-lg space-y-6">
          <p className="text-xs font-semibold text-sidebar-primary">TÜRK FORUM 2026</p>
          <h2 className="text-4xl leading-tight font-bold text-balance text-white">{tc("academy")}</h2>
          <ul className="space-y-3">
            {(["f1", "f2", "f3"] as const).map((k) => (
              <li key={k} className="flex items-start gap-3 text-base">
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
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">T50</span>
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
            <div className="mt-6 rounded-xl border bg-card p-4 shadow-card">
              <Link href="/apply" className="group flex items-center justify-between gap-3 rounded-md text-sm font-semibold text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                {t("applyCta")}
                <ArrowRight className="size-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">{t("applyHint")}</p>
            </div>
            <p className="mt-8 text-xs text-muted-foreground">{tc("demoNotice")}</p>
          </div>
        </div>
      </main>
    </div>
  );
}

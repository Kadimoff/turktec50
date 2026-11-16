"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, CircleCheck, Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyLink } from "./copy-link";

/** Shown once after a successful submission: code + absolute private tracking link (no e-mails are sent). */
export function IntakeSuccess({ code, path, link, onAnother }: { code: string; path: string; link: string | null; onAnother?: () => void }) {
  const t = useTranslations("intake.success");
  // The server builds the link from the request host; fall back to the address bar's origin.
  const absolute = link ?? `${window.location.origin}${path}`;
  return (
    <section aria-labelledby="intake-success-title" className="space-y-5 rounded-xl border bg-card p-5 shadow-card sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success-soft text-success" aria-hidden>
          <CircleCheck className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id="intake-success-title" className="text-xl font-bold tracking-tight">{t("title")}</h2>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">{t("body")}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/40 p-4">
        <p className="text-xs font-semibold text-muted-foreground">{t("code")}</p>
        <p className="tabular mt-1 font-mono text-2xl font-bold">{code}</p>
      </div>

      <CopyLink link={absolute} label={t("link")} />

      <div role="note" className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning-soft p-4 text-warning">
        <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="min-w-0 space-y-1 text-sm">
          <p className="font-semibold">{t("saveTitle")}</p>
          <p className="text-pretty">{t("saveBody")}</p>
          <p className="text-pretty">{t("lostHint")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {onAnother && (
          <Button type="button" variant="outline" className="h-10" onClick={onAnother}>
            <Plus aria-hidden />
            {t("another")}
          </Button>
        )}
        <Button className="h-10 px-4" nativeButton={false} render={<Link href={path} />}>
          {t("open")}
          <ArrowRight aria-hidden />
        </Button>
      </div>
    </section>
  );
}

import { getTranslations } from "next-intl/server";
import { Ban, CheckCircle2, FileCheck2, Lock, ShieldAlert } from "lucide-react";
import { UPLOAD } from "@/lib/constants";
import { fmtBytes } from "@/lib/format";

/** Explainer: which annexes fit, which are conditional (real evidence only), confidentiality and file rules. */
export async function AnnexGuide({ jury }: { jury: boolean }) {
  const t = await getTranslations("documents.guide");
  return (
    <div className="space-y-4">
      {!jury && (
        <section className="rounded-xl border bg-card p-4 shadow-card" aria-labelledby="annex-guide-title">
          <h3 id="annex-guide-title" className="text-sm font-semibold">{t("title")}</h3>
          <p className="mt-3 text-xs font-semibold tracking-wide text-muted-foreground">{t("fitTitle")}</p>
          <ul className="mt-2 space-y-1.5 text-[13px]">
            {(["fit1", "fit2", "fit3"] as const).map((k) => (
              <li key={k} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                <span>{t(k)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs font-semibold tracking-wide text-muted-foreground">{t("conditionalTitle")}</p>
          <ul className="mt-2 space-y-1.5 text-[13px]">
            {(["cond1", "cond2", "cond3"] as const).map((k) => (
              <li key={k} className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                <span>{t(k)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
            <Ban className="mt-px size-3.5 shrink-0" aria-hidden />
            {t("never")}
          </p>
        </section>
      )}
      <section className="rounded-xl border bg-card p-4 shadow-card" aria-labelledby="annex-conf-title">
        <h3 id="annex-conf-title" className="flex items-center gap-2 text-sm font-semibold">
          <Lock className="size-4 text-warning" aria-hidden />
          {t("confidentialTitle")}
        </h3>
        <p className="mt-2 text-[13px] text-pretty text-muted-foreground">{jury ? t("juryConfidential") : t("confidentialBody")}</p>
      </section>
      {!jury && (
        <section className="rounded-xl border bg-card p-4 shadow-card" aria-labelledby="annex-rules-title">
          <h3 id="annex-rules-title" className="flex items-center gap-2 text-sm font-semibold">
            <FileCheck2 className="size-4 text-primary" aria-hidden />
            {t("rulesTitle")}
          </h3>
          <p className="mt-2 text-[13px] text-pretty text-muted-foreground">{t("rulesBody", { size: fmtBytes(UPLOAD.maxBytes) })}</p>
        </section>
      )}
    </div>
  );
}

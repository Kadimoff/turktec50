import { getTranslations } from "next-intl/server";
import { ClipboardList, Eye, ListPlus, NotebookPen } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "before", icon: ClipboardList },
  { key: "after", icon: NotebookPen },
  { key: "followup", icon: ListPlus },
  { key: "visibility", icon: Eye },
] as const;

/** "How mentor notes work" — before → after → follow-up → visibility (T06 prototype). */
export async function NotesExplainer({ className, layout = "stack" }: { className?: string; layout?: "stack" | "row" }) {
  const t = await getTranslations("mentors.explainer");
  return (
    <section aria-labelledby="notes-explainer" className={cn("rounded-xl border bg-card p-5 shadow-card", className)}>
      <h2 id="notes-explainer" className="text-sm font-semibold">
        {t("title")}
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{t("subtitle")}</p>
      <ol className={cn("mt-4 grid gap-4", layout === "row" && "sm:grid-cols-2 xl:grid-cols-4")}>
        {STEPS.map(({ key, icon: Icon }, i) => (
          <li key={key} className="relative flex gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground" aria-hidden>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold">
                <span className="tabular text-muted-foreground">{i + 1}. </span>
                {t(`steps.${key}.title`)}
              </p>
              <p className="mt-0.5 text-xs text-pretty text-muted-foreground">{t(`steps.${key}.body`)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

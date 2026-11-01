import { getTranslations } from "next-intl/server";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGE_ORDER } from "@/lib/constants";

/** Horizontal stage stepper (VALIDATION → SUBMITTED). Text always present; color is not the only cue. */
export async function StageStepper({ stage, label }: { stage: string; label: string }) {
  const te = await getTranslations("enums");
  const idx = STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);
  return (
    <div>
    <ol aria-label={label} className="grid grid-cols-5 gap-1">
      {STAGE_ORDER.map((s, i) => {
        const state = i < idx ? "done" : i === idx ? "current" : "next";
        return (
          <li key={s} aria-current={state === "current" ? "step" : undefined} className="min-w-0">
            <div className={cn("h-1.5 rounded-full", state === "done" && "bg-primary", state === "current" && "bg-primary", state === "next" && "bg-muted")} />
            <div className="mt-2 flex items-start gap-1.5">
              <span
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                  state === "done" && "bg-primary text-primary-foreground",
                  state === "current" && "bg-accent text-accent-foreground ring-2 ring-primary",
                  state === "next" && "bg-muted text-muted-foreground",
                )}
                aria-hidden
              >
                {state === "done" ? <Check className="size-3" /> : i + 1}
              </span>
              <span
                className={cn(
                  "hidden text-xs leading-tight sm:line-clamp-2",
                  state === "current" ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {te(`ProjectStage.${s}`)}
              </span>
              <span className="sr-only sm:hidden">{te(`ProjectStage.${s}`)}</span>
            </div>
          </li>
        );
      })}
    </ol>
    <p aria-hidden className="mt-2 text-xs text-muted-foreground sm:hidden">
      <span className="tabular">{idx + 1}/{STAGE_ORDER.length}</span> · <span className="font-semibold text-foreground">{te(`ProjectStage.${stage}`)}</span>
    </p>
    </div>
  );
}

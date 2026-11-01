import type { getTranslations } from "next-intl/server";
import {
  AlertTriangle, ClipboardCheck, FileInput, FileText, FolderKanban, Gavel, History, ListChecks, LogIn, UserCog, UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { Tone } from "@/lib/tones";
import { toneClasses } from "@/lib/tones";
import { cn } from "@/lib/utils";

type T = Awaited<ReturnType<typeof getTranslations>>;

/** Translated action ("task.create" → audit.actions.task.create), falling back to the raw key. */
export function actionLabel(t: T, action: string) {
  const k = `actions.${action}`;
  return t.has(k as never) ? t(k as never) : action;
}

export function entityLabel(t: T, entity: string) {
  const k = `entities.${entity}`;
  return t.has(k as never) ? t(k as never) : entity;
}

const groupIcon: Record<string, LucideIcon> = {
  auth: LogIn, application: FileInput, project: FolderKanban, task: ListChecks, session: UsersRound, document: FileText,
  checklist: ClipboardCheck, risk: AlertTriangle, evaluation: Gavel, user: UserCog, stage: History,
};
const groupTone: Record<string, Tone> = {
  auth: "neutral", application: "info", project: "brand", task: "info", session: "success", document: "neutral",
  checklist: "success", risk: "danger", evaluation: "warning", user: "brand", stage: "brand",
};

export function groupOf(action: string) {
  return action.split(".")[0] ?? action;
}

/** Small toned icon tile for an action group (decorative; the label is always rendered next to it). */
export function ActionIcon({ action, className }: { action: string; className?: string }) {
  const g = groupOf(action);
  const Icon = groupIcon[g] ?? History;
  return (
    <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg", toneClasses[groupTone[g] ?? "neutral"], className)} aria-hidden>
      <Icon className="size-3.5" />
    </span>
  );
}

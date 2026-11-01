import { getTranslations } from "next-intl/server";
import { ToneBadge } from "./tone-badge";
import {
  appStatusTone, checklistTone, healthTone, priorityTone, resultTone, riskLevelTone, riskStatusTone, sessionTone,
  stageTone, taskStatusTone, type Tone,
} from "@/lib/tones";

const maps: Record<string, Record<string, Tone>> = {
  ProjectStage: stageTone, ProjectHealth: healthTone, TaskStatus: taskStatusTone, Priority: priorityTone,
  SessionStatus: sessionTone, ChecklistStatus: checklistTone, RiskLevel: riskLevelTone, RiskStatus: riskStatusTone,
  ApplicationStatus: appStatusTone, CompetitionResult: resultTone,
};

export type EnumName = keyof typeof maps | "Role" | "RubricKind" | "EvaluationStatus" | "ChecklistCategory";

/** Server component: translated + toned badge for any Prisma enum value. */
export async function EnumBadge({ enumName, value, className }: { enumName: EnumName; value: string; className?: string }) {
  const t = await getTranslations("enums");
  const tone = maps[enumName]?.[value] ?? "neutral";
  return (
    <ToneBadge tone={tone} className={className}>
      {t(`${enumName}.${value}` as never)}
    </ToneBadge>
  );
}

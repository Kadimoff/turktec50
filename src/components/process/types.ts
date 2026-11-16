/** Shared, serializable types for the process (workflow) view. */
import type { Role, WorkflowScope, WorkflowStageKind } from "@/generated/prisma/enums";

export type DiagramStage = {
  id: string;
  scope: WorkflowScope;
  systemKey: string | null;
  name: string;
  description: string;
  kind: WorkflowStageKind;
  roles: Role[];
  count: number;
  /** TEAM: own project/application is here */
  mine: boolean;
};

export type StageItem = {
  id: string;
  code: string;
  title: string;
  sub: string;
  href: string | null;
  /** preformatted on the server (no locale/time-zone hydration drift) */
  since: string;
};

export type StreamStat = { key: "sessions" | "tasks" | "checklist" | "risks"; done: number; total: number };
export type FunnelStat = { key: "applicationsEvaluated" | "teamsAccepted" | "prototypes" | "qcPackages" | "finalists"; plan: number; actual: number | null };

export type ProcessData = {
  stages: DiagramStage[];
  items: Record<string, StageItem[]>;
  streams: StreamStat[];
  funnel: FunnelStat[];
  generatedAt: string;
  generatedLabel: string;
};

export const LANES: Role[] = ["TEAM", "ADMIN", "MENTOR", "JURY"];

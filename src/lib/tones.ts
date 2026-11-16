// Map enum values to semantic tones (see globals.css status tokens). Never rely on color alone — always render the label too.
export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "brand";

export const stageTone: Record<string, Tone> = { VALIDATION: "info", PROTOTYPE: "brand", MVP: "brand", QA: "warning", SUBMITTED: "success" };
export const healthTone: Record<string, Tone> = { ON_TRACK: "success", WATCH: "warning", AT_RISK: "danger" };
export const taskStatusTone: Record<string, Tone> = { TODO: "neutral", IN_PROGRESS: "info", REVIEW: "warning", DONE: "success", BLOCKED: "danger" };
export const priorityTone: Record<string, Tone> = { LOW: "neutral", MEDIUM: "warning", HIGH: "danger" };
export const sessionTone: Record<string, Tone> = { PLANNED: "warning", CONFIRMED: "info", COMPLETED: "success", CANCELLED: "neutral" };
export const checklistTone: Record<string, Tone> = { MISSING: "neutral", UPLOADED: "info", IN_REVIEW: "warning", APPROVED: "success", REJECTED: "danger" };
export const riskLevelTone: Record<string, Tone> = { LOW: "success", MEDIUM: "warning", HIGH: "danger" };
export const riskStatusTone: Record<string, Tone> = { OPEN: "danger", MITIGATING: "warning", CLOSED: "success" };
export const appStatusTone: Record<string, Tone> = { SUBMITTED: "neutral", UNDER_REVIEW: "info", ACCEPTED: "success", WAITLIST: "warning", REJECTED: "danger" };
export const evaluationTone: Record<string, Tone> = { DRAFT: "warning", SUBMITTED: "success" };
export const resultTone: Record<string, Tone> = { PENDING: "neutral", FINALIST: "success", NOT_SELECTED: "neutral" };
// Academy
export const ruleStatusTone: Record<string, Tone> = { TRACKING: "info", CHANGED: "warning", CONFIRMED: "success" };
export const registryTone: Record<string, Tone> = { PLANNED: "neutral", ACTIVE: "success", ARCHIVED: "neutral" };
export const labTone: Record<string, Tone> = { AVAILABLE: "success", LIMITED: "warning", CLOSED: "danger" };
export const partnerTone: Record<string, Tone> = { CANDIDATE: "neutral", NEGOTIATING: "info", ACTIVE: "success", ARCHIVED: "neutral" };
export const studentTone: Record<string, Tone> = { CANDIDATE: "neutral", SEEKING_TEAM: "warning", IN_TEAM: "success", ARCHIVED: "neutral" };
export const teamTone: Record<string, Tone> = { FORMING: "info", ACTIVE: "success", ARCHIVED: "neutral" };
export const trainingTone: Record<string, Tone> = { PLANNED: "neutral", REGISTRATION_OPEN: "success", COMPLETED: "info" };
export const resourceTone: Record<string, Tone> = { NEW: "neutral", UNDER_REVIEW: "info", APPROVED: "success", REJECTED: "danger", DONE: "brand" };
export const announcementTone: Record<string, Tone> = { DRAFT: "warning", PUBLISHED: "success" };
export const intakeTone: Record<string, Tone> = {
  SUBMITTED: "info", UNDER_REVIEW: "brand", NEEDS_CHANGES: "warning", ACCEPTED: "success", REJECTED: "danger", WITHDRAWN: "neutral",
};

export const toneClasses: Record<Tone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  neutral: "bg-neutral-soft text-neutral",
  brand: "bg-accent text-accent-foreground",
};

export const toneBar: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-neutral",
  brand: "bg-primary",
};

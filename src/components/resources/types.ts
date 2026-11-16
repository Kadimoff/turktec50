// Client-safe types and rules shared by the resource-request UI and its server actions.

export type ResourceStatusKey = "NEW" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "DONE";

export type ResourceOption = { value: string; label: string };

/** Values to pre-fill the edit dialog (dates as YYYY-MM-DD in program timezone). */
export type ResourceFormValue = {
  id: string;
  title: string;
  details: string;
  labId: string;
  partnerId: string;
  neededBy: string;
  /** labels of the saved lab / partner, used when they are no longer selectable (closed lab, archived partner) */
  labLabel?: string;
  partnerLabel?: string;
};

/**
 * Coordinator decision flow. A human chooses every transition; nothing advances automatically.
 * REJECTED and DONE are final (the team can file a new request).
 */
export const DECISION_FLOW: Record<ResourceStatusKey, ResourceStatusKey[]> = {
  NEW: ["UNDER_REVIEW", "APPROVED", "REJECTED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["DONE"],
  REJECTED: [],
  DONE: [],
};

/** Statuses that need a written decision note (10–1000 characters). */
export const NOTE_REQUIRED: ResourceStatusKey[] = ["APPROVED", "REJECTED"];
export const NOTE_MIN = 10;
export const NOTE_MAX = 1000;

/** Requests that still wait for the coordinator. */
export const OPEN_STATUSES: ResourceStatusKey[] = ["NEW", "UNDER_REVIEW"];

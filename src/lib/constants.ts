// Program-wide constants for TÜRKTECH 50 pilot (ASOIU). Labels are translated via messages (keys only here).

export const LOCALES = ["az", "tr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "az";
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** KPI targets from the Full Project Proposal (section 4 & Annex B). */
export const KPI_TARGETS = {
  applicationsEvaluated: 150,
  teamsAccepted: 100,
  prototypes: 50,
  qcPackages: 50,
  finalists: 10, // pilot target
  finalistsScale: 50, // scale-up target across Turkic world
} as const;

/** Pilot timeline (6 months). The 8-week intensive incubation runs inside months 3–5. */
export const PROGRAM = {
  start: new Date("2026-08-03T00:00:00+04:00"),
  incubationStart: new Date("2026-10-05T00:00:00+04:00"),
  incubationWeeks: 8,
  midtermJury: new Date("2026-11-23T10:00:00+04:00"),
  mockFinal: new Date("2026-12-14T10:00:00+04:00"),
  end: new Date("2027-01-31T23:59:00+04:00"),
} as const;

/** Program phases (proposal section 6). key -> translated common.phases.<key> */
export const PHASES = [
  { key: "prep", month: 1 },
  { key: "selection", month: 2 },
  { key: "dev1", month: 3 },
  { key: "dev2", month: 4 },
  { key: "midterm", month: 5 },
  { key: "final", month: 6 },
] as const;

export function currentWeek(now = new Date()): number {
  const diff = now.getTime() - PROGRAM.incubationStart.getTime();
  const week = Math.floor(diff / (7 * 24 * 3600 * 1000)) + 1;
  return Math.max(0, Math.min(PROGRAM.incubationWeeks, week));
}

export function currentMonth(now = new Date()): number {
  const m = (now.getFullYear() - PROGRAM.start.getFullYear()) * 12 + (now.getMonth() - PROGRAM.start.getMonth()) + 1;
  return Math.max(1, Math.min(6, m));
}

/** Competition / project categories. key -> common.categories.<key> */
export const CATEGORIES = [
  "agritech",
  "edtech",
  "healthtech",
  "energy",
  "smartcity",
  "ai",
  "robotics",
  "aerospace",
  "cybersecurity",
  "fintech",
  "environment",
  "transport",
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Stage order for transitions (ProjectStage enum). */
export const STAGE_ORDER = ["VALIDATION", "PROTOTYPE", "MVP", "QA", "SUBMITTED"] as const;

/**
 * Submission package checklist template (from T06 prototype "Final təqdimat paketi").
 * key -> documents.items.<key>.title / .hint
 */
export const CHECKLIST_TEMPLATE = [
  { key: "final_form", category: "CORE", required: true },
  { key: "budget_plan", category: "CORE", required: true },
  { key: "commitment_form", category: "CORE", required: true },
  { key: "test_evidence", category: "CORE", required: true },
  { key: "demo_video", category: "CORE", required: true },
  { key: "prototype_visuals", category: "ANNEX", required: true },
  { key: "architecture_diagram", category: "ANNEX", required: true },
  { key: "workflow_diagram", category: "ANNEX", required: true },
  { key: "technical_drawing", category: "ANNEX", required: false },
  { key: "references", category: "ANNEX", required: false },
  { key: "survey_results", category: "CONDITIONAL", required: false },
  { key: "support_letter", category: "CONDITIONAL", required: false },
  { key: "patent_info", category: "CONDITIONAL", required: false },
] as const;

/** Rubrics. criterion key -> jury.criteria.<key>.title / .hint ; weights sum to 100 per rubric. */
export const RUBRICS = {
  SELECTION: [
    { key: "problem_relevance", weight: 25 },
    { key: "innovation", weight: 20 },
    { key: "team_fit", weight: 20 },
    { key: "feasibility", weight: 20 },
    { key: "turkic_impact", weight: 15 },
  ],
  MIDTERM: [
    { key: "technical_adequacy", weight: 30 },
    { key: "applicability", weight: 20 },
    { key: "turkic_contribution", weight: 15 },
    { key: "application_completeness", weight: 20 },
    { key: "commercialization_ip", weight: 15 },
  ],
  FINAL: [
    { key: "pitch_clarity", weight: 25 },
    { key: "demo_quality", weight: 25 },
    { key: "qa_handling", weight: 20 },
    { key: "technical_depth", weight: 30 },
  ],
} as const;

/** Upload constraints */
export const UPLOAD = {
  maxBytes: 15 * 1024 * 1024,
  allowedMime: [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "video/mp4",
    "application/zip",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
  ],
} as const;

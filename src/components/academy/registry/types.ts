// Client-safe view models for the Academy registry (faculties, labs, industry partners).
import type { LabStatus, PartnerStatus, RegistryStatus } from "@/generated/prisma/enums";

export const REGISTRY_TABS = ["faculties", "labs", "partners"] as const;
export type RegistryTab = (typeof REGISTRY_TABS)[number];

/** ids linking the URL-driven tablist and its panel */
export const tabId = (tab: RegistryTab) => `registry-tab-${tab}`;
export const PANEL_ID = "registry-panel";

export type RegistryKind = "faculty" | "lab" | "partner";

export const REGISTRY_STATUSES: RegistryStatus[] = ["PLANNED", "ACTIVE", "ARCHIVED"];
export const LAB_STATUSES: LabStatus[] = ["AVAILABLE", "LIMITED", "CLOSED"];
export const PARTNER_STATUSES: PartnerStatus[] = ["CANDIDATE", "NEGOTIATING", "ACTIVE", "ARCHIVED"];

export type UniversityOption = { id: string; shortName: string; name: string; isPartner: boolean };
export type FacultyOption = { id: string; name: string; universityId: string; status: RegistryStatus };

export type FacultyValue = {
  id: string;
  universityId: string;
  name: string;
  coordinator: string | null;
  status: RegistryStatus;
  notes: string | null;
};

export type LabValue = {
  id: string;
  universityId: string;
  facultyId: string | null;
  name: string;
  contact: string | null;
  status: LabStatus;
  notes: string | null;
};

export type PartnerValue = {
  id: string;
  name: string;
  sector: string | null;
  contact: string | null;
  status: PartnerStatus;
  notes: string | null;
};

/** What still points at a record (only zero-usage records may be deleted). Keys are `registry.usage.*` messages. */
export type RegistryUsage = Partial<Record<"students" | "teams" | "projects" | "labs" | "users" | "intakeRequests" | "intakeMembers" | "trainings" | "requests", number>>;

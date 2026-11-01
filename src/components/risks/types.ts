export type OwnerOption = { id: string; name: string; role: string };

/** Serializable risk passed to client components (edit dialog, row actions). */
export type RiskFormValue = {
  id: string;
  title: string;
  description: string | null;
  probability: "LOW" | "MEDIUM" | "HIGH";
  impact: "LOW" | "MEDIUM" | "HIGH";
  mitigation: string | null;
  ownerId: string | null;
  ownerName: string | null;
  reviewDate: string; // yyyy-mm-dd or ""
  status: "OPEN" | "MITIGATING" | "CLOSED";
  scope: string; // "program" or projectId
};

export type ScopeOption = { value: string; label: string };

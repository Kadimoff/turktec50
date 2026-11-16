import type { RuleStatusValue } from "./helpers";

export type OwnerOption = { id: string; name: string };

/** Serializable tracking values for the admin dialog. Dates are yyyy-mm-dd (Asia/Baku) or "". */
export type TrackingFormValue = {
  id: string;
  name: string;
  status: RuleStatusValue | null;
  ownerId: string | null;
  ownerName: string | null;
  ownerActive: boolean;
  checkedAt: string;
  deadline: string;
  finalDate: string;
  sourceUrl: string;
  notes: string;
};

/** One card in the client-side filtered list: filter keys + the server-rendered card. */
export type CatalogItem = {
  id: string;
  theme: string | null;
  status: RuleStatusValue | null;
  /** folded name + sub-categories */
  haystack: string;
  node: React.ReactNode;
};

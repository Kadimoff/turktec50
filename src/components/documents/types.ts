/** Result of a document / risk server action. `message` and `errors` values are translation keys. */
export type ActionState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  ts?: number;
};

export const initialActionState: ActionState = { ok: false };

export type DocVersion = {
  id: string;
  fileName: string;
  size: number;
  version: number;
  confidential: boolean;
  mimeType: string;
  uploadedBy: string | null;
  createdAt: string; // ISO
};

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

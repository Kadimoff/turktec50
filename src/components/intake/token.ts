import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** Secret tracking token for a public intake request. Only the sha256 hash is stored; the raw token lives in the student's link. */
export function newIntakeToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashIntakeToken(token) };
}

export function hashIntakeToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Cheap shape check before touching the database (43 base64url chars). */
export const isIntakeTokenShape = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token);

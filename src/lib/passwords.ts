import "server-only";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";

export const PASSWORD_MIN = 10;

/** No 0/O, 1/l/I: easy to read aloud or copy from a screen. */
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Random temporary password like `k7Qm-x4Rt-Zp9a` (≈ 70 bits). Shown once to the coordinator; the user must change it. */
export function generateTempPassword() {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${group()}-${group()}-${group()}`;
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

/** New password rules (error messages are keys in the `auth` namespace). */
export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN, "errors.passwordShort")
  .max(128, "errors.passwordLong")
  .refine((p) => /[A-Za-zƏəĞğİıÖöŞşÜüÇç]/.test(p) && /\d/.test(p), "errors.passwordWeak");

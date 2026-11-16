import "server-only";
import { Prisma } from "@/generated/prisma/client";

// Shared helpers for "use server" files. Every export of a "use server" file is a public endpoint, so keep helpers here,
// never in the action files themselves.
export { type ActionState, initialActionState, fail, done, zodErrors, failFromZod } from "@/lib/action-state";

/** A string form value, or undefined when missing / not a string (files, absent fields). Trimming is zod's job. */
export function formStr(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  return typeof v === "string" ? v : undefined;
}

/** All string values of a repeated form field (checkbox groups, multi-selects), empty strings dropped. */
export function formStrs(fd: FormData, key: string): string[] {
  return fd.getAll(key).filter((v): v is string => typeof v === "string" && v.length > 0);
}

/** Unique-constraint violation (P2002) — map it to a friendly field error instead of a 500. */
export function isUniqueViolation(e: unknown, field?: string) {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2002") return false;
  if (!field) return true;
  const target = (e.meta as { target?: unknown } | undefined)?.target;
  return Array.isArray(target) ? target.includes(field) : typeof target === "string" ? target.includes(field) : true;
}

/** Throw inside a transaction to roll it back with a user-facing error key (and optional field). */
export class RuleError extends Error {
  constructor(public key: string, public field?: string) {
    super(key);
    this.name = "RuleError";
  }
}

import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { isUniqueViolation } from "@/lib/actions";

// Human-readable sequential codes. Generate inside the creating transaction and wrap the transaction in
// `withUniqueRetry`, so two concurrent creations cannot end with the same code (the second retries).

async function maxSuffix(rows: { code: string }[], prefixLength: number) {
  return rows.reduce((m, r) => Math.max(m, Number.parseInt(r.code.slice(prefixLength), 10) || 0), 0);
}

/** T50-001 */
export async function nextProjectCode(tx: Prisma.TransactionClient) {
  const rows = await tx.project.findMany({ where: { code: { startsWith: "T50-" } }, select: { code: true } });
  return `T50-${String((await maxSuffix(rows, 4)) + 1).padStart(3, "0")}`;
}

/** APP-0001 */
export async function nextApplicationCode(tx: Prisma.TransactionClient) {
  const rows = await tx.application.findMany({ where: { code: { startsWith: "APP-" } }, select: { code: true } });
  return `APP-${String((await maxSuffix(rows, 4)) + 1).padStart(4, "0")}`;
}

/** HZ-0001 (public preparation request) */
export async function nextIntakeCode(tx: Prisma.TransactionClient) {
  const rows = await tx.intakeRequest.findMany({ where: { code: { startsWith: "HZ-" } }, select: { code: true } });
  return `HZ-${String((await maxSuffix(rows, 3)) + 1).padStart(4, "0")}`;
}

/** Run `fn` again (up to `tries` times) when it fails on a unique constraint, e.g. a code taken by a concurrent request. */
export async function withUniqueRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= tries || !isUniqueViolation(e, "code")) throw e;
    }
  }
}

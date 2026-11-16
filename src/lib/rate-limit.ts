import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";

// Database-backed rate limiting: survives restarts and works across instances. The client IP is a SOFT key only
// (X-Forwarded-For can be forged when no trusted proxy sets it), so every limit that matters also has a non-IP key.

export type Limit = { limit: number; windowMs: number };

export const LIMITS = {
  /** failed sign-ins per account (e-mail) */
  loginAccount: { limit: 5, windowMs: 15 * 60_000 },
  /** failed sign-ins per IP (soft) */
  loginIp: { limit: 30, windowMs: 15 * 60_000 },
  /** public intake submissions per IP (soft) */
  intakeIp: { limit: 5, windowMs: 10 * 60_000 },
  /** public intake submissions for the whole site */
  intakeGlobal: { limit: 60, windowMs: 10 * 60_000 },
  /** status lookups per IP (soft) */
  intakeLookupIp: { limit: 10, windowMs: 10 * 60_000 },
} as const satisfies Record<string, Limit>;

const PRUNE_AFTER_MS = 24 * 60 * 60_000;

/** Events in the window for (bucket, key). */
export async function countEvents(bucket: string, key: string, { windowMs }: Pick<Limit, "windowMs">) {
  return prisma.rateEvent.count({ where: { bucket, key, createdAt: { gte: new Date(Date.now() - windowMs) } } });
}

/** Is (bucket, key) under its limit right now? Does not record anything. */
export async function isAllowed(bucket: string, key: string, limit: Limit) {
  return (await countEvents(bucket, key, limit)) < limit.limit;
}

/** Record one event (and occasionally prune old rows). */
export async function recordEvent(bucket: string, key: string) {
  await prisma.rateEvent.create({ data: { bucket, key } });
  if (Math.random() < 0.02) await prisma.rateEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - PRUNE_AFTER_MS) } } });
}

/** Check and, when allowed, record in one call. */
export async function consume(bucket: string, key: string, limit: Limit) {
  if (!(await isAllowed(bucket, key, limit))) return false;
  await recordEvent(bucket, key);
  return true;
}

/** Forget (bucket, key) — e.g. after a successful sign-in. */
export async function resetEvents(bucket: string, key: string) {
  await prisma.rateEvent.deleteMany({ where: { bucket, key } });
}

/** Best-effort client IP (first X-Forwarded-For hop, X-Real-IP, else "unknown"). Soft key only. */
export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "unknown").slice(0, 64);
}

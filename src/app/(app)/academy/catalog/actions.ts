"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { type ActionState, done, fail, failFromZod, formStr } from "@/lib/actions";
import { bakuYmd, parseBakuDate } from "@/lib/dates";
import { revalidateSets } from "@/lib/revalidate";
import { isHttpsUrl, RULE_STATUSES } from "@/components/academy/catalog/helpers";

/** Rule tracking feeds the catalog, deadline panels, calendar, dashboards, competition pickers and the intake review. */
const refresh = () => revalidateSets("catalog", "academy", "calendar", "dashboard", "projects", "teams", "intake");

const ymd = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "errors.date")]);
const trackingSchema = z.object({
  competitionId: z.string().min(1, "errors.notFound"),
  status: z.enum(RULE_STATUSES, "errors.status"),
  ownerId: z.string().min(1, "errors.ownerRequired"),
  checkedAt: ymd,
  deadline: ymd,
  finalDate: ymd,
  sourceUrl: z.string().trim().max(2000, "errors.urlLong"),
  notes: z.string().trim().max(2000, "errors.notesLong"),
});

/** yyyy-mm-dd → instant at the given Baku wall time; null when empty, undefined when not a real calendar date. */
const bakuDate = (value: string, time: string) => (value ? (parseBakuDate(value, time) ?? undefined) : null);

/** Start or edit 2027 rule tracking on a catalog card (ADMIN only). */
export async function saveTracking(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(["ADMIN"]);
  const field = (k: string) => formStr(fd, k) ?? "";
  const parsed = trackingSchema.safeParse({
    competitionId: field("competitionId"),
    status: field("status"),
    ownerId: field("ownerId"),
    checkedAt: field("checkedAt"),
    deadline: field("deadline"),
    finalDate: field("finalDate"),
    sourceUrl: field("sourceUrl"),
    notes: field("notes"),
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const v = parsed.data;

  const comp = await prisma.competition.findUnique({
    where: { id: v.competitionId },
    select: { id: true, name: true, catalogId: true, ruleStatus: true, ruleOwnerId: true, applicationDeadline: true },
  });
  if (!comp) return fail("errors.notFound");
  if (comp.catalogId === null) return fail("errors.notCatalog");

  const errors: Record<string, string> = {};
  // owner: an active ADMIN (keeping an already assigned owner is allowed even if deactivated since)
  if (v.ownerId !== comp.ruleOwnerId) {
    const owner = await prisma.user.findFirst({ where: { id: v.ownerId, role: "ADMIN", active: true }, select: { id: true } });
    if (!owner) errors.ownerId = "errors.owner";
  }
  if (v.sourceUrl && !isHttpsUrl(v.sourceUrl)) errors.sourceUrl = "errors.https";
  if (v.status === "CONFIRMED" && !v.sourceUrl) errors.sourceUrl = "errors.sourceRequired";

  const checkedAt = bakuDate(v.checkedAt, "12:00");
  const deadline = bakuDate(v.deadline, "23:59");
  const finalDate = bakuDate(v.finalDate, "12:00");
  if (checkedAt === undefined) errors.checkedAt = "errors.date";
  else if (v.checkedAt && v.checkedAt > bakuYmd(new Date())) errors.checkedAt = "errors.checkedFuture";
  if (deadline === undefined) errors.deadline = "errors.date";
  if (finalDate === undefined) errors.finalDate = "errors.date";
  else if (v.finalDate && v.deadline && v.finalDate < v.deadline) errors.finalDate = "errors.finalBeforeDeadline";
  if (Object.keys(errors).length) return fail(Object.values(errors)[0]!, errors);

  await prisma.competition.update({
    where: { id: comp.id },
    data: {
      ruleStatus: v.status,
      ruleOwnerId: v.ownerId,
      ruleCheckedAt: checkedAt ?? null,
      applicationDeadline: deadline ?? null,
      finalDate: finalDate ?? null,
      ruleSourceUrl: v.sourceUrl || null,
      ruleNotes: v.notes || null,
    },
  });
  await logAudit({
    actorId: user.id,
    action: "competition.track",
    entity: "Competition",
    entityId: comp.id,
    summary: comp.name,
    meta: {
      from: comp.ruleStatus,
      to: v.status,
      deadline: { from: bakuYmd(comp.applicationDeadline) || null, to: v.deadline || null },
      source: v.sourceUrl || null,
    },
  });
  refresh();
  return done(comp.ruleStatus ? "toast.updated" : "toast.started");
}

/** Stop tracking: clears status, owner, check date, source and notes; the deadline stays (ADMIN only). */
export async function stopTracking(competitionId: string): Promise<ActionState> {
  const user = await requireUser(["ADMIN"]);
  const p = z.string().min(1).safeParse(competitionId);
  if (!p.success) return fail("errors.invalid");
  const comp = await prisma.competition.findUnique({ where: { id: p.data }, select: { id: true, name: true, catalogId: true, ruleStatus: true } });
  if (!comp) return fail("errors.notFound");
  if (comp.catalogId === null) return fail("errors.notCatalog");
  if (!comp.ruleStatus) return fail("errors.notTracked");

  await prisma.competition.update({
    where: { id: comp.id },
    data: { ruleStatus: null, ruleOwnerId: null, ruleCheckedAt: null, ruleSourceUrl: null, ruleNotes: null },
  });
  await logAudit({
    actorId: user.id,
    action: "competition.untrack",
    entity: "Competition",
    entityId: comp.id,
    summary: comp.name,
    meta: { from: comp.ruleStatus, to: null },
  });
  refresh();
  return done("toast.stopped");
}

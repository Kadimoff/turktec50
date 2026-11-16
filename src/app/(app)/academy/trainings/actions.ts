"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { type ActionState, done, fail, failFromZod, formStr } from "@/lib/actions";
import { parseBakuDate } from "@/lib/dates";
import { revalidateSets } from "@/lib/revalidate";

/** Trainings appear on the schedule, the calendar, the Academy overview and the lab registry (upcoming count). */
const refresh = () => revalidateSets("trainings", "calendar", "academy", "registry");

/** Form value with CRLF from <textarea> submissions normalized to LF (so length limits match the browser's). */
const text = (fd: FormData, k: string) => formStr(fd, k)?.replace(/\r\n?/g, "\n");

const schema = z.object({
  id: z.string().trim().optional().transform((v) => v || undefined),
  title: z.string().trim().min(3, "errors.titleShort").max(160, "errors.titleLong"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "errors.date"),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "errors.time"),
  durationMin: z.coerce.number({ message: "errors.duration" }).int("errors.duration").min(15, "errors.duration").max(600, "errors.duration"),
  status: z.enum(["PLANNED", "REGISTRATION_OPEN", "COMPLETED"], { message: "errors.invalid" }),
  mentorId: z.string().trim().optional().transform((v) => v || null),
  labId: z.string().trim().optional().transform((v) => v || null),
  notes: z.string().trim().max(2000, "errors.notesLong").optional().transform((v) => v || null),
});

/** Create or update a training (ADMIN). Date + time are Baku wall-clock (`@/lib/dates`). */
export async function saveTraining(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(["ADMIN"]);
  const parsed = schema.safeParse({
    id: text(fd, "id"), title: text(fd, "title") ?? "", date: text(fd, "date") ?? "", time: text(fd, "time") ?? "",
    durationMin: text(fd, "durationMin") ?? "", status: text(fd, "status"), mentorId: text(fd, "mentorId"), labId: text(fd, "labId"), notes: text(fd, "notes"),
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const v = parsed.data;
  const startsAt = parseBakuDate(v.date, v.time);
  if (!startsAt) return fail("errors.date", { date: "errors.date" });

  const existing = v.id
    ? await prisma.training.findUnique({ where: { id: v.id }, select: { id: true, title: true, status: true, startsAt: true, mentorId: true, labId: true } })
    : null;
  if (v.id && !existing) return fail("errors.notFound");

  // a new mentor must be an active MENTOR; a new lab must not be closed (the current values may stay as they are)
  if (v.mentorId && v.mentorId !== existing?.mentorId) {
    const ok = await prisma.user.findFirst({ where: { id: v.mentorId, role: "MENTOR", active: true }, select: { id: true } });
    if (!ok) return fail("errors.mentor", { mentorId: "errors.mentor" });
  }
  if (v.labId && v.labId !== existing?.labId) {
    const ok = await prisma.lab.findFirst({ where: { id: v.labId, status: { not: "CLOSED" } }, select: { id: true } });
    if (!ok) return fail("errors.lab", { labId: "errors.lab" });
  }

  const data = { title: v.title, startsAt, durationMin: v.durationMin, status: v.status, mentorId: v.mentorId, labId: v.labId, notes: v.notes };
  if (existing) {
    await prisma.training.update({ where: { id: existing.id }, data });
    await logAudit({
      actorId: user.id, action: "training.update", entity: "Training", entityId: existing.id, summary: v.title,
      meta: { status: v.status, startsAt: startsAt.toISOString(), from: { status: existing.status, startsAt: existing.startsAt.toISOString() } },
    });
    refresh();
    return done("toast.updated");
  }
  const row = await prisma.training.create({ data, select: { id: true } });
  await logAudit({ actorId: user.id, action: "training.create", entity: "Training", entityId: row.id, summary: v.title, meta: { status: v.status, startsAt: startsAt.toISOString() } });
  refresh();
  return done("toast.created");
}

export async function deleteTraining(trainingId: string): Promise<ActionState> {
  const user = await requireUser(["ADMIN"]);
  const p = z.string().min(1).safeParse(trainingId);
  if (!p.success) return fail("errors.invalid");
  const row = await prisma.training.findUnique({ where: { id: p.data }, select: { id: true, title: true, status: true, startsAt: true } });
  if (!row) return fail("errors.notFound");
  await prisma.training.delete({ where: { id: row.id } });
  await logAudit({ actorId: user.id, action: "training.delete", entity: "Training", entityId: row.id, summary: row.title, meta: { status: row.status, startsAt: row.startsAt.toISOString() } });
  refresh();
  return done("toast.deleted");
}

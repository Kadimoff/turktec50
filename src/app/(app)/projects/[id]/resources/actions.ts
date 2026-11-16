"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertProjectAccess } from "@/lib/rbac";
import { logAudit, notify } from "@/lib/audit";
import { type ActionState, done, fail, failFromZod, formStr } from "@/lib/actions";
import { bakuYmd, parseBakuDate } from "@/lib/dates";
import { revalidateLayout, revalidateProject, revalidateSets } from "@/lib/revalidate";
import { enumLabelByLocale } from "@/components/projects/server";
import { DECISION_FLOW, NOTE_MAX, NOTE_MIN, NOTE_REQUIRED, type ResourceStatusKey } from "@/components/resources/types";

/** Signed-in user + project access, or null when the project is not visible to them. */
async function guard(projectId: string) {
  const user = await requireUser();
  try {
    const access = await assertProjectAccess(user, projectId);
    return { user, access };
  } catch {
    return null;
  }
}

/** The project's resources tab + overview, the Academy overview (open requests) and the lab registry (open counts). */
function refresh(projectId: string) {
  revalidateProject(projectId, "resources");
  revalidateSets("academy", "registry");
}

// ---------------------------------------------------------------- create / edit (team, mentor, admin)

const saveSchema = z.object({
  projectId: z.string().min(1),
  requestId: z.string().optional(),
  title: z.string().trim().min(3, "errors.titleShort").max(160, "errors.titleLong"),
  details: z.string().trim().max(2000, "errors.detailsLong"),
  labId: z.string().trim(),
  partnerId: z.string().trim(),
  neededBy: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "errors.date")]),
});

export async function saveResourceRequest(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const field = (k: string) => formStr(fd, k) ?? "";
  const parsed = saveSchema.safeParse({
    projectId: field("projectId"),
    requestId: field("requestId") || undefined,
    title: field("title"),
    details: field("details"),
    labId: field("labId"),
    partnerId: field("partnerId"),
    neededBy: field("neededBy"),
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const v = parsed.data;
  const g = await guard(v.projectId);
  if (!g || !g.access.canWork) return fail("errors.forbidden");
  const { user } = g;

  const existing = v.requestId
    ? await prisma.resourceRequest.findFirst({
        where: { id: v.requestId, projectId: v.projectId },
        select: { id: true, status: true, requestedById: true, title: true, details: true, labId: true, partnerId: true, neededBy: true },
      })
    : null;
  if (v.requestId && !existing) return fail("errors.notFound");
  if (existing && existing.requestedById !== user.id) return fail("errors.forbidden");
  if (existing && existing.status !== "NEW") return fail("errors.locked");

  // lab: not CLOSED (an unchanged, meanwhile closed lab may stay); partner: ACTIVE / NEGOTIATING (same rule)
  if (v.labId && v.labId !== existing?.labId) {
    const lab = await prisma.lab.findUnique({ where: { id: v.labId }, select: { status: true } });
    if (!lab || lab.status === "CLOSED") return fail("errors.lab", { labId: "errors.lab" });
  }
  if (v.partnerId && v.partnerId !== existing?.partnerId) {
    const partner = await prisma.partner.findUnique({ where: { id: v.partnerId }, select: { status: true } });
    if (!partner || (partner.status !== "ACTIVE" && partner.status !== "NEGOTIATING")) return fail("errors.partner", { partnerId: "errors.partner" });
  }
  const neededBy = v.neededBy ? parseBakuDate(v.neededBy) : null;
  if (v.neededBy && !neededBy) return fail("errors.date", { neededBy: "errors.date" });
  const unchangedDate = !!existing?.neededBy && !!v.neededBy && bakuYmd(existing.neededBy) === v.neededBy;
  if (neededBy && !unchangedDate && v.neededBy < bakuYmd(new Date())) return fail("errors.datePast", { neededBy: "errors.datePast" });

  const data = {
    title: v.title,
    details: v.details || null,
    labId: v.labId || null,
    partnerId: v.partnerId || null,
    neededBy,
  };

  if (existing) {
    // conditional write: the request must still be the requester's own NEW request (a decision may have landed meanwhile)
    const res = await prisma.resourceRequest.updateMany({ where: { id: existing.id, status: "NEW", requestedById: user.id }, data });
    if (res.count !== 1) return fail("errors.changed");
    await logAudit({
      actorId: user.id,
      action: "resource.update",
      entity: "ResourceRequest",
      entityId: existing.id,
      projectId: v.projectId,
      summary: v.title,
      meta: {
        from: { title: existing.title, labId: existing.labId, partnerId: existing.partnerId, neededBy: existing.neededBy ? bakuYmd(existing.neededBy) : null },
        to: { title: v.title, labId: data.labId, partnerId: data.partnerId, neededBy: v.neededBy || null },
      },
    });
    refresh(v.projectId);
    return done("toast.updated");
  }

  const created = await prisma.resourceRequest.create({
    data: { ...data, projectId: v.projectId, requestedById: user.id, status: "NEW" },
    select: { id: true },
  });
  await logAudit({
    actorId: user.id,
    action: "resource.create",
    entity: "ResourceRequest",
    entityId: created.id,
    projectId: v.projectId,
    summary: v.title,
    meta: { labId: data.labId, partnerId: data.partnerId, neededBy: v.neededBy || null },
  });
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", active: true, id: { not: user.id } }, select: { id: true } });
  await notify(admins.map((a) => a.id), "resource_requested", { title: v.title }, `/projects/${v.projectId}/resources#rr-${created.id}`);
  refresh(v.projectId);
  revalidateLayout(); // notification bell
  return done("toast.created");
}

// ---------------------------------------------------------------- coordinator decision (admin only)

const decideSchema = z.object({
  projectId: z.string().min(1),
  requestId: z.string().min(1),
  status: z.enum(["UNDER_REVIEW", "APPROVED", "REJECTED", "DONE"], { error: "errors.statusRequired" }),
  note: z.string().trim().max(NOTE_MAX, "errors.noteLong"),
});

export async function decideResourceRequest(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = decideSchema.safeParse({
    projectId: formStr(fd, "projectId") ?? "",
    requestId: formStr(fd, "requestId") ?? "",
    status: formStr(fd, "status") || undefined,
    note: formStr(fd, "note") ?? "",
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const v = parsed.data;
  const g = await guard(v.projectId);
  if (!g || !g.access.canManage) return fail("errors.forbidden");
  const { user } = g;

  const rr = await prisma.resourceRequest.findFirst({
    where: { id: v.requestId, projectId: v.projectId },
    select: { id: true, title: true, status: true, requestedById: true, decisionNote: true },
  });
  if (!rr) return fail("errors.notFound");
  if (!DECISION_FLOW[rr.status as ResourceStatusKey].includes(v.status)) return fail("errors.transition", { status: "errors.transition" });
  if (NOTE_REQUIRED.includes(v.status) && v.note.length < NOTE_MIN) return fail("errors.noteRequired", { note: "errors.noteRequired" });

  // DONE without a new note keeps the approval rationale
  const decisionNote = v.note || (v.status === "DONE" ? rr.decisionNote : null);
  // conditional write: only from the status the coordinator saw (a concurrent decision or edit makes it fail)
  const res = await prisma.resourceRequest.updateMany({
    where: { id: rr.id, status: rr.status },
    data: { status: v.status, decisionNote, decidedById: user.id, decidedAt: new Date() },
  });
  if (res.count !== 1) return fail("errors.changed");

  await logAudit({
    actorId: user.id,
    action: "resource.decide",
    entity: "ResourceRequest",
    entityId: rr.id,
    projectId: v.projectId,
    summary: `${rr.title} → ${v.status}`,
    meta: { from: rr.status, to: v.status, note: v.note || null },
  });

  // requester + project members, each in their own language
  const recipients = await prisma.user.findMany({
    where: {
      active: true,
      id: { not: user.id },
      OR: [...(rr.requestedById ? [{ id: rr.requestedById }] : []), { memberships: { some: { projectId: v.projectId } } }],
    },
    select: { id: true, locale: true },
  });
  const labels = await enumLabelByLocale("ResourceStatus", v.status);
  const byLocale = new Map<string, string[]>();
  for (const r of recipients) byLocale.set(r.locale, [...(byLocale.get(r.locale) ?? []), r.id]);
  for (const [loc, ids] of byLocale) {
    await notify(ids, "resource_decided", { title: rr.title, status: labels[loc] ?? labels.az ?? v.status }, `/projects/${v.projectId}/resources#rr-${rr.id}`);
  }
  refresh(v.projectId);
  revalidateLayout(); // notification bell
  return done("toast.decided");
}

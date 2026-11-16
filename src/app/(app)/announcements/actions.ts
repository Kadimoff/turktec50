"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit, notify } from "@/lib/audit";
import { type ActionState, done, fail, failFromZod, formStr, formStrs } from "@/lib/actions";
import { revalidateLayout, revalidateSets } from "@/lib/revalidate";

function refresh() {
  revalidateSets("announcements", "academy");
  revalidateLayout(); // notification bell
}

const ROLE = z.enum(["ADMIN", "TEAM", "MENTOR", "JURY"]);

const schema = z.object({
  id: z.string().trim().optional().transform((v) => v || undefined),
  title: z.string().trim().min(3, "errors.titleShort").max(160, "errors.titleLong"),
  body: z.string().trim().min(10, "errors.bodyShort").max(4000, "errors.bodyLong"),
  audience: z.array(ROLE, { message: "errors.audience" }).min(1, "errors.audience").transform((a) => [...new Set(a)]),
});

/** Create (always as a draft) or edit an announcement. Body is plain text — never rendered as HTML. */
export async function saveAnnouncement(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(["ADMIN"]);
  const parsed = schema.safeParse({
    id: formStr(fd, "id"),
    title: formStr(fd, "title") ?? "",
    body: (formStr(fd, "body") ?? "").replace(/\r\n?/g, "\n"),
    audience: formStrs(fd, "audience"),
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const v = parsed.data;

  if (v.id) {
    const existing = await prisma.announcement.findUnique({ where: { id: v.id }, select: { id: true, title: true, status: true, audience: true } });
    if (!existing) return fail("errors.notFound");
    await prisma.announcement.update({ where: { id: existing.id }, data: { title: v.title, body: v.body, audience: v.audience } });
    await logAudit({
      actorId: user.id, action: "announcement.update", entity: "Announcement", entityId: existing.id, summary: v.title,
      meta: { status: existing.status, audience: v.audience, from: { title: existing.title, audience: existing.audience } },
    });
    refresh();
    return done("toast.updated");
  }

  const row = await prisma.announcement.create({
    data: { title: v.title, body: v.body, audience: v.audience, status: "DRAFT", authorId: user.id },
    select: { id: true },
  });
  await logAudit({ actorId: user.id, action: "announcement.create", entity: "Announcement", entityId: row.id, summary: v.title, meta: { audience: v.audience } });
  refresh();
  return done("toast.created");
}

const idSchema = z.string().min(1);

/** Publish: status PUBLISHED, publishedAt now, in-app notification to active users of the audience roles (not the author / publisher). */
export async function publishAnnouncement(announcementId: string): Promise<ActionState> {
  const user = await requireUser(["ADMIN"]);
  const p = idSchema.safeParse(announcementId);
  if (!p.success) return fail("errors.invalid");
  const a = await prisma.announcement.findUnique({ where: { id: p.data }, select: { id: true, title: true, status: true, audience: true, authorId: true } });
  if (!a) return fail("errors.notFound");
  if (a.status === "PUBLISHED") return done("toast.published");
  if (a.audience.length === 0) return fail("errors.audience");

  // conditional update: a concurrent publish cannot notify twice
  const res = await prisma.announcement.updateMany({ where: { id: a.id, status: "DRAFT" }, data: { status: "PUBLISHED", publishedAt: new Date() } });
  if (res.count === 0) return done("toast.published");

  const exclude = [user.id, ...(a.authorId ? [a.authorId] : [])];
  const recipients = await prisma.user.findMany({ where: { active: true, role: { in: a.audience }, id: { notIn: exclude } }, select: { id: true } });
  await notify(recipients.map((r) => r.id), "announcement", { title: a.title }, "/announcements");
  await logAudit({
    actorId: user.id, action: "announcement.publish", entity: "Announcement", entityId: a.id, summary: a.title,
    meta: { audience: a.audience, notified: recipients.length },
  });
  refresh();
  return done("toast.published");
}

/** Move a published announcement back to draft (hidden from everyone but coordinators). */
export async function unpublishAnnouncement(announcementId: string): Promise<ActionState> {
  const user = await requireUser(["ADMIN"]);
  const p = idSchema.safeParse(announcementId);
  if (!p.success) return fail("errors.invalid");
  const a = await prisma.announcement.findUnique({ where: { id: p.data }, select: { id: true, title: true, status: true, audience: true } });
  if (!a) return fail("errors.notFound");
  if (a.status === "DRAFT") return done("toast.unpublished");
  await prisma.announcement.update({ where: { id: a.id }, data: { status: "DRAFT", publishedAt: null } });
  await logAudit({
    actorId: user.id, action: "announcement.update", entity: "Announcement", entityId: a.id, summary: a.title,
    meta: { status: "DRAFT", from: { status: "PUBLISHED" }, audience: a.audience },
  });
  refresh();
  return done("toast.unpublished");
}

export async function deleteAnnouncement(announcementId: string): Promise<ActionState> {
  const user = await requireUser(["ADMIN"]);
  const p = idSchema.safeParse(announcementId);
  if (!p.success) return fail("errors.invalid");
  const a = await prisma.announcement.findUnique({ where: { id: p.data }, select: { id: true, title: true, status: true, audience: true } });
  if (!a) return fail("errors.notFound");
  await prisma.announcement.delete({ where: { id: a.id } });
  await logAudit({ actorId: user.id, action: "announcement.delete", entity: "Announcement", entityId: a.id, summary: a.title, meta: { status: a.status, audience: a.audience } });
  refresh();
  return done("toast.deleted");
}

"use server";

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { assertProjectAccess, type ProjectAccess } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit, notify, type NotificationType } from "@/lib/audit";
import { LOCALES, UPLOAD } from "@/lib/constants";
import { done, fail, failFromZod, formStr, type ActionState } from "@/lib/actions";
import { revalidateLayout, revalidateProject, revalidateSets } from "@/lib/revalidate";
import { loadMessages } from "@/i18n/request";
import { enumLabelByLocale } from "@/components/projects/server";

const UPLOAD_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "./uploads");

/** Fallback when the browser sends no/unknown MIME type. */
const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  mp4: "video/mp4",
  zip: "application/zip",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
};

async function guard(projectId: string): Promise<{ user: CurrentUser; access: ProjectAccess } | null> {
  const user = await requireUser();
  try {
    const access = await assertProjectAccess(user, projectId);
    return { user, access };
  } catch {
    return null;
  }
}

type ItemRef = { key: string | null; title: string | null };

/** Language-neutral item name for audit summaries: the template key (e.g. "final_form") or the custom title. */
const itemRef = (item: ItemRef) => item.title ?? item.key ?? "—";

/** Item label in every UI locale (template items are translated, custom items keep their title). */
async function itemLabelByLocale(item: ItemRef) {
  const out: Record<string, string> = {};
  for (const l of LOCALES) {
    const m = (await loadMessages(l)) as { documents?: { items?: Record<string, { title?: string }> } };
    out[l] = (item.key && m.documents?.items?.[item.key]?.title) || itemRef(item);
  }
  return out;
}

/** Notifications store rendered params, so each recipient gets them in their own language. */
async function notifyByLocale(userIds: string[], type: NotificationType, params: (locale: string) => Record<string, string>, href: string) {
  if (userIds.length === 0) return;
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, locale: true } });
  const byLocale = new Map<string, string[]>();
  for (const u of users) {
    const l = (LOCALES as readonly string[]).includes(u.locale) ? u.locale : "az";
    byLocale.set(l, [...(byLocale.get(l) ?? []), u.id]);
  }
  for (const [l, ids] of byLocale) await notify(ids, type, params(l), href);
}

function refresh(projectId: string) {
  revalidateProject(projectId, "documents");
  revalidateSets("documents", "projects", "dashboard");
  revalidateLayout(); // notification bell
}

function cleanFileName(name: string) {
  const base = path.basename(name.replace(/\\/g, "/")).replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, "_").trim();
  return (base || "document").slice(0, 180);
}

// ---------------------------------------------------------------- upload

const uploadSchema = z.object({
  projectId: z.string().min(1),
  itemId: z.string().min(1),
  confidential: z.literal("on").optional(),
});

/** `version` = the version number actually created (it can differ from the one the dialog showed). */
export type UploadState = ActionState & { version?: number };

export async function uploadDocument(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const parsed = uploadSchema.safeParse({
    projectId: formStr(formData, "projectId"),
    itemId: formStr(formData, "itemId"),
    confidential: formStr(formData, "confidential"),
  });
  if (!parsed.success) return fail("errors.invalid");
  const { projectId, itemId } = parsed.data;
  const g = await guard(projectId);
  if (!g || !g.access.canWork) return fail("errors.forbidden");
  const { user } = g;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("errors.fileRequired", { file: "errors.fileRequired" });
  if (file.size > UPLOAD.maxBytes) return fail("errors.fileTooLarge", { file: "errors.fileTooLarge" });
  const ext = (path.extname(file.name).slice(1).toLowerCase().match(/^[a-z0-9]{1,8}$/)?.[0]) ?? "";
  const mime = (UPLOAD.allowedMime as readonly string[]).includes(file.type) ? file.type : EXT_MIME[ext];
  if (!mime || !(UPLOAD.allowedMime as readonly string[]).includes(mime)) return fail("errors.fileType", { file: "errors.fileType" });

  const item = await prisma.checklistItem.findFirst({
    where: { id: itemId, projectId },
    select: { id: true, key: true, title: true },
  });
  if (!item) return fail("errors.notFound");

  const storedName = `${randomUUID()}${ext ? `.${ext}` : ""}`;
  await fs.promises.mkdir(/*turbopackIgnore: true*/ UPLOAD_DIR, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.promises.writeFile(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, storedName), buf, { flag: "wx" });

  const fileName = cleanFileName(file.name);
  const confidential = parsed.data.confidential === "on";
  let doc: { id: string; version: number };
  try {
    doc = await prisma.$transaction(async (tx) => {
      // a new version needs a fresh review; updating the item first also locks its row, so concurrent uploads of the
      // same item wait here and then read the version committed by the first one
      await tx.checklistItem.update({
        where: { id: item.id },
        data: { status: "UPLOADED", reviewerId: null, reviewedAt: null, reviewerNote: null },
      });
      const last = await tx.document.findFirst({ where: { checklistItemId: item.id }, orderBy: { version: "desc" }, select: { version: true } });
      return tx.document.create({
        data: {
          projectId, checklistItemId: item.id, fileName, storedName, mimeType: mime, size: buf.length,
          version: (last?.version ?? 0) + 1, confidential, uploadedById: user.id,
        },
        select: { id: true, version: true },
      });
    });
  } catch {
    await fs.promises.rm(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, storedName), { force: true });
    return fail("errors.generic");
  }

  const { version } = doc;
  const [labels, project] = await Promise.all([
    itemLabelByLocale(item),
    prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { title: true, mentors: { select: { mentorId: true } } } }),
  ]);
  await logAudit({
    actorId: user.id,
    action: "document.upload",
    entity: "Document",
    entityId: doc.id,
    projectId,
    summary: `${itemRef(item)} · v${version} · ${fileName}`,
    meta: { checklistItemId: item.id, version, confidential, size: buf.length, mimeType: mime },
  });
  await notifyByLocale(
    project.mentors.map((m) => m.mentorId).filter((id) => id !== user.id),
    "document_uploaded",
    (l) => ({ title: `${project.title} · ${labels[l]}` }),
    `/projects/${projectId}/documents#item-${item.id}`,
  );
  refresh(projectId);
  return done("toast.uploaded", { version });
}

// ---------------------------------------------------------------- review

const reviewSchema = z
  .object({
    projectId: z.string().min(1),
    itemId: z.string().min(1),
    decision: z.enum(["IN_REVIEW", "APPROVED", "REJECTED"]),
    note: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.decision !== "REJECTED" || (v.note && v.note.length >= 3), { path: ["note"], message: "errors.noteRequired" });

export async function reviewChecklistItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = reviewSchema.safeParse({
    projectId: formStr(formData, "projectId"),
    itemId: formStr(formData, "itemId"),
    decision: formStr(formData, "decision"),
    note: formStr(formData, "note"),
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const { projectId, itemId, decision, note } = parsed.data;
  const g = await guard(projectId);
  if (!g || !g.access.canReview) return fail("errors.forbidden");
  const { user } = g;

  const item = await prisma.checklistItem.findFirst({
    where: { id: itemId, projectId },
    select: { id: true, key: true, title: true, status: true, _count: { select: { documents: true } } },
  });
  if (!item) return fail("errors.notFound");
  if (item._count.documents === 0) return fail("errors.nothingToReview");

  await prisma.checklistItem.update({
    where: { id: item.id },
    data:
      decision === "IN_REVIEW"
        ? { status: "IN_REVIEW", reviewerId: user.id }
        : { status: decision, reviewerId: user.id, reviewedAt: new Date(), reviewerNote: note || null },
  });

  await logAudit({
    actorId: user.id,
    action: "checklist.review",
    entity: "ChecklistItem",
    entityId: item.id,
    projectId,
    summary: `${itemRef(item)}: ${item.status} → ${decision}`,
    meta: { from: item.status, to: decision, note: note || null },
  });
  if (decision !== "IN_REVIEW") {
    const [labels, statuses, members] = await Promise.all([
      itemLabelByLocale(item),
      enumLabelByLocale("ChecklistStatus", decision),
      prisma.projectMember.findMany({ where: { projectId }, select: { userId: true } }),
    ]);
    await notifyByLocale(
      members.map((m) => m.userId).filter((id) => id !== user.id),
      "document_reviewed",
      (l) => ({ title: labels[l], status: statuses[l] ?? decision }),
      `/projects/${projectId}/documents#item-${item.id}`,
    );
  }
  refresh(projectId);
  return done(decision === "APPROVED" ? "toast.approved" : decision === "REJECTED" ? "toast.changesRequested" : "toast.inReview");
}

// ---------------------------------------------------------------- admin: custom item

const addSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(3, "errors.titleShort").max(140, "errors.titleLong"),
  category: z.enum(["CORE", "ANNEX", "CONDITIONAL"]),
  required: z.literal("on").optional(),
});

export async function addChecklistItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = addSchema.safeParse({
    projectId: formStr(formData, "projectId"),
    title: formStr(formData, "title"),
    category: formStr(formData, "category"),
    required: formStr(formData, "required"),
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const { projectId, title, category } = parsed.data;
  const g = await guard(projectId);
  if (!g || !g.access.isAdmin) return fail("errors.forbidden");

  const item = await prisma.$transaction(async (tx) => {
    const last = await tx.checklistItem.findFirst({ where: { projectId }, orderBy: { order: "desc" }, select: { order: true } });
    return tx.checklistItem.create({
      data: { projectId, key: null, title, category, required: parsed.data.required === "on", order: (last?.order ?? 0) + 1 },
      select: { id: true },
    });
  });
  await logAudit({
    actorId: g.user.id,
    action: "checklist.add",
    entity: "ChecklistItem",
    entityId: item.id,
    projectId,
    summary: title,
    meta: { category, required: parsed.data.required === "on" },
  });
  refresh(projectId);
  return done("toast.itemAdded");
}

// ---------------------------------------------------------------- admin: delete a version

export async function deleteDocument(documentId: string): Promise<ActionState> {
  const id = z.string().min(1).safeParse(documentId);
  if (!id.success) return fail("errors.invalid");
  const user = await requireUser(); // redirect if signed out
  const doc = await prisma.document.findUnique({
    where: { id: id.data },
    select: {
      id: true, projectId: true, storedName: true, fileName: true, version: true, checklistItemId: true,
      checklistItem: { select: { key: true, title: true } },
    },
  });
  if (!doc) return fail("errors.notFound");
  const g = await guard(doc.projectId);
  if (!g || !g.access.isAdmin) return fail("errors.forbidden");

  await prisma.$transaction(async (tx) => {
    await tx.document.delete({ where: { id: doc.id } });
    if (doc.checklistItemId) {
      const remaining = await tx.document.findFirst({
        where: { checklistItemId: doc.checklistItemId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      if (!remaining) {
        await tx.checklistItem.update({
          where: { id: doc.checklistItemId },
          data: { status: "MISSING", reviewerId: null, reviewedAt: null, reviewerNote: null },
        });
      } else if (remaining.version < doc.version) {
        // the reviewed (latest) version is gone — the previous one must be reviewed again
        await tx.checklistItem.update({
          where: { id: doc.checklistItemId },
          data: { status: "UPLOADED", reviewerId: null, reviewedAt: null, reviewerNote: null },
        });
      }
    }
  });

  // remove the file unless another row still points at it (seed data shares a sample file)
  const stillUsed = await prisma.document.count({ where: { storedName: doc.storedName } });
  if (stillUsed === 0) {
    const safe = path.basename(doc.storedName);
    if (safe && !safe.startsWith(".")) await fs.promises.rm(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, safe), { force: true });
  }

  const label = doc.checklistItem ? itemRef(doc.checklistItem) : doc.fileName;
  await logAudit({
    actorId: user.id,
    action: "document.delete",
    entity: "Document",
    entityId: doc.id,
    projectId: doc.projectId,
    summary: `${label} · v${doc.version} · ${doc.fileName}`,
    meta: { checklistItemId: doc.checklistItemId, version: doc.version },
  });
  refresh(doc.projectId);
  return done("toast.deleted");
}

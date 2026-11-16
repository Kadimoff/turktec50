"use server";

import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { type ActionState, done, fail, failFromZod, formStr, isUniqueViolation } from "@/lib/actions";
import { revalidateSets } from "@/lib/revalidate";
import type { RegistryKind, RegistryUsage } from "@/components/academy/registry/types";

const ENTITY: Record<RegistryKind, "Faculty" | "Lab" | "Partner"> = { faculty: "Faculty", lab: "Lab", partner: "Partner" };

/** Faculties / labs / partners appear in student, team, project and intake pickers and on the public apply form. */
function refresh(kind: RegistryKind) {
  revalidateSets("registry", "students", "teams", "academy", "catalog", "projects", "intake");
  if (kind === "lab") revalidateSets("trainings");
}

/** Form value with CRLF from <textarea> submissions normalized to LF (so length limits match the browser's). */
const text = (fd: FormData, k: string) => formStr(fd, k)?.replace(/\r\n?/g, "\n");

const name = z.string().trim().min(2, "errors.nameShort").max(160, "errors.nameLong");
const optText = (max: number) => z.string().trim().max(max, "errors.tooLong").optional().transform((v) => v || null);
const id = z.string().trim().optional().transform((v) => v || undefined);

// ---------- faculties ----------

/** Everything that references a faculty (intake requests and their members included). */
const FACULTY_USAGE = { students: true, teams: true, projects: true, labs: true, users: true, intakeRequests: true, intakeMembers: true } as const;

const facultySchema = z.object({
  id,
  universityId: z.string().trim().min(1, "errors.universityRequired"),
  name,
  coordinator: optText(160),
  status: z.enum(["PLANNED", "ACTIVE", "ARCHIVED"], { message: "errors.invalid" }),
  notes: optText(2000),
});

export async function saveFaculty(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(["ADMIN"]);
  const parsed = facultySchema.safeParse({
    id: text(fd, "id"), universityId: text(fd, "universityId") ?? "", name: text(fd, "name") ?? "",
    coordinator: text(fd, "coordinator"), status: text(fd, "status"), notes: text(fd, "notes"),
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const v = parsed.data;

  const [university, existing] = await Promise.all([
    prisma.university.findUnique({ where: { id: v.universityId }, select: { id: true } }),
    v.id
      ? prisma.faculty.findUnique({
          where: { id: v.id },
          select: { id: true, universityId: true, name: true, status: true, _count: { select: FACULTY_USAGE } },
        })
      : null,
  ]);
  if (!university) return fail("errors.universityRequired", { universityId: "errors.universityRequired" });
  if (v.id && !existing) return fail("errors.notFound");
  // linked students / teams / projects / labs / staff / intake requests belong to the faculty's university — it cannot move while in use
  if (existing && existing.universityId !== v.universityId && Object.values(existing._count).some((n) => n > 0)) {
    return fail("errors.universityLocked", { universityId: "errors.universityLocked" });
  }
  const clash = await prisma.faculty.findFirst({
    where: { universityId: v.universityId, name: { equals: v.name, mode: "insensitive" }, ...(v.id && { id: { not: v.id } }) },
    select: { id: true },
  });
  if (clash) return fail("errors.nameTaken", { name: "errors.nameTaken" });

  const data = { universityId: v.universityId, name: v.name, coordinator: v.coordinator, status: v.status, notes: v.notes };
  try {
    if (existing) {
      await prisma.faculty.update({ where: { id: existing.id }, data });
      await logAudit({
        actorId: user.id, action: "registry.update", entity: "Faculty", entityId: existing.id, summary: v.name,
        meta: { status: v.status, from: { name: existing.name, status: existing.status } },
      });
      refresh("faculty");
      return done("toast.updated");
    }
    const row = await prisma.faculty.create({ data, select: { id: true } });
    await logAudit({ actorId: user.id, action: "registry.create", entity: "Faculty", entityId: row.id, summary: v.name, meta: { status: v.status } });
  } catch (e) {
    if (isUniqueViolation(e, "name")) return fail("errors.nameTaken", { name: "errors.nameTaken" });
    throw e;
  }
  refresh("faculty");
  return done("toast.created");
}

// ---------- labs ----------

const labSchema = z.object({
  id,
  universityId: z.string().trim().min(1, "errors.universityRequired"),
  facultyId: id,
  name,
  contact: optText(200),
  status: z.enum(["AVAILABLE", "LIMITED", "CLOSED"], { message: "errors.invalid" }),
  notes: optText(2000),
});

export async function saveLab(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(["ADMIN"]);
  const parsed = labSchema.safeParse({
    id: text(fd, "id"), universityId: text(fd, "universityId") ?? "", facultyId: text(fd, "facultyId"), name: text(fd, "name") ?? "",
    contact: text(fd, "contact"), status: text(fd, "status"), notes: text(fd, "notes"),
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const v = parsed.data;

  const [university, faculty, existing] = await Promise.all([
    prisma.university.findUnique({ where: { id: v.universityId }, select: { id: true } }),
    v.facultyId ? prisma.faculty.findUnique({ where: { id: v.facultyId }, select: { id: true, universityId: true } }) : null,
    v.id ? prisma.lab.findUnique({ where: { id: v.id }, select: { id: true, name: true, status: true } }) : null,
  ]);
  if (!university) return fail("errors.universityRequired", { universityId: "errors.universityRequired" });
  if (v.facultyId && (!faculty || faculty.universityId !== v.universityId)) return fail("errors.facultyMismatch", { facultyId: "errors.facultyMismatch" });
  if (v.id && !existing) return fail("errors.notFound");

  const data = { universityId: v.universityId, facultyId: v.facultyId ?? null, name: v.name, contact: v.contact, status: v.status, notes: v.notes };
  if (existing) {
    await prisma.lab.update({ where: { id: existing.id }, data });
    await logAudit({
      actorId: user.id, action: "registry.update", entity: "Lab", entityId: existing.id, summary: v.name,
      meta: { status: v.status, from: { name: existing.name, status: existing.status } },
    });
    refresh("lab");
    return done("toast.updated");
  }
  const row = await prisma.lab.create({ data, select: { id: true } });
  await logAudit({ actorId: user.id, action: "registry.create", entity: "Lab", entityId: row.id, summary: v.name, meta: { status: v.status } });
  refresh("lab");
  return done("toast.created");
}

// ---------- partners ----------

const partnerSchema = z.object({
  id,
  name,
  sector: optText(120),
  contact: optText(200),
  status: z.enum(["CANDIDATE", "NEGOTIATING", "ACTIVE", "ARCHIVED"], { message: "errors.invalid" }),
  notes: optText(2000),
});

export async function savePartner(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(["ADMIN"]);
  const parsed = partnerSchema.safeParse({
    id: text(fd, "id"), name: text(fd, "name") ?? "", sector: text(fd, "sector"), contact: text(fd, "contact"),
    status: text(fd, "status"), notes: text(fd, "notes"),
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const v = parsed.data;

  const existing = v.id ? await prisma.partner.findUnique({ where: { id: v.id }, select: { id: true, name: true, status: true } }) : null;
  if (v.id && !existing) return fail("errors.notFound");
  const clash = await prisma.partner.findFirst({
    where: { name: { equals: v.name, mode: "insensitive" }, ...(v.id && { id: { not: v.id } }) },
    select: { id: true },
  });
  if (clash) return fail("errors.partnerTaken", { name: "errors.partnerTaken" });

  const data = { name: v.name, sector: v.sector, contact: v.contact, status: v.status, notes: v.notes };
  if (existing) {
    await prisma.partner.update({ where: { id: existing.id }, data });
    await logAudit({
      actorId: user.id, action: "registry.update", entity: "Partner", entityId: existing.id, summary: v.name,
      meta: { status: v.status, from: { name: existing.name, status: existing.status } },
    });
    refresh("partner");
    return done("toast.updated");
  }
  const row = await prisma.partner.create({ data, select: { id: true } });
  await logAudit({ actorId: user.id, action: "registry.create", entity: "Partner", entityId: row.id, summary: v.name, meta: { status: v.status } });
  refresh("partner");
  return done("toast.created");
}

// ---------- delete / archive ----------

/** Everything that still references the record. A record may only be deleted when all counts are zero. */
async function usageOf(kind: RegistryKind, recordId: string): Promise<{ name: string; status: string; usage: RegistryUsage } | null> {
  if (kind === "faculty") {
    const f = await prisma.faculty.findUnique({
      where: { id: recordId },
      select: { name: true, status: true, _count: { select: FACULTY_USAGE } },
    });
    return f && { name: f.name, status: f.status, usage: f._count };
  }
  if (kind === "lab") {
    const l = await prisma.lab.findUnique({
      where: { id: recordId },
      select: { name: true, status: true, _count: { select: { projects: true, trainings: true, resourceRequests: true } } },
    });
    return l && { name: l.name, status: l.status, usage: { projects: l._count.projects, trainings: l._count.trainings, requests: l._count.resourceRequests } };
  }
  const p = await prisma.partner.findUnique({
    where: { id: recordId },
    select: { name: true, status: true, _count: { select: { projects: true, resourceRequests: true } } },
  });
  return p && { name: p.name, status: p.status, usage: { projects: p._count.projects, requests: p._count.resourceRequests } };
}

const target = z.object({ kind: z.enum(["faculty", "lab", "partner"]), id: z.string().min(1) });

export async function deleteRegistryRecord(kind: RegistryKind, recordId: string): Promise<ActionState> {
  const user = await requireUser(["ADMIN"]);
  const p = target.safeParse({ kind, id: recordId });
  if (!p.success) return fail("errors.invalid");
  const found = await usageOf(p.data.kind, p.data.id);
  if (!found) return fail("errors.notFound");
  if (Object.values(found.usage).some((n) => (n ?? 0) > 0)) return fail("errors.inUse");

  try {
    if (p.data.kind === "faculty") await prisma.faculty.delete({ where: { id: p.data.id } });
    else if (p.data.kind === "lab") await prisma.lab.delete({ where: { id: p.data.id } });
    else await prisma.partner.delete({ where: { id: p.data.id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return fail("errors.notFound");
    throw e;
  }
  await logAudit({ actorId: user.id, action: "registry.delete", entity: ENTITY[p.data.kind], entityId: p.data.id, summary: found.name, meta: { status: found.status } });
  refresh(p.data.kind);
  return done("toast.deleted");
}

/** The alternative to deleting a record that is in use: faculty/partner → ARCHIVED, lab → CLOSED. */
export async function retireRegistryRecord(kind: RegistryKind, recordId: string): Promise<ActionState> {
  const user = await requireUser(["ADMIN"]);
  const p = target.safeParse({ kind, id: recordId });
  if (!p.success) return fail("errors.invalid");
  const found = await usageOf(p.data.kind, p.data.id);
  if (!found) return fail("errors.notFound");
  const to = p.data.kind === "lab" ? "CLOSED" : "ARCHIVED";
  if (found.status === to) return done(p.data.kind === "lab" ? "toast.closed" : "toast.archived");

  if (p.data.kind === "faculty") await prisma.faculty.update({ where: { id: p.data.id }, data: { status: "ARCHIVED" } });
  else if (p.data.kind === "lab") await prisma.lab.update({ where: { id: p.data.id }, data: { status: "CLOSED" } });
  else await prisma.partner.update({ where: { id: p.data.id }, data: { status: "ARCHIVED" } });
  await logAudit({
    actorId: user.id, action: "registry.update", entity: ENTITY[p.data.kind], entityId: p.data.id, summary: found.name,
    meta: { status: to, from: { status: found.status } },
  });
  refresh(p.data.kind);
  return done(p.data.kind === "lab" ? "toast.closed" : "toast.archived");
}

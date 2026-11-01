"use server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const ROLES = ["ADMIN", "TEAM", "MENTOR", "JURY"] as const;

export type UserFormState =
  | { ok: true; at: number }
  | { ok: false; at: number; error?: "forbidden" | "error" | "self" | "rootOnly" | "rootProtected"; fields?: Partial<Record<"name" | "email" | "role" | "title" | "universityId" | "password", string>> }
  | undefined;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "tooLong")
    .optional()
    .transform((v) => (v ? v : null));

const createSchema = z.object({
  name: z.string().trim().min(2, "required").max(120, "tooLong"),
  email: z.string().trim().toLowerCase().email("invalidEmail").max(160, "tooLong"),
  role: z.enum(ROLES, { message: "required" }),
  title: optionalText(120),
  universityId: optionalText(40),
  password: z.string().min(8, "passwordShort").max(100, "tooLong"),
});

const updateSchema = z.object({
  id: z.string().min(1),
  role: z.enum(ROLES, { message: "required" }),
  title: optionalText(120),
  universityId: optionalText(40),
});

function fieldErrors(issues: z.core.$ZodIssue[]) {
  const fields: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? "");
    if (k && !fields[k]) fields[k] = i.message;
  }
  return fields;
}

async function validUniversity(id: string | null) {
  if (!id) return true;
  return !!(await prisma.university.findUnique({ where: { id }, select: { id: true } }));
}

export async function createUser(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const admin = await requireUser(["ADMIN"]);
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, at: Date.now(), fields: fieldErrors(parsed.error.issues) };
  const d = parsed.data;
  // only root (system owner) may create coordinator (ADMIN) accounts
  if (d.role === "ADMIN" && !admin.isRoot) return { ok: false, at: Date.now(), error: "rootOnly" };
  if (!(await validUniversity(d.universityId))) return { ok: false, at: Date.now(), fields: { universityId: "invalid" } };
  if (await prisma.user.findUnique({ where: { email: d.email }, select: { id: true } })) {
    return { ok: false, at: Date.now(), fields: { email: "emailTaken" } };
  }
  try {
    const user = await prisma.user.create({
      data: {
        name: d.name,
        email: d.email,
        role: d.role,
        title: d.title,
        universityId: d.universityId,
        passwordHash: await bcrypt.hash(d.password, 10),
      },
      select: { id: true },
    });
    await logAudit({ actorId: admin.id, action: "user.create", entity: "User", entityId: user.id, summary: `${d.name} · ${d.role}` });
  } catch {
    return { ok: false, at: Date.now(), error: "error" };
  }
  revalidatePath("/admin/users");
  return { ok: true, at: Date.now() };
}

export async function updateUser(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const admin = await requireUser(["ADMIN"]);
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, at: Date.now(), fields: fieldErrors(parsed.error.issues) };
  const d = parsed.data;
  const target = await prisma.user.findUnique({ where: { id: d.id }, select: { id: true, name: true, role: true, isRoot: true, title: true, universityId: true } });
  if (!target) return { ok: false, at: Date.now(), error: "error" };
  // root is protected: only root itself may edit its profile, and its role never changes
  if (target.isRoot && !admin.isRoot) return { ok: false, at: Date.now(), error: "rootProtected" };
  if (target.isRoot && d.role !== "ADMIN") return { ok: false, at: Date.now(), error: "rootProtected" };
  // only root may edit coordinators or grant/revoke the ADMIN role
  if (!admin.isRoot && (target.role === "ADMIN" || d.role === "ADMIN")) return { ok: false, at: Date.now(), error: "rootOnly" };
  // the coordinator cannot remove their own admin role (avoids locking themselves out)
  if (target.id === admin.id && d.role !== "ADMIN") return { ok: false, at: Date.now(), error: "self" };
  if (!(await validUniversity(d.universityId))) return { ok: false, at: Date.now(), fields: { universityId: "invalid" } };

  const changes: string[] = [];
  if (target.role !== d.role) changes.push(`role: ${target.role} → ${d.role}`);
  if ((target.title ?? null) !== d.title) changes.push("title");
  if ((target.universityId ?? null) !== d.universityId) changes.push("university");
  try {
    await prisma.user.update({ where: { id: d.id }, data: { role: d.role, title: d.title, universityId: d.universityId } });
    await logAudit({
      actorId: admin.id,
      action: "user.update",
      entity: "User",
      entityId: d.id,
      summary: changes.length ? `${target.name} · ${changes.join(", ")}` : target.name,
      meta: { changes },
    });
  } catch {
    return { ok: false, at: Date.now(), error: "error" };
  }
  revalidatePath("/admin/users");
  return { ok: true, at: Date.now() };
}

export async function setUserActive(input: { id: string; active: boolean }): Promise<{ ok: boolean; error?: "self" | "error" | "rootOnly" | "rootProtected" }> {
  const admin = await requireUser(["ADMIN"]);
  const parsed = z.object({ id: z.string().min(1), active: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "error" };
  if (parsed.data.id === admin.id) return { ok: false, error: "self" };
  const target = await prisma.user.findUnique({ where: { id: parsed.data.id }, select: { id: true, name: true, email: true, role: true, isRoot: true } });
  if (!target) return { ok: false, error: "error" };
  if (target.isRoot) return { ok: false, error: "rootProtected" };
  if (target.role === "ADMIN" && !admin.isRoot) return { ok: false, error: "rootOnly" };
  await prisma.user.update({ where: { id: target.id }, data: { active: parsed.data.active } });
  await logAudit({
    actorId: admin.id,
    action: parsed.data.active ? "user.activate" : "user.deactivate",
    entity: "User",
    entityId: target.id,
    summary: `${target.name} · ${target.email}`,
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

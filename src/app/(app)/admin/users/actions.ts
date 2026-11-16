"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { LOGIN_RATE_BUCKET, requireUser, type CurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { done, fail, failFromZod, formStr, isUniqueViolation, type ActionState } from "@/lib/actions";
import { generateTempPassword, hashPassword } from "@/lib/passwords";
import { revalidateSets } from "@/lib/revalidate";
import { resetEvents } from "@/lib/rate-limit";

// Message / error keys are in the `admin.users` namespace.
const ROLES = ["ADMIN", "TEAM", "MENTOR", "JURY"] as const;

/** Result of a user action; `tempPassword` is the generated password, returned ONCE (only its hash is stored). */
export type UserActionState = ActionState & { tempPassword?: string; email?: string };

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "errors.tooLong")
    .optional()
    .transform((v) => (v ? v : null));

const createSchema = z.object({
  name: z.string().trim().min(2, "errors.required").max(120, "errors.tooLong"),
  email: z.string().trim().toLowerCase().email("errors.invalidEmail").max(160, "errors.tooLong"),
  role: z.enum(ROLES, { message: "errors.required" }),
  title: optionalText(120),
  universityId: optionalText(40),
});

const updateSchema = z.object({
  id: z.string().min(1, "errors.error"),
  role: z.enum(ROLES, { message: "errors.required" }),
  title: optionalText(120),
  universityId: optionalText(40),
});

async function validUniversity(id: string | null) {
  if (!id) return true;
  return !!(await prisma.university.findUnique({ where: { id }, select: { id: true } }));
}

/** Root is untouchable; coordinator (ADMIN) accounts are managed by root only. null = allowed. */
function manageError(admin: CurrentUser, target: { isRoot: boolean; role: string }) {
  if (target.isRoot) return "errors.rootProtected";
  if (target.role === "ADMIN" && !admin.isRoot) return "errors.rootOnly";
  return null;
}

/** New account with a generated temporary password (shown once; the user must change it at the first sign-in). */
export async function createUser(_prev: UserActionState, formData: FormData): Promise<UserActionState> {
  const admin = await requireUser(["ADMIN"]);
  const parsed = createSchema.safeParse({
    name: formStr(formData, "name"), email: formStr(formData, "email"), role: formStr(formData, "role"),
    title: formStr(formData, "title"), universityId: formStr(formData, "universityId"),
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const d = parsed.data;
  // only root (system owner) may create coordinator (ADMIN) accounts
  if (d.role === "ADMIN" && !admin.isRoot) return fail("errors.rootOnly");
  if (!(await validUniversity(d.universityId))) return fail("errors.invalid", { universityId: "errors.invalid" });

  const tempPassword = generateTempPassword();
  let userId: string;
  try {
    const user = await prisma.user.create({
      data: {
        name: d.name, email: d.email, role: d.role, title: d.title, universityId: d.universityId,
        passwordHash: await hashPassword(tempPassword), mustChangePassword: true,
      },
      select: { id: true },
    });
    userId = user.id;
  } catch (e) {
    if (isUniqueViolation(e, "email")) return fail("errors.emailTaken", { email: "errors.emailTaken" });
    throw e;
  }
  await logAudit({
    actorId: admin.id, action: "user.create", entity: "User", entityId: userId, summary: `${d.name} · ${d.role}`,
    meta: { temporaryPassword: true },
  });
  revalidateSets("admin");
  return done("toastCreated", { tempPassword, email: d.email });
}

export async function updateUser(_prev: UserActionState, formData: FormData): Promise<UserActionState> {
  const admin = await requireUser(["ADMIN"]);
  const parsed = updateSchema.safeParse({
    id: formStr(formData, "id"), role: formStr(formData, "role"), title: formStr(formData, "title"), universityId: formStr(formData, "universityId"),
  });
  if (!parsed.success) return failFromZod(parsed.error);
  const d = parsed.data;
  const target = await prisma.user.findUnique({ where: { id: d.id }, select: { id: true, name: true, role: true, isRoot: true, title: true, universityId: true } });
  if (!target) return fail("errors.error");
  // root is protected: only root itself may edit its profile, and its role never changes
  if (target.isRoot && !admin.isRoot) return fail("errors.rootProtected");
  if (target.isRoot && d.role !== "ADMIN") return fail("errors.rootProtected");
  // only root may edit coordinators or grant/revoke the ADMIN role
  if (!admin.isRoot && (target.role === "ADMIN" || d.role === "ADMIN")) return fail("errors.rootOnly");
  // the coordinator cannot remove their own admin role (avoids locking themselves out)
  if (target.id === admin.id && d.role !== "ADMIN") return fail("errors.self");
  if (!(await validUniversity(d.universityId))) return fail("errors.invalid", { universityId: "errors.invalid" });

  const changes: string[] = [];
  if (target.role !== d.role) changes.push(`role: ${target.role} → ${d.role}`);
  if ((target.title ?? null) !== d.title) changes.push("title");
  if ((target.universityId ?? null) !== d.universityId) changes.push("university");
  await prisma.user.update({ where: { id: d.id }, data: { role: d.role, title: d.title, universityId: d.universityId } });
  await logAudit({
    actorId: admin.id, action: "user.update", entity: "User", entityId: d.id,
    summary: changes.length ? `${target.name} · ${changes.join(", ")}` : target.name, meta: { changes },
  });
  revalidateSets("admin");
  return done("toastSaved");
}

export async function setUserActive(input: { id: string; active: boolean }): Promise<ActionState> {
  const admin = await requireUser(["ADMIN"]);
  const parsed = z.object({ id: z.string().min(1), active: z.boolean() }).safeParse(input);
  if (!parsed.success) return fail("errors.error");
  if (parsed.data.id === admin.id) return fail("errors.self");
  const target = await prisma.user.findUnique({ where: { id: parsed.data.id }, select: { id: true, name: true, email: true, role: true, isRoot: true } });
  if (!target) return fail("errors.error");
  const denied = manageError(admin, target);
  if (denied) return fail(denied);
  await prisma.user.update({ where: { id: target.id }, data: { active: parsed.data.active } });
  await logAudit({
    actorId: admin.id, action: parsed.data.active ? "user.activate" : "user.deactivate", entity: "User", entityId: target.id,
    summary: `${target.name} · ${target.email}`,
  });
  revalidateSets("admin");
  return done(parsed.data.active ? "toastActivated" : "toastDeactivated");
}

/**
 * Replace a user's password with a generated temporary one (shown once) and require a change at the next sign-in.
 * Same rules as the other account actions: nobody resets root, only root resets coordinators; own password → /account/password.
 */
export async function resetUserPassword(input: { id: string }): Promise<UserActionState> {
  const admin = await requireUser(["ADMIN"]);
  const parsed = z.object({ id: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return fail("errors.error");
  if (parsed.data.id === admin.id) return fail("errors.selfPassword");
  const target = await prisma.user.findUnique({ where: { id: parsed.data.id }, select: { id: true, name: true, email: true, role: true, isRoot: true } });
  if (!target) return fail("errors.error");
  const denied = manageError(admin, target);
  if (denied) return fail(denied);

  const tempPassword = generateTempPassword();
  // passwordChangedAt revokes the user's existing sessions (e.g. a password that leaked)
  await prisma.user.update({ where: { id: target.id }, data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true, passwordChangedAt: new Date() } });
  await resetEvents(LOGIN_RATE_BUCKET, target.email.toLowerCase()); // a locked-out user can sign in with the new password right away
  await logAudit({ actorId: admin.id, action: "user.password_reset", entity: "User", entityId: target.id, summary: `${target.name} · ${target.email}` });
  revalidateSets("admin");
  return done("toastReset", { tempPassword, email: target.email });
}

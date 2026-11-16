"use server";
import { cookies } from "next/headers";
import { redirect, RedirectType } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, destroySession, getCurrentUser, LOGIN_IP_RATE_BUCKET, LOGIN_RATE_BUCKET, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { LOCALE_COOKIE } from "@/lib/constants";
import { fail, failFromZod, type ActionState } from "@/lib/actions";
import { hashPassword, newPasswordSchema, verifyPassword } from "@/lib/passwords";
import { clientIp, isAllowed, LIMITS, recordEvent, resetEvents } from "@/lib/rate-limit";

// Rate-limit buckets: failed sign-ins per account (hard key) and per client IP (soft key, skipped when unknown).
const LOGIN_BUCKET = LOGIN_RATE_BUCKET;
const LOGIN_IP_BUCKET = LOGIN_IP_RATE_BUCKET;

// "email" field accepts an e-mail address, or the username "root" for the system owner account
const schema = z.object({ email: z.string().trim().min(1).max(160), password: z.string().min(1).max(200), next: z.string().optional() });

/** `message` is a key of the `auth` namespace: invalid | inactive | rateLimited. */
export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("invalid");
  const login = parsed.data.email.toLowerCase();
  const ip = await clientIp();
  const useIp = ip !== "unknown";

  // Refuse before looking at the password: a locked account stays locked for the window even with the right password.
  const [accountOk, ipOk] = await Promise.all([
    isAllowed(LOGIN_BUCKET, login, LIMITS.loginAccount),
    useIp ? isAllowed(LOGIN_IP_BUCKET, ip, LIMITS.loginIp) : Promise.resolve(true),
  ]);
  if (!accountOk || !ipOk) return fail("rateLimited");

  const user =
    login === "root"
      ? // "root" = the primary (.env) root; additional root accounts sign in with their e-mail
        ((await prisma.user.findFirst({ where: { isRoot: true, email: (process.env.ROOT_EMAIL ?? "").toLowerCase().trim() } })) ??
        (await prisma.user.findFirst({ where: { isRoot: true }, orderBy: { createdAt: "asc" } })))
      : await prisma.user.findUnique({ where: { email: login } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    await Promise.all([recordEvent(LOGIN_BUCKET, login), useIp ? recordEvent(LOGIN_IP_BUCKET, ip) : null]);
    return fail("invalid");
  }
  if (!user.active) return fail("inactive");

  await resetEvents(LOGIN_BUCKET, login);
  await createSession(user);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const store = await cookies();
  if (!store.get(LOCALE_COOKIE)) store.set(LOCALE_COOKIE, user.locale, { path: "/", maxAge: 31536000, sameSite: "lax" });
  await logAudit({ actorId: user.id, action: "auth.login", entity: "User", entityId: user.id, summary: user.email });
  if (user.mustChangePassword) redirect("/account/password");
  const next = parsed.data.next;
  redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export async function logout() {
  const user = await getCurrentUser();
  if (user) await logAudit({ actorId: user.id, action: "auth.logout", entity: "User", entityId: user.id, summary: user.email });
  await destroySession();
  redirect("/login");
}

const changeSchema = z.object({
  current: z.string().min(1, "errors.currentRequired").max(200, "errors.currentWrong"),
  password: newPasswordSchema,
  confirm: z.string(),
});

/**
 * Set an own password (current + new + confirmation). Clears `mustChangePassword` (generated temporary passwords) and goes to the
 * dashboard. Wrong current passwords count towards the same per-account limit as failed sign-ins.
 * Error keys are in the `auth` namespace.
 */
export async function changePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = changeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failFromZod(parsed.error);
  const { current, password, confirm } = parsed.data;
  if (confirm !== password) return fail("errors.passwordMismatch", { confirm: "errors.passwordMismatch" });

  const key = user.email.toLowerCase();
  if (!(await isAllowed(LOGIN_BUCKET, key, LIMITS.loginAccount))) return fail("rateLimited");
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!row || !(await verifyPassword(current, row.passwordHash))) {
    await recordEvent(LOGIN_BUCKET, key);
    return fail("errors.currentWrong", { current: "errors.currentWrong" });
  }
  if (password === current) return fail("errors.passwordSame", { password: "errors.passwordSame" });

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password), mustChangePassword: false, passwordChangedAt: new Date() },
  });
  await createSession({ id: user.id, role: user.role }); // other sessions are revoked; this browser gets a fresh one
  await resetEvents(LOGIN_BUCKET, key);
  await logAudit({
    actorId: user.id, action: "user.password_change", entity: "User", entityId: user.id, summary: user.email,
    meta: { wasTemporary: user.mustChangePassword },
  });
  redirect("/dashboard", RedirectType.replace);
}

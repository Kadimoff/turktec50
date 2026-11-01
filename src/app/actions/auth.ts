"use server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { LOCALE_COOKIE } from "@/lib/constants";

const schema = z.object({ email: z.string().email(), password: z.string().min(1), next: z.string().optional() });

export type LoginState = { error?: "invalid" | "inactive" } | undefined;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase().trim() } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return { error: "invalid" };
  if (!user.active) return { error: "inactive" };
  await createSession(user);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const store = await cookies();
  if (!store.get(LOCALE_COOKIE)) store.set(LOCALE_COOKIE, user.locale, { path: "/", maxAge: 31536000, sameSite: "lax" });
  await logAudit({ actorId: user.id, action: "auth.login", entity: "User", entityId: user.id, summary: user.email });
  const next = parsed.data.next;
  redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export async function logout() {
  const user = await getCurrentUser();
  if (user) await logAudit({ actorId: user.id, action: "auth.logout", entity: "User", entityId: user.id, summary: user.email });
  await destroySession();
  redirect("/login");
}

import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession } from "@/lib/session";
import type { Role } from "@/generated/prisma/enums";

/** Rate-limit buckets of failed sign-ins (see src/app/actions/auth.ts): per lower-cased login, and per client IP (soft). */
export const LOGIN_RATE_BUCKET = "login";
export const LOGIN_IP_RATE_BUCKET = "login-ip";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** system owner (root): an ADMIN that cannot be edited/deactivated by others; only root manages ADMIN accounts */
  isRoot: boolean;
  /** signed in with a generated temporary password: must set an own password before using the app (see /account/password) */
  mustChangePassword: boolean;
  title: string | null;
  locale: string;
  universityId: string | null;
};

/** Current user for this request (memoized). Returns null when not signed in or deactivated. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.uid },
    select: {
      id: true, name: true, email: true, role: true, isRoot: true, mustChangePassword: true, title: true, locale: true, universityId: true, active: true,
      passwordChangedAt: true,
    },
  });
  if (!user || !user.active) return null;
  // a password change / reset revokes every session issued before it (JWT iat has 1-second resolution)
  if (user.passwordChangedAt && (session.iat ?? 0) < Math.floor(user.passwordChangedAt.getTime() / 1000)) return null;
  return {
    id: user.id, name: user.name, email: user.email, role: user.role, isRoot: user.isRoot, mustChangePassword: user.mustChangePassword,
    title: user.title, locale: user.locale, universityId: user.universityId,
  };
});

/** Use in server components / actions. Redirects to /login if not signed in, to /dashboard?denied=1 if role not allowed. */
export async function requireUser(roles?: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  // The proxy only checks the cookie signature. A valid cookie of a deleted / deactivated user (e.g. after a re-seed)
  // reaches here: send it to /login?expired=1, where the proxy drops the cookie instead of bouncing back (redirect loop).
  if (!user) redirect("/login?expired=1");
  if (roles && !roles.includes(user.role)) redirect("/dashboard?denied=1");
  return user;
}

export async function createSession(user: { id: string; role: Role }) {
  const token = await signSession({ uid: user.id, role: user.role });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "1",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

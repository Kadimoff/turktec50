import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/** Sign-in pages: open without a session; a signed-in user is sent to the dashboard. */
const AUTH = ["/login"];
/** Always open (with or without a session): the public student intake form and its tracking pages. */
const OPEN = ["/apply"];
/** Public intake server actions carry small forms only (the app-wide action limit is 16mb). */
const OPEN_ACTION_MAX_BYTES = 64 * 1024;
const under = (pathname: string, list: string[]) => list.some((p) => pathname === p || pathname.startsWith(p + "/"));

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  const isAuthPage = under(pathname, AUTH);
  const isOpen = under(pathname, OPEN);

  if (isOpen) {
    if (request.method === "POST" && request.headers.has("next-action")) {
      const size = Number(request.headers.get("content-length") ?? "0");
      if (!Number.isFinite(size) || size > OPEN_ACTION_MAX_BYTES) return new NextResponse(null, { status: 413 });
    }
    return NextResponse.next();
  }

  if (!session && pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!session && !isAuthPage) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (session && isAuthPage && request.nextUrl.searchParams.get("expired") === "1") {
    const res = NextResponse.next();
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
  if (session && (isAuthPage || pathname === "/")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt)$).*)"],
};

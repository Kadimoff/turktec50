import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");

function notFound() {
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
}

/** RFC 5987/6266 Content-Disposition with an ASCII fallback and a UTF-8 filename*. */
function contentDisposition(fileName: string) {
  const ascii = fileName.normalize("NFKD").replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "document";
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/**
 * GET /api/documents/:id — download one document version.
 * - 401 when not signed in; 404 when the document is outside the user's project scope (no existence leak);
 * - jury never receives confidential documents (trade secrets / patentable material) — 404.
 */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/documents/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const { id } = await ctx.params;

  const doc = await prisma.document.findFirst({
    where: { id, project: projectScope(user), ...(user.role === "JURY" ? { confidential: false } : {}) },
    select: { fileName: true, storedName: true, mimeType: true },
  });
  if (!doc) return notFound();

  // Path traversal guard: only the basename of the stored name is ever used, and it must resolve inside UPLOAD_DIR.
  const safeName = path.basename(doc.storedName);
  const filePath = path.join(UPLOAD_DIR, safeName);
  if (!safeName || safeName.startsWith(".") || path.dirname(filePath) !== UPLOAD_DIR) return notFound();

  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) return notFound();
  } catch {
    return notFound();
  }

  const stream = Readable.toWeb(fs.createReadStream(filePath)) as ReadableStream<Uint8Array>;
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": doc.mimeType || "application/octet-stream",
      "Content-Length": String(stat.size),
      "Content-Disposition": contentDisposition(doc.fileName),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

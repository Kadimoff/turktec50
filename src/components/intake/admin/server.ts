import "server-only";
import { headers } from "next/headers";

const HOST_RE = /^(?:[a-z0-9-]+(?:\.[a-z0-9-]+)*|\[[0-9a-f:.]+\])(?::\d{1,5})?$/i;

/**
 * Absolute URL of the public form, built from the host the coordinator is using right now
 * (so it is correct on localhost as well as on the Wi-Fi IP). Falls back to the bare path for an unexpected Host header.
 */
export async function publicApplyUrl(path = "/apply") {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0]!.trim();
  if (!HOST_RE.test(host)) return path;
  const fwd = (h.get("x-forwarded-proto") ?? "").split(",")[0]!.trim().toLowerCase();
  const proto = fwd === "https" || fwd === "http" ? fwd : "http";
  return `${proto}://${host}${path}`;
}

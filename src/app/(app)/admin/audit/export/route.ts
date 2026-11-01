import type { NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { auditWhere, parseAuditFilters } from "@/components/audit/query";
import { actionLabel, entityLabel } from "@/components/audit/labels";

const MAX_ROWS = 20000;

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  // neutralise spreadsheet formula injection, then quote
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** ADMIN: CSV export of the (filtered) audit log, UTF-8 with BOM so Excel shows ə/ğ/ş correctly. */
export async function GET(request: NextRequest) {
  await requireUser(["ADMIN"]);
  const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = parseAuditFilters(sp);
  const [t, te] = await Promise.all([getTranslations("audit"), getTranslations("enums")]);

  const rows = await prisma.auditLog.findMany({
    where: auditWhere(filters),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MAX_ROWS,
    select: {
      createdAt: true, action: true, entity: true, entityId: true, summary: true,
      actor: { select: { name: true, email: true, role: true } },
      project: { select: { code: true, title: true } },
    },
  });

  const header = [
    t("csv.time"), t("csv.actor"), t("csv.email"), t("csv.role"), t("csv.actionKey"), t("csv.action"),
    t("csv.entity"), t("csv.entityId"), t("csv.summary"), t("csv.projectCode"), t("csv.project"),
  ];
  const lines = rows.map((r) =>
    [
      r.createdAt.toISOString(), r.actor?.name ?? t("system"), r.actor?.email ?? "", r.actor ? te(`Role.${r.actor.role}`) : "",
      r.action, actionLabel(t, r.action), entityLabel(t, r.entity), r.entityId, r.summary ?? "", r.project?.code ?? "", r.project?.title ?? "",
    ].map(csvCell).join(","),
  );
  const body = "﻿" + [header.map(csvCell).join(","), ...lines].join("\r\n") + "\r\n";
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="turktech50-audit-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

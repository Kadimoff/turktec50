import type { NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { csvHeaders, toCsv } from "@/lib/csv";
import { bakuYmd } from "@/lib/dates";
import { auditWhere, parseAuditFilters } from "@/components/audit/query";
import { actionLabel, entityLabel, actorFallback } from "@/components/audit/labels";

const MAX_ROWS = 20000;

/** ADMIN: CSV export of the (filtered) audit log (UTF-8 BOM, formula-injection guard via @/lib/csv). */
export async function GET(request: NextRequest) {
  await requireUser(["ADMIN"]);
  const filters = parseAuditFilters(Object.fromEntries(request.nextUrl.searchParams.entries()));
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
  const body = toCsv([
    header,
    ...rows.map((r) => [
      r.createdAt, r.actor?.name ?? actorFallback(t, r.action), r.actor?.email ?? "", r.actor ? te(`Role.${r.actor.role}`) : "",
      r.action, actionLabel(t, r.action), entityLabel(t, r.entity), r.entityId, r.summary ?? "", r.project?.code ?? "", r.project?.title ?? "",
    ]),
  ]);
  return new Response(`${body}\r\n`, { headers: csvHeaders(`turktech50-audit-${bakuYmd(new Date())}.csv`) });
}

import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { loadMessages } from "@/i18n/request";
import { LOCALES, type Locale } from "@/lib/constants";

/** Next free project code T50-xxx (numeric max + 1). Call inside the creating transaction. */
export async function nextProjectCode(tx: Prisma.TransactionClient) {
  const rows = await tx.project.findMany({ where: { code: { startsWith: "T50-" } }, select: { code: true } });
  const max = rows.reduce((m, r) => Math.max(m, Number.parseInt(r.code.slice(4), 10) || 0), 0);
  return `T50-${String(max + 1).padStart(3, "0")}`;
}

/** Translate an enum value in each recipient's own locale (notifications store rendered params). */
export async function enumLabelByLocale(enumName: string, value: string) {
  const out: Record<string, string> = {};
  for (const l of LOCALES) {
    const m = (await loadMessages(l as Locale)) as Record<string, Record<string, Record<string, string>>>;
    out[l] = m.enums?.[enumName]?.[value] ?? value;
  }
  return out;
}

import "server-only";
import { loadMessages } from "@/i18n/request";
import { LOCALES, type Locale } from "@/lib/constants";

/** Translate an enum value in each recipient's own locale (notifications store rendered params). */
export async function enumLabelByLocale(enumName: string, value: string) {
  const out: Record<string, string> = {};
  for (const l of LOCALES) {
    const m = (await loadMessages(l as Locale)) as Record<string, Record<string, Record<string, string>>>;
    out[l] = m.enums?.[enumName]?.[value] ?? value;
  }
  return out;
}

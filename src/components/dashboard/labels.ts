import "server-only";
import { getTranslations } from "next-intl/server";

/** Translators for keys owned by other modules, with graceful fallback when a key is missing. */
export async function getFallbackLabels() {
  const [ta, td] = await Promise.all([getTranslations("audit"), getTranslations("documents")]);
  return {
    action(action: string) {
      const k = `actions.${action}`;
      return ta.has(k as never) ? ta(k as never) : action;
    },
    checklistItem(item: { key: string | null; title: string | null }) {
      if (item.key) {
        const k = `items.${item.key}.title`;
        if (td.has(k as never)) return td(k as never);
      }
      return item.title ?? item.key ?? "—";
    },
  };
}

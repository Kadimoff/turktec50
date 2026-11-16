// Text search normalisation shared by server filters and client search boxes (Azerbaijani + Turkish aware). Pure module.

/** Lower-case (tr rules), strip diacritics, ı → i, ə → e: "Məmmədov" and "memmedov" match, "İnsansız" and "insansiz" match. */
export function folded(value: string) {
  return value
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[ıə]/g, (ch) => (ch === "ı" ? "i" : "e"));
}

/** Does any of `fields` contain `query` (folded)? An empty query matches everything. */
export function matchesQuery(query: string, ...fields: (string | null | undefined)[]) {
  const q = folded(query.trim());
  if (!q) return true;
  return fields.some((f) => !!f && folded(f).includes(q));
}

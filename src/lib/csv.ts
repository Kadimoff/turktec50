// CSV export helpers. Every export goes through `csvCell`, which also guards against spreadsheet formula injection.

/** One CSV cell: quoted, quotes doubled, and a leading = + - @ tab or CR neutralised with an apostrophe. */
export function csvCell(value: unknown) {
  let s = value === null || value === undefined ? "" : value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Rows → CSV text with a UTF-8 BOM (Excel opens Azerbaijani letters correctly) and CRLF line ends.
 *  `sep` ";" suits Excel in locales with a decimal comma (az, tr). */
export function toCsv(rows: readonly (readonly unknown[])[], sep: "," | ";" = ",") {
  return "\uFEFF" + rows.map((r) => r.map(csvCell).join(sep)).join("\r\n");
}

/** Response headers for a CSV download. */
export function csvHeaders(fileName: string) {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${fileName.replace(/[^\w.-]+/g, "_")}"`,
    "Cache-Control": "no-store",
  };
}

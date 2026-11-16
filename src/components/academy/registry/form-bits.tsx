/** aria-describedby for a `Field` control: its error when present, else its hint (if the field has one). */
export function describedBy(htmlFor: string, error: string | undefined, hasHint = false) {
  return error ? `${htmlFor}-error` : hasHint ? `${htmlFor}-hint` : undefined;
}

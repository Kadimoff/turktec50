// Result of every form server action. Pure module (no server imports): import it from client components too.
// `message` and the values of `errors` are translation keys of the module's namespace (e.g. "errors.invalid", "toast.saved").
import type { z } from "zod";

export type ActionState = {
  ok: boolean;
  message?: string;
  /** field path (e.g. "email", "members.0.email") → error key */
  errors?: Record<string, string>;
  /** changes on every result so effects/toasts fire for repeated identical results */
  ts?: number;
};

export const initialActionState: ActionState = { ok: false };

export function fail(message: string, errors?: Record<string, string>): ActionState {
  return { ok: false, message, errors, ts: Date.now() };
}

export function done<T extends Record<string, unknown> = Record<never, never>>(message: string, extra?: T): ActionState & T {
  return { ok: true, message, ts: Date.now(), ...(extra as T) };
}

/** zod issues → { "path.to.field": "errors.key" }; non-key messages become `errors.invalid`. First issue per path wins. */
export function zodErrors(issues: readonly z.core.$ZodIssue[]) {
  const errors: Record<string, string> = {};
  for (const i of issues) {
    const path = i.path.map(String).join(".") || "form";
    if (!errors[path]) errors[path] = i.message.startsWith("errors.") ? i.message : "errors.invalid";
  }
  return errors;
}

/** `fail` from a zod error: the first field error becomes the message. */
export function failFromZod(error: { issues: readonly z.core.$ZodIssue[] }): ActionState {
  const errors = zodErrors(error.issues);
  return fail(Object.values(errors)[0] ?? "errors.invalid", errors);
}

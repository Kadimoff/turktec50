"use client";
import { useActionState, useTransition } from "react";
import { initialActionState, type ActionState } from "@/lib/action-state";

/**
 * The one way to submit a form to a server action.
 * Submits via onSubmit + transition (not `<form action>`), so React does not reset the fields after a failed server
 * validation; exposes `pending` for `<SubmitButton pending>` and `error(field)` for `<Field error>`.
 * `onDone` / `onFail` run once per result (toast, close the dialog, router.refresh…).
 */
export function useFormAction<S extends ActionState>(
  action: (prev: S, fd: FormData) => Promise<S>,
  opts: { initial?: S; onDone?: (state: S) => void; onFail?: (state: S) => void } = {},
) {
  const [state, dispatch, pending] = useActionState<S, FormData>(
    async (prev, fd) => {
      const next = await action(prev as S, fd);
      if (next.ok) opts.onDone?.(next);
      else opts.onFail?.(next);
      return next;
    },
    (opts.initial ?? initialActionState) as Awaited<S>,
  );
  const [, startTransition] = useTransition();
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };
  const error = (field: string) => (state.ok ? undefined : state.errors?.[field]);
  return { state, pending, onSubmit, error, dispatch };
}

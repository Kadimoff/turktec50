"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";

/**
 * GET filter form: works without JS (submit button), and with JS re-navigates as soon as a <select> changes.
 * Empty values are dropped from the URL; the page param is always reset.
 */
export function AutoSubmitForm({ action, children, className }: { action: string; children: React.ReactNode; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go(form: HTMLFormElement) {
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(form).entries()) {
      if (typeof v === "string" && v.trim() !== "" && k !== "page") params.set(k, v.trim());
    }
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${action}?${qs}` : action, { scroll: false }));
  }

  return (
    <form
      action={action}
      method="get"
      role="search"
      aria-busy={pending}
      className={cn("transition-opacity", pending && "opacity-70", className)}
      onChange={(e) => {
        if ((e.target as HTMLElement).tagName === "SELECT") go(e.currentTarget);
      }}
      onSubmit={(e) => {
        e.preventDefault();
        go(e.currentTarget);
      }}
    >
      {children}
    </form>
  );
}

"use client";
import { initials } from "@/lib/format";
export function UserAvatarClient({ name }: { name: string }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground" aria-hidden>
      {initials(name)}
    </span>
  );
}

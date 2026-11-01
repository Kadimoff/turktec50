import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

const palette = ["bg-accent text-accent-foreground", "bg-info-soft text-info", "bg-warning-soft text-warning", "bg-success-soft text-success", "bg-neutral-soft text-neutral"];

export function UserAvatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const idx = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length;
  return (
    <span
      title={name}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-semibold",
        palette[idx],
        size === "sm" && "size-7 text-[11px]",
        size === "md" && "size-9 text-xs",
        size === "lg" && "size-11 text-sm",
        className,
      )}
    >
      <span aria-hidden>{initials(name)}</span>
      <span className="sr-only">{name}</span>
    </span>
  );
}

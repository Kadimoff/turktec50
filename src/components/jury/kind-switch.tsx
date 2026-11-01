import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import type { EvalKind } from "./data";

/** Segmented MIDTERM / FINAL switch driven by the `?kind=` search param (server-rendered links). */
export async function KindSwitch({ basePath, kind, className }: { basePath: string; kind: EvalKind; className?: string }) {
  const [te, t] = await Promise.all([getTranslations("enums"), getTranslations("jury")]);
  const items: { value: EvalKind; href: string }[] = [
    { value: "MIDTERM", href: basePath },
    { value: "FINAL", href: `${basePath}?kind=final` },
  ];
  return (
    <nav aria-label={t("kindSwitch")} className={cn("inline-flex rounded-lg bg-muted p-1", className)}>
      {items.map((it) => {
        const active = it.value === kind;
        return (
          <Link
            key={it.value}
            href={it.href}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground",
              "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              active && "bg-background text-foreground shadow-sm dark:bg-input/40",
            )}
          >
            {te(`RubricKind.${it.value}`)}
          </Link>
        );
      })}
    </nav>
  );
}

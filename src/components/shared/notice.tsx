import { ShieldCheck, FlaskConical } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

/** "System makes no decisions" — show on selection, jury and evaluation screens. */
export async function HumanControlNote({ className }: { className?: string }) {
  const t = await getTranslations("common");
  return (
    <p className={cn("flex items-start gap-2 rounded-lg border border-dashed bg-card px-3 py-2.5 text-xs text-muted-foreground", className)}>
      <ShieldCheck className="mt-px size-4 shrink-0 text-primary" aria-hidden />
      <span>{t("humanControl")}</span>
    </p>
  );
}

export async function DemoNote({ className }: { className?: string }) {
  const t = await getTranslations("common");
  return (
    <p className={cn("flex items-start gap-2 text-xs text-muted-foreground", className)}>
      <FlaskConical className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>{t("demoNotice")}</span>
    </p>
  );
}

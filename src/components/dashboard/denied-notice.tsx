"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** "You don't have access" banner shown after an RBAC redirect (?denied=1). */
export function DeniedNotice() {
  const t = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-danger">
      <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="flex-1 text-sm font-medium">{t("states.forbidden")}</p>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("actions.close")}
        className="-my-1 -mr-1 text-danger hover:bg-danger/10 hover:text-danger"
        onClick={() => {
          setOpen(false);
          router.replace("/dashboard", { scroll: false });
        }}
      >
        <X aria-hidden />
      </Button>
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setRiskStatus } from "@/app/(app)/risks/actions";
import { RiskFormDialog } from "./risk-form-dialog";
import type { RiskFormValue } from "./types";

export function RiskRowActions({ risk, compact = false }: { risk: RiskFormValue; compact?: boolean }) {
  const t = useTranslations("risks");
  const [pending, start] = useTransition();
  const closed = risk.status === "CLOSED";

  function toggle() {
    start(async () => {
      const res = await setRiskStatus(risk.id, closed ? "OPEN" : "CLOSED");
      if (res.ok) toast.success(t((res.message ?? "toast.updated") as never), { description: risk.title });
      else toast.error(t((res.message ?? "errors.generic") as never));
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {!closed && <RiskFormDialog mode="edit" risk={risk} />}
      <Button
        size={compact ? "icon-sm" : "sm"}
        variant="ghost"
        className={compact ? "size-8 text-muted-foreground hover:text-foreground" : "h-8 text-muted-foreground hover:text-foreground"}
        title={compact ? (closed ? t("actions.reopen") : t("actions.close")) : undefined}
        onClick={toggle}
        disabled={pending}
        aria-busy={pending}
        aria-label={closed ? t("actions.reopenLabel", { title: risk.title }) : t("actions.closeLabel", { title: risk.title })}
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : closed ? <RotateCcw aria-hidden /> : <CheckCircle2 aria-hidden />}
        {!compact && <span>{closed ? t("actions.reopen") : t("actions.close")}</span>}
      </Button>
    </div>
  );
}

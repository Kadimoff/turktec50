"use client";

import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Read-only link field + copy button. navigator.clipboard only exists in secure contexts, so on plain HTTP
 * (e.g. the Wi-Fi IP) the link is selected in the input and the student is told to copy it by hand.
 */
export function CopyLink({ link, label, className }: { link: string; label: string; className?: string }) {
  const t = useTranslations("intake.copy");
  const uid = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");

  function selectAll() {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(0, el.value.length);
  }

  async function copy() {
    try {
      if (window.isSecureContext && navigator.clipboard) {
        await navigator.clipboard.writeText(link);
        setState("copied");
        return;
      }
    } catch {
      // fall through to the manual path
    }
    selectAll();
    setState("manual");
  }

  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={`${uid}-link`} className="text-label font-medium">{label}</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          ref={ref}
          id={`${uid}-link`}
          readOnly
          value={link}
          onFocus={selectAll}
          aria-describedby={`${uid}-status`}
          className="h-10 font-mono text-xs sm:text-xs"
        />
        <Button type="button" variant="outline" className="h-10 shrink-0" onClick={copy}>
          {state === "copied" ? <Check aria-hidden /> : <Copy aria-hidden />}
          {state === "copied" ? t("copied") : t("copy")}
        </Button>
      </div>
      <p id={`${uid}-status`} role="status" className={cn("text-xs", state === "manual" ? "font-medium text-warning" : "text-muted-foreground")}>
        {state === "manual" ? t("manual") : state === "copied" ? t("copiedHint") : t("hint")}
      </p>
    </div>
  );
}

"use client";
import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A generated temporary password, shown ONCE (it is never stored in plain text): read-only field + copy button + instructions.
 * navigator.clipboard only exists in secure contexts (https / localhost); on plain HTTP (e.g. the Wi-Fi IP) the field is selected and the
 * legacy copy command is tried, otherwise the coordinator is asked to copy by hand.
 */
export function TempPasswordBox({ password, email, className }: { password: string; email: string; className?: string }) {
  const t = useTranslations("common.user.tempPassword");
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
        await navigator.clipboard.writeText(password);
        setState("copied");
        return;
      }
    } catch {
      // fall through to the manual path
    }
    selectAll();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    setState(ok ? "copied" : "manual");
  }

  return (
    <div className={cn("grid gap-3 rounded-lg border border-warning/40 bg-warning-soft/40 p-3", className)}>
      <div className="grid gap-1.5">
        <label htmlFor={`${uid}-pw`} className="flex items-center gap-1.5 text-label font-medium">
          <KeyRound className="size-3.5 text-warning" aria-hidden />
          {t("label")}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            ref={ref}
            id={`${uid}-pw`}
            readOnly
            value={password}
            onFocus={selectAll}
            spellCheck={false}
            autoComplete="off"
            aria-describedby={`${uid}-status ${uid}-hint`}
            className="bg-background font-mono text-base md:text-base"
          />
          <Button type="button" variant="outline" size="lg" className="shrink-0" onClick={copy}>
            {state === "copied" ? <Check aria-hidden /> : <Copy aria-hidden />}
            {state === "copied" ? t("copied") : t("copy")}
          </Button>
        </div>
        <p id={`${uid}-status`} role="status" className={cn("text-xs", state === "manual" ? "font-medium text-warning" : "text-muted-foreground")}>
          {state === "manual" ? t("manual") : t("once")}
        </p>
      </div>
      <ol id={`${uid}-hint`} className="grid list-decimal gap-1 pl-4 text-xs text-muted-foreground">
        <li>{t("step1", { email })}</li>
        <li>{t("step2")}</li>
        <li>{t("step3")}</li>
      </ol>
    </div>
  );
}

"use client";

import { useId, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Copy, ExternalLink, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * "Public link" box: the /apply URL with a copy button. The Clipboard API only exists in secure contexts (https / localhost), so on the
 * Wi-Fi IP over plain HTTP it falls back to selecting the read-only field (and the legacy copy command where the browser still allows it).
 */
export function PublicLinkBox({ url }: { url: string }) {
  const t = useTranslations("intakeAdmin.publicLink");
  const ref = useRef<HTMLInputElement>(null);
  const id = useId();

  function select() {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
    el.setSelectionRange(0, el.value.length);
  }

  async function copy() {
    try {
      if (window.isSecureContext && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        toast.success(t("copied"));
        return;
      }
    } catch {
      // fall through to the manual fallback
    }
    select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    if (ok) toast.success(t("copied"));
    else toast.info(t("selected"));
  }

  return (
    <section className="rounded-xl border bg-card p-4 shadow-card" aria-labelledby={`${id}-title`}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between xl:gap-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground" aria-hidden>
            <Link2 className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 id={`${id}-title`} className="text-sm font-semibold">{t("title")}</h2>
            <p className="text-xs text-pretty text-muted-foreground">{t("description")}</p>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center xl:w-[min(100%,34rem)] xl:shrink-0">
          <label htmlFor={`${id}-url`} className="sr-only">{t("label")}</label>
          <Input
            ref={ref}
            id={`${id}-url`}
            readOnly
            value={url}
            onFocus={select}
            onClick={select}
            className="min-w-0 flex-1 font-mono text-xs md:text-xs"
            aria-describedby={`${id}-hint`}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="lg" className="flex-1 sm:flex-none" onClick={copy}>
              <Copy aria-hidden />
              {t("copy")}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="flex-1 sm:flex-none"
              nativeButton={false}
              render={<a href={url} target="_blank" rel="noopener noreferrer" aria-label={t("openLabel")} />}
            >
              <ExternalLink aria-hidden />
              {t("open")}
            </Button>
          </div>
        </div>
      </div>
      <p id={`${id}-hint`} className="mt-2 text-2xs text-muted-foreground">{t("hint")}</p>
    </section>
  );
}

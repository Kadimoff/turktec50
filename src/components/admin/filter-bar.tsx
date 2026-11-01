import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** GET filter form (works without JS, keeps state in the URL). Children are labelled fields. */
export async function FilterBar({ action, children, clearHref, active, className }: { action: string; children: React.ReactNode; clearHref: string; active: boolean; className?: string }) {
  const tc = await getTranslations("common");
  return (
    <form action={action} method="get" role="search" className={cn("rounded-xl border bg-card p-4 shadow-card", className)}>
      <div className="grid items-end gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
        {children}
        <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
          <Button type="submit" size="lg" className="h-9 flex-1 lg:flex-none">
            <Search className="size-4" aria-hidden />
            {tc("actions.filter")}
          </Button>
          {active && (
            <Button variant="ghost" size="lg" className="h-9" nativeButton={false} render={<Link href={clearHref} />}>
              <X className="size-4" aria-hidden />
              {tc("actions.clear")}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

export function FilterField({ label, htmlFor, children, className }: { label: string; htmlFor: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-1.5 lg:min-w-40", className)}>
      <label htmlFor={htmlFor} className="text-xs font-semibold tracking-wide text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

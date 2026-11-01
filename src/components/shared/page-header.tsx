import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        {eyebrow && <p className="text-xs font-semibold tracking-wide text-primary">{eyebrow}</p>}
        <h1 className="text-2xl font-bold tracking-tight text-balance text-foreground sm:text-[1.7rem]">{title}</h1>
        {description && <p className="max-w-3xl text-sm text-pretty text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 no-print">{actions}</div>}
    </div>
  );
}

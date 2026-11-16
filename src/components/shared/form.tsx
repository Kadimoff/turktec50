"use client";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Labeled form field with helper text and inline error (error near field, never placeholder-only labels).
 * `content-start` keeps fields in one grid row aligned when only one of them has a hint or an error.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-label font-medium">
        <span>
          {label}
          {required && <span className="ms-0.5 text-danger" aria-hidden>*</span>}
        </span>
      </Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The one submit button. Pass `pending` from `useFormAction` (onSubmit forms); without it, the pending state of a
 * parent `<form action>` is used. Default size `lg` (h-9) matches inputs and selects.
 */
export function SubmitButton({
  children,
  pendingLabel,
  pending: pendingProp,
  className,
  variant,
  size = "lg",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  pending?: boolean;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} className={className} variant={variant} size={size}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

/** Native select styled like shadcn inputs — reliable inside server-action forms. */
export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, FileUp, Lock, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Field, SubmitButton } from "@/components/shared/form";
import { useFormAction } from "@/components/shared/use-form-action";
import { UPLOAD } from "@/lib/constants";
import { fmtBytes } from "@/lib/format";
import { uploadDocument } from "@/app/(app)/projects/[id]/documents/actions";

const ACCEPT = [...UPLOAD.allowedMime, ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".mp4", ".zip", ".docx", ".xlsx", ".pptx", ".txt"].join(",");
const EXT_OK = /\.(pdf|png|jpe?g|webp|mp4|zip|docx|xlsx|pptx|txt)$/i;

type Props = {
  projectId: string;
  itemId: string;
  itemLabel: string;
  nextVersion: number;
  conditional: boolean;
};

export function UploadDialog(props: Props) {
  const t = useTranslations("documents");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" variant={props.nextVersion > 1 ? "outline" : "default"} />}>
        <Upload aria-hidden />
        {props.nextVersion > 1 ? t("upload.newVersion") : t("upload.button")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("upload.title")}</DialogTitle>
          <DialogDescription>{t("upload.description", { item: props.itemLabel, n: props.nextVersion })}</DialogDescription>
        </DialogHeader>
        {/* the popup unmounts when closed, so the form (file, errors) starts fresh on every open */}
        <UploadForm {...props} close={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function UploadForm({ projectId, itemId, itemLabel, nextVersion, conditional, close }: Props & { close: () => void }) {
  const t = useTranslations("documents");
  const tc = useTranslations("common.actions");
  const uid = useId();
  const [file, setFile] = useState<File | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const size = fmtBytes(UPLOAD.maxBytes);

  const { pending, onSubmit, error } = useFormAction(uploadDocument, {
    onDone: (res) => {
      toast.success(t("toast.uploaded"), { description: `${itemLabel} · v${res.version ?? nextVersion}` });
      close();
    },
    onFail: (res) => toast.error(t((res.message ?? "errors.generic") as "errors.fileTooLarge", { size })),
  });

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (!f) return setClientError(null);
    if (f.size > UPLOAD.maxBytes) return setClientError("errors.fileTooLarge");
    const typeOk = (UPLOAD.allowedMime as readonly string[]).includes(f.type) || EXT_OK.test(f.name);
    setClientError(typeOk ? null : "errors.fileType");
  }

  const fileError = clientError ?? error("file");
  const fileId = `${uid}-file`;
  const confId = `${uid}-conf`;

  return (
    <form
      onSubmit={(e) => {
        if (clientError) return e.preventDefault();
        onSubmit(e);
      }}
      className="grid gap-4"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="itemId" value={itemId} />
      {conditional && (
        <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs font-medium text-warning">
          <AlertTriangle className="mt-px size-4 shrink-0" aria-hidden />
          {t("upload.conditionalWarning")}
        </p>
      )}
      <Field label={t("upload.file")} htmlFor={fileId} required error={fileError ? t(fileError as "errors.fileTooLarge", { size }) : undefined} hint={t("upload.fileHint", { size })}>
        <label
          htmlFor={fileId}
          className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-input bg-muted/40 px-3 py-4 text-center transition-colors hover:bg-muted has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
        >
          <FileUp className="size-5 text-muted-foreground" aria-hidden />
          <span className="max-w-full truncate text-sm font-medium">
            {file ? t("upload.selected", { name: file.name, size: fmtBytes(file.size) }) : t("upload.file")}
          </span>
          <input
            id={fileId}
            name="file"
            type="file"
            required
            accept={ACCEPT}
            onChange={onFile}
            className="sr-only"
            aria-invalid={!!fileError}
            aria-describedby={fileError ? `${fileId}-error` : `${fileId}-hint`}
          />
        </label>
      </Field>
      <div className="flex items-start gap-2.5 rounded-lg border p-3">
        <input id={confId} name="confidential" type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" aria-describedby={`${confId}-hint`} />
        <div className="grid gap-0.5">
          <label htmlFor={confId} className="inline-flex items-center gap-1.5 text-label font-medium">
            <Lock className="size-3.5 text-warning" aria-hidden />
            {t("upload.confidential")}
          </label>
          <p id={`${confId}-hint`} className="text-xs text-muted-foreground">{t("upload.confidentialHint")}</p>
        </div>
      </div>
      {pending && (
        <div className="grid gap-1.5" role="status" aria-live="polite">
          <p className="text-xs text-muted-foreground">{t("upload.progress")}</p>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="absolute inset-y-0 left-0 w-1/3 animate-pulse rounded-full bg-primary" />
          </div>
        </div>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={close}>
          {tc("cancel")}
        </Button>
        <SubmitButton pending={pending} pendingLabel={t("upload.pending")}>
          <Upload className="size-4" aria-hidden />
          {t("upload.submit")}
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}

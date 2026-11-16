"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect, SubmitButton } from "@/components/shared/form";
import { useFormAction } from "@/components/shared/use-form-action";
import { CATEGORIES } from "@/lib/constants";
import { createTeamApplication } from "@/app/(app)/academy/teams/actions";
import type { ApplicationTeamValue } from "./types";

/** "Create application" from an eligible Academy team. Records an application only — people decide. */
export function CreateApplicationDialog({ team, note, compact = false }: { team: ApplicationTeamValue; note: React.ReactNode; compact?: boolean }) {
  const t = useTranslations("teams");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size={compact ? "default" : "lg"} aria-label={t("application.triggerLabel", { team: team.name })} />}>
        <FilePlus2 aria-hidden />
        {t("application.trigger")}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("application.title")}</DialogTitle>
          <DialogDescription>{t("application.description", { team: team.name })}</DialogDescription>
        </DialogHeader>
        {note}
        <dl className="grid gap-x-4 gap-y-2 rounded-lg border border-dashed p-3 text-xs sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-muted-foreground">{t("application.team")}</dt>
            <dd className="font-medium text-pretty">{team.name} · {tc("members", { count: team.memberCount })}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground">{t("application.contact")}</dt>
            <dd className="font-medium break-words">{team.captainName}</dd>
            <dd className="break-all text-muted-foreground">{team.captainEmail}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground">{t("application.university")}</dt>
            <dd className="font-medium text-pretty">{team.university}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground">{t("application.competition")}</dt>
            <dd className="font-medium text-pretty">{team.competition}</dd>
          </div>
        </dl>
        {/* the popup unmounts when closed, so the form (and its errors) starts fresh on every open */}
        <ApplicationForm team={team} close={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ApplicationForm({ team, close }: { team: ApplicationTeamValue; close: () => void }) {
  const t = useTranslations("teams");
  const tc = useTranslations("common");
  const router = useRouter();
  const uid = useId();
  const id = (s: string) => `${uid}-${s}`;
  const { pending, onSubmit, error } = useFormAction(createTeamApplication, {
    onDone: (res) => {
      const appId = res.applicationId;
      toast.success(t("toast.applicationCreated", { code: res.code ?? "" }), {
        description: team.name,
        action: appId ? { label: t("application.openApplication"), onClick: () => router.push(`/applications/${appId}`) } : undefined,
        duration: 10_000,
      });
      close();
    },
    onFail: (res) => toast.error(t((res.message ?? "errors.generic") as never)),
  });
  const err = (k: string) => {
    const key = error(k);
    return key ? t(key as never) : undefined;
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="teamId" value={team.id} />
      <Field label={t("application.projectTitle")} htmlFor={id("title")} required error={err("projectTitle")}>
        <Input id={id("title")} name="projectTitle" required minLength={3} maxLength={160} aria-invalid={!!err("projectTitle")} />
      </Field>
      <Field label={t("application.problem")} htmlFor={id("problem")} required hint={t("application.problemHint")} error={err("problem")}>
        <Textarea id={id("problem")} name="problem" required minLength={20} maxLength={2000} rows={3} aria-invalid={!!err("problem")} />
      </Field>
      <Field label={t("application.solution")} htmlFor={id("solution")} required hint={t("application.solutionHint")} error={err("solution")}>
        <Textarea id={id("solution")} name="solution" required minLength={20} maxLength={2000} rows={3} aria-invalid={!!err("solution")} />
      </Field>
      <Field label={t("application.category")} htmlFor={id("category")} required error={err("category")}>
        <NativeSelect id={id("category")} name="category" defaultValue="" required aria-invalid={!!err("category")}>
          <option value="" disabled>{t("application.categoryPlaceholder")}</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{tc(`categories.${c}`)}</option>)}
        </NativeSelect>
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={close}>{tc("actions.cancel")}</Button>
        <SubmitButton pending={pending} pendingLabel={t("application.pending")}>{t("application.submit")}</SubmitButton>
      </DialogFooter>
    </form>
  );
}

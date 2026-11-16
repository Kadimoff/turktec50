"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, NativeSelect, SubmitButton } from "@/components/shared/form";
import { useFormAction } from "@/components/shared/use-form-action";
import { createProject, type CreateProjectState } from "@/app/(app)/projects/actions";

type Opt = { value: string; label: string };

type Options = { categories: Opt[]; universities: Opt[]; competitions: Opt[] };

export function NewProjectDialog(props: Options) {
  const t = useTranslations("projects.create");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" />}>
        <Plus aria-hidden />
        {t("button")}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {/* mounted per opening, so a reopened dialog starts without old errors */}
        <NewProjectForm {...props} onCreated={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function NewProjectForm({ categories, universities, competitions, onCreated }: Options & { onCreated: () => void }) {
  const t = useTranslations("projects.create");
  const tc = useTranslations("common");
  const router = useRouter();
  const { pending, onSubmit, error } = useFormAction<CreateProjectState>(createProject, {
    onDone: (s) => {
      toast.success(t("toast", { code: s.code ?? "" }));
      onCreated();
      if (s.projectId) router.push(`/projects/${s.projectId}`);
    },
    onFail: (s) => {
      if (!s.errors) toast.error(t(s.message ?? "errors.error"));
    },
  });

  const err = (k: string) => {
    const key = error(k);
    return key ? t(key) : undefined;
  };
  const aria = (k: string, id: string) => ({ "aria-invalid": !!error(k) || undefined, "aria-describedby": error(k) ? `${id}-error` : undefined });

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <Field label={t("fields.title")} htmlFor="np-title" required error={err("title")}>
        <Input id="np-title" name="title" required maxLength={80} {...aria("title", "np-title")} />
      </Field>
      <Field label={t("fields.tagline")} htmlFor="np-tagline" required hint={t("fields.taglineHint")} error={err("tagline")}>
        <Input id="np-tagline" name="tagline" required maxLength={160} {...aria("tagline", "np-tagline")} />
      </Field>
      <Field label={t("fields.summary")} htmlFor="np-summary" required error={err("summary")}>
        <Textarea id="np-summary" name="summary" required rows={3} maxLength={2000} {...aria("summary", "np-summary")} />
      </Field>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label={t("fields.category")} htmlFor="np-category" required error={err("category")}>
          <NativeSelect id="np-category" name="category" required defaultValue="" {...aria("category", "np-category")}>
            <option value="" disabled>{t("choose")}</option>
            {categories.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </NativeSelect>
        </Field>
        <Field label={t("fields.university")} htmlFor="np-university" required error={err("universityId")}>
          <NativeSelect id="np-university" name="universityId" required defaultValue="" {...aria("universityId", "np-university")}>
            <option value="" disabled>{t("choose")}</option>
            {universities.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </NativeSelect>
        </Field>
      </div>
      <Field label={t("fields.competition")} htmlFor="np-competition" hint={t("fields.competitionHint")} error={err("competitionId")}>
        <NativeSelect id="np-competition" name="competitionId" defaultValue="" {...aria("competitionId", "np-competition")}>
          <option value="">{t("noCompetition")}</option>
          {competitions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </NativeSelect>
      </Field>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" size="lg" />}>{tc("actions.cancel")}</DialogClose>
        <SubmitButton pending={pending} pendingLabel={t("creating")}>{tc("actions.create")}</SubmitButton>
      </DialogFooter>
    </form>
  );
}

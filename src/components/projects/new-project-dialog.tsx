"use client";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, NativeSelect, SubmitButton } from "@/components/shared/form";
import { createProject, type CreateProjectState } from "@/app/(app)/projects/actions";

type Opt = { value: string; label: string };

export function NewProjectDialog({ categories, universities, competitions }: { categories: Opt[]; universities: Opt[]; competitions: Opt[] }) {
  const t = useTranslations("projects.create");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<CreateProjectState, FormData>(createProject, undefined);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(t("toast", { code: state.code }));
      router.push(`/projects/${state.projectId}`);
    } else if (state.error === "error") toast.error(tc("states.error"));
  }, [state, t, tc, router]);

  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};
  const err = (k: keyof typeof fe) => (fe[k] ? t(`errors.${fe[k]}`) : undefined);
  const aria = (k: keyof typeof fe, id: string) => ({ "aria-invalid": !!fe[k] || undefined, "aria-describedby": fe[k] ? `${id}-error` : undefined });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="h-9" />}>
        <Plus aria-hidden />
        {t("button")}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-4" noValidate>
          <Field label={t("fields.title")} htmlFor="np-title" required error={err("title")}>
            <Input id="np-title" name="title" required maxLength={80} className="h-9" {...aria("title", "np-title")} />
          </Field>
          <Field label={t("fields.tagline")} htmlFor="np-tagline" required hint={t("fields.taglineHint")} error={err("tagline")}>
            <Input id="np-tagline" name="tagline" required maxLength={160} className="h-9" {...aria("tagline", "np-tagline")} />
          </Field>
          <Field label={t("fields.summary")} htmlFor="np-summary" required error={err("summary")}>
            <Textarea id="np-summary" name="summary" required rows={3} maxLength={2000} {...aria("summary", "np-summary")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
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
          <Field label={t("fields.competition")} htmlFor="np-competition" hint={t("fields.competitionHint")}>
            <NativeSelect id="np-competition" name="competitionId" defaultValue="">
              <option value="">{t("noCompetition")}</option>
              {competitions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </NativeSelect>
          </Field>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" className="h-9" />}>{tc("actions.cancel")}</DialogClose>
            <SubmitButton className="h-9" pendingLabel={t("creating")}>{tc("actions.create")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

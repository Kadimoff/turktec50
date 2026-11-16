"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect, SubmitButton } from "@/components/shared/form";
import { useFormAction } from "@/components/shared/use-form-action";
import type { ActionState } from "@/lib/action-state";
import { saveFaculty, saveLab, savePartner } from "@/app/(app)/academy/registry/actions";
import { describedBy } from "./form-bits";
import {
  LAB_STATUSES, PARTNER_STATUSES, REGISTRY_STATUSES,
  type FacultyOption, type FacultyValue, type LabValue, type PartnerValue, type RegistryKind, type UniversityOption,
} from "./types";

type Save = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/** Dialog shell shared by the three registry forms: trigger (create button / edit icon) and header. */
function RecordDialog({
  kind, editName, children,
}: {
  kind: RegistryKind;
  /** present → edit mode */
  editName?: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const t = useTranslations("registry");
  const [open, setOpen] = useState(false);
  const edit = editName !== undefined;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {edit ? (
        <DialogTrigger
          render={<Button size="icon-lg" variant="ghost" className="text-muted-foreground hover:text-foreground" aria-label={t("actions.editLabel", { name: editName })} title={t("actions.edit")} />}
        >
          <Pencil aria-hidden />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button size="lg" />}>
          <Plus aria-hidden />
          {t(`${kind}.create`)}
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{edit ? t(`${kind}.editTitle`) : t(`${kind}.createTitle`)}</DialogTitle>
          <DialogDescription>{t(`${kind}.dialogDescription`)}</DialogDescription>
        </DialogHeader>
        {/* the popup unmounts when closed, so the form (and its action state) starts fresh on every open */}
        {children(() => setOpen(false))}
      </DialogContent>
    </Dialog>
  );
}

/** `useFormAction` with the registry toasts: close on success, translated field errors otherwise. */
function useRegistryForm(save: Save, close: () => void) {
  const t = useTranslations("registry");
  const { onSubmit, pending, error } = useFormAction(save, {
    onDone: (res) => {
      toast.success(t((res.message ?? "toast.updated") as never));
      close();
    },
    onFail: (res) => toast.error(t((res.message ?? "errors.generic") as never)),
  });
  const err = (k: string) => {
    const key = error(k);
    return key ? t(key as never) : undefined;
  };
  return { onSubmit, pending, err };
}

function FormFooter({ close, pending, edit }: { close: () => void; pending: boolean; edit: boolean }) {
  const t = useTranslations("registry");
  const tc = useTranslations("common.actions");
  return (
    <DialogFooter>
      <Button type="button" variant="outline" size="lg" onClick={close} disabled={pending}>{tc("cancel")}</Button>
      <SubmitButton pending={pending} pendingLabel={t("form.pending")}>{edit ? tc("save") : tc("create")}</SubmitButton>
    </DialogFooter>
  );
}

function NotesField({ id, defaultValue, err }: { id: string; defaultValue?: string | null; err: (k: string) => string | undefined }) {
  const t = useTranslations("registry");
  return (
    <Field label={t("fields.notes")} htmlFor={id} hint={t("fields.notesHint")} error={err("notes")}>
      <Textarea id={id} name="notes" defaultValue={defaultValue ?? ""} rows={3} maxLength={2000} aria-invalid={!!err("notes")} aria-describedby={describedBy(id, err("notes"), true)} />
    </Field>
  );
}

// ---------- faculty ----------

export function FacultyDialog({ faculty, universities, defaultUniversityId }: { faculty?: FacultyValue; universities: UniversityOption[]; defaultUniversityId?: string }) {
  return (
    <RecordDialog kind="faculty" editName={faculty?.name}>
      {(close) => <FacultyForm faculty={faculty} universities={universities} defaultUniversityId={defaultUniversityId} close={close} />}
    </RecordDialog>
  );
}

function FacultyForm({ faculty, universities, defaultUniversityId, close }: { faculty?: FacultyValue; universities: UniversityOption[]; defaultUniversityId?: string; close: () => void }) {
  const t = useTranslations("registry");
  const te = useTranslations("enums");
  const uid = useId();
  const f = (s: string) => `${uid}-${s}`;
  const { onSubmit, pending, err } = useRegistryForm(saveFaculty, close);
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {faculty && <input type="hidden" name="id" value={faculty.id} />}
      <Field label={t("fields.university")} htmlFor={f("uni")} required hint={t("fields.universityHint")} error={err("universityId")}>
        <NativeSelect id={f("uni")} name="universityId" defaultValue={faculty?.universityId ?? defaultUniversityId ?? ""} required aria-invalid={!!err("universityId")} aria-describedby={describedBy(f("uni"), err("universityId"), true)}>
          <option value="" disabled>{t("fields.chooseUniversity")}</option>
          {universities.map((u) => <option key={u.id} value={u.id}>{u.shortName} — {u.name}</option>)}
        </NativeSelect>
      </Field>
      <Field label={t("fields.facultyName")} htmlFor={f("name")} required hint={t("fields.facultyNameHint")} error={err("name")}>
        <Input id={f("name")} name="name" defaultValue={faculty?.name} required minLength={2} maxLength={160} autoComplete="off" aria-invalid={!!err("name")} aria-describedby={describedBy(f("name"), err("name"), true)} />
      </Field>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label={t("fields.coordinator")} htmlFor={f("coord")} hint={t("fields.coordinatorHint")} error={err("coordinator")}>
          <Input id={f("coord")} name="coordinator" defaultValue={faculty?.coordinator ?? ""} maxLength={160} autoComplete="off" aria-invalid={!!err("coordinator")} aria-describedby={describedBy(f("coord"), err("coordinator"), true)} />
        </Field>
        <Field label={t("fields.status")} htmlFor={f("status")} required error={err("status")}>
          <NativeSelect id={f("status")} name="status" defaultValue={faculty?.status ?? "ACTIVE"} aria-invalid={!!err("status")}>
            {REGISTRY_STATUSES.map((s) => <option key={s} value={s}>{te(`RegistryStatus.${s}`)}</option>)}
          </NativeSelect>
        </Field>
      </div>
      <NotesField id={f("notes")} defaultValue={faculty?.notes} err={err} />
      <FormFooter close={close} pending={pending} edit={!!faculty} />
    </form>
  );
}

// ---------- lab ----------

export function LabDialog({ lab, universities, faculties, defaultUniversityId }: { lab?: LabValue; universities: UniversityOption[]; faculties: FacultyOption[]; defaultUniversityId?: string }) {
  return (
    <RecordDialog kind="lab" editName={lab?.name}>
      {(close) => <LabForm lab={lab} universities={universities} faculties={faculties} defaultUniversityId={defaultUniversityId} close={close} />}
    </RecordDialog>
  );
}

function LabForm({ lab, universities, faculties, defaultUniversityId, close }: { lab?: LabValue; universities: UniversityOption[]; faculties: FacultyOption[]; defaultUniversityId?: string; close: () => void }) {
  const t = useTranslations("registry");
  const te = useTranslations("enums");
  const uid = useId();
  const f = (s: string) => `${uid}-${s}`;
  const { onSubmit, pending, err } = useRegistryForm(saveLab, close);
  const [universityId, setUniversityId] = useState(lab?.universityId ?? defaultUniversityId ?? "");
  const [facultyId, setFacultyId] = useState(lab?.facultyId ?? "");
  // archived faculties are not offered for new links — except the one this lab already belongs to
  const options = faculties.filter((x) => x.universityId === universityId && (x.status !== "ARCHIVED" || x.id === lab?.facultyId));
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {lab && <input type="hidden" name="id" value={lab.id} />}
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label={t("fields.university")} htmlFor={f("uni")} required error={err("universityId")}>
          <NativeSelect
            id={f("uni")} name="universityId" value={universityId} required aria-invalid={!!err("universityId")} aria-describedby={describedBy(f("uni"), err("universityId"))}
            onChange={(e) => { setUniversityId(e.target.value); setFacultyId(""); }}
          >
            <option value="" disabled>{t("fields.chooseUniversity")}</option>
            {universities.map((u) => <option key={u.id} value={u.id}>{u.shortName}</option>)}
          </NativeSelect>
        </Field>
        <Field label={t("fields.faculty")} htmlFor={f("fac")} hint={options.length === 0 && universityId ? t("fields.facultyNoneAvailable") : t("fields.facultyHint")} error={err("facultyId")}>
          <NativeSelect id={f("fac")} name="facultyId" value={facultyId} onChange={(e) => setFacultyId(e.target.value)} disabled={!universityId} aria-invalid={!!err("facultyId")} aria-describedby={describedBy(f("fac"), err("facultyId"), true)}>
            <option value="">{t("fields.facultyNone")}</option>
            {options.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </NativeSelect>
        </Field>
      </div>
      <Field label={t("fields.labName")} htmlFor={f("name")} required error={err("name")}>
        <Input id={f("name")} name="name" defaultValue={lab?.name} required minLength={2} maxLength={160} autoComplete="off" aria-invalid={!!err("name")} aria-describedby={describedBy(f("name"), err("name"))} />
      </Field>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label={t("fields.contact")} htmlFor={f("contact")} hint={t("fields.contactHint")} error={err("contact")}>
          <Input id={f("contact")} name="contact" defaultValue={lab?.contact ?? ""} maxLength={200} autoComplete="off" aria-invalid={!!err("contact")} aria-describedby={describedBy(f("contact"), err("contact"), true)} />
        </Field>
        <Field label={t("fields.status")} htmlFor={f("status")} required hint={t("fields.labStatusHint")} error={err("status")}>
          <NativeSelect id={f("status")} name="status" defaultValue={lab?.status ?? "AVAILABLE"} aria-invalid={!!err("status")} aria-describedby={describedBy(f("status"), err("status"), true)}>
            {LAB_STATUSES.map((s) => <option key={s} value={s}>{te(`LabStatus.${s}`)}</option>)}
          </NativeSelect>
        </Field>
      </div>
      <NotesField id={f("notes")} defaultValue={lab?.notes} err={err} />
      <FormFooter close={close} pending={pending} edit={!!lab} />
    </form>
  );
}

// ---------- partner ----------

export function PartnerDialog({ partner }: { partner?: PartnerValue }) {
  return (
    <RecordDialog kind="partner" editName={partner?.name}>
      {(close) => <PartnerForm partner={partner} close={close} />}
    </RecordDialog>
  );
}

function PartnerForm({ partner, close }: { partner?: PartnerValue; close: () => void }) {
  const t = useTranslations("registry");
  const te = useTranslations("enums");
  const uid = useId();
  const f = (s: string) => `${uid}-${s}`;
  const { onSubmit, pending, err } = useRegistryForm(savePartner, close);
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {partner && <input type="hidden" name="id" value={partner.id} />}
      <Field label={t("fields.partnerName")} htmlFor={f("name")} required error={err("name")}>
        <Input id={f("name")} name="name" defaultValue={partner?.name} required minLength={2} maxLength={160} autoComplete="off" aria-invalid={!!err("name")} aria-describedby={describedBy(f("name"), err("name"))} />
      </Field>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label={t("fields.sector")} htmlFor={f("sector")} hint={t("fields.sectorHint")} error={err("sector")}>
          <Input id={f("sector")} name="sector" defaultValue={partner?.sector ?? ""} maxLength={120} autoComplete="off" aria-invalid={!!err("sector")} aria-describedby={describedBy(f("sector"), err("sector"), true)} />
        </Field>
        <Field label={t("fields.status")} htmlFor={f("status")} required error={err("status")}>
          <NativeSelect id={f("status")} name="status" defaultValue={partner?.status ?? "CANDIDATE"} aria-invalid={!!err("status")}>
            {PARTNER_STATUSES.map((s) => <option key={s} value={s}>{te(`PartnerStatus.${s}`)}</option>)}
          </NativeSelect>
        </Field>
      </div>
      <Field label={t("fields.contact")} htmlFor={f("contact")} hint={t("fields.partnerContactHint")} error={err("contact")}>
        <Input id={f("contact")} name="contact" defaultValue={partner?.contact ?? ""} maxLength={200} autoComplete="off" aria-invalid={!!err("contact")} aria-describedby={describedBy(f("contact"), err("contact"), true)} />
      </Field>
      <NotesField id={f("notes")} defaultValue={partner?.notes} err={err} />
      <FormFooter close={close} pending={pending} edit={!!partner} />
    </form>
  );
}

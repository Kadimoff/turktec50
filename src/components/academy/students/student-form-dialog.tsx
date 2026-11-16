"use client";

import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Crown, Info, Pencil, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect, SubmitButton } from "@/components/shared/form";
import { useFormAction } from "@/components/shared/use-form-action";
import { saveStudent } from "@/app/(app)/academy/students/actions";
import { useStudentOptions } from "./student-options";
import { PICKABLE_STUDENT_STATUSES, type StudentFormValue } from "./types";

type Props = { mode: "create"; student?: undefined } | { mode: "edit"; student: StudentFormValue };

export function StudentFormDialog(props: Props) {
  const t = useTranslations("teams");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.mode === "create" ? (
        <DialogTrigger render={<Button size="lg" />}>
          <UserPlus aria-hidden />
          {t("students.form.create")}
        </DialogTrigger>
      ) : (
        <DialogTrigger
          render={<Button size="icon-sm" variant="ghost" className="size-8 text-muted-foreground hover:text-foreground" aria-label={t("students.actions.editLabel", { name: props.student.name })} />}
        >
          <Pencil aria-hidden />
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{props.mode === "create" ? t("students.form.createTitle") : t("students.form.editTitle")}</DialogTitle>
          <DialogDescription>{props.mode === "create" ? t("students.form.createDescription") : t("students.form.editDescription")}</DialogDescription>
        </DialogHeader>
        {/* the popup unmounts when closed, so the form (state, errors) starts fresh on every open */}
        <StudentForm student={props.student} close={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function StudentForm({ student: s, close }: { student?: StudentFormValue; close: () => void }) {
  const t = useTranslations("teams");
  const te = useTranslations("enums");
  const tc = useTranslations("common.actions");
  const opts = useStudentOptions();
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;

  const [universityId, setUniversityId] = useState(s?.universityId ?? opts.defaultUniversityId);
  const [facultyId, setFacultyId] = useState(s?.facultyId ?? "");
  const [teamId, setTeamId] = useState(s?.teamId ?? "");
  const [status, setStatus] = useState<string>(s?.status ?? "SEEKING_TEAM");
  const nameRef = useRef<HTMLInputElement>(null);

  const { pending, onSubmit, error } = useFormAction(saveStudent, {
    onDone: (res) => {
      toast.success(t((res.message ?? "toast.studentUpdated") as never), { description: nameRef.current?.value });
      close();
    },
    onFail: (res) => toast.error(t((res.message ?? "errors.generic") as never)),
  });
  const err = (k: string) => {
    const key = error(k);
    return key ? t(key as never) : undefined;
  };

  const faculties = opts.faculties.filter((f) => f.universityId === universityId && (!f.archived || f.id === s?.facultyId));
  const teams = opts.teams.filter((tm) => tm.universityId === universityId && (tm.status !== "ARCHIVED" || tm.id === s?.teamId));
  if (s?.teamId && s.teamName && s.universityId === universityId && !teams.some((tm) => tm.id === s.teamId)) {
    teams.unshift({ id: s.teamId, name: s.teamName, universityId: s.universityId, status: "ARCHIVED" });
  }

  // client mirror of the server rules (server derives the final status)
  const archived = status === "ARCHIVED";
  const shownStatus = teamId && !archived ? "IN_TEAM" : status === "IN_TEAM" ? "SEEKING_TEAM" : status;
  const statusOptions = teamId && !archived ? (["IN_TEAM", "ARCHIVED"] as const) : PICKABLE_STUDENT_STATUSES;
  const leavingCaptain = !!s?.isCaptain && !!s.teamId && (archived || teamId !== s.teamId);

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {s && <input type="hidden" name="studentId" value={s.id} />}
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label={t("students.form.name")} htmlFor={id("name")} required error={err("name")}>
          <Input ref={nameRef} id={id("name")} name="name" defaultValue={s?.name} required minLength={2} maxLength={120} autoComplete="off" aria-invalid={!!err("name")} />
        </Field>
        <Field label={t("students.form.email")} htmlFor={id("email")} required hint={t("students.form.emailHint")} error={err("email")}>
          <Input id={id("email")} name="email" type="email" defaultValue={s?.email} required maxLength={160} autoComplete="off" spellCheck={false} aria-invalid={!!err("email")} />
        </Field>
      </div>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label={t("students.form.university")} htmlFor={id("uni")} required error={err("universityId")}>
          <NativeSelect
            id={id("uni")}
            name="universityId"
            value={universityId}
            onChange={(e) => {
              setUniversityId(e.target.value);
              setFacultyId("");
              setTeamId("");
            }}
            required
            aria-invalid={!!err("universityId")}
          >
            {opts.universities.map((u) => (
              <option key={u.id} value={u.id}>{u.label}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t("students.form.faculty")} htmlFor={id("faculty")} hint={faculties.length === 0 ? t("students.form.noFaculties") : undefined} error={err("facultyId")}>
          <NativeSelect id={id("faculty")} name="facultyId" value={facultyId} onChange={(e) => setFacultyId(e.target.value)} aria-invalid={!!err("facultyId")}>
            <option value="">{t("students.form.facultyNone")}</option>
            {faculties.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field label={t("students.form.skills")} htmlFor={id("skills")} hint={t("students.form.skillsHint")} error={err("skills")}>
        <Input id={id("skills")} name="skills" defaultValue={s?.skills ?? ""} maxLength={300} />
      </Field>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label={t("students.form.status")} htmlFor={id("status")} required hint={teamId && !archived ? t("students.form.statusAuto") : undefined} error={err("status")}>
          <NativeSelect
            id={id("status")}
            name="status"
            value={shownStatus}
            onChange={(e) => {
              const next = e.target.value;
              setStatus(next);
              if (next === "ARCHIVED") setTeamId("");
            }}
          >
            {statusOptions.map((st) => (
              <option key={st} value={st}>{te(`StudentStatus.${st}`)}</option>
            ))}
          </NativeSelect>
        </Field>
        {s ? (
          <Field
            label={t("students.form.team")}
            htmlFor={id("team")}
            hint={archived ? t("students.form.teamArchived") : teams.length === 0 ? t("students.form.noTeams") : t("students.form.teamHint")}
            error={err("teamId")}
          >
            <NativeSelect
              id={id("team")}
              name="teamId"
              value={archived ? "" : teamId}
              disabled={archived}
              onChange={(e) => {
                setTeamId(e.target.value);
                if (e.target.value && status !== "ARCHIVED") setStatus("IN_TEAM");
                if (!e.target.value && status === "IN_TEAM") setStatus("SEEKING_TEAM");
              }}
              aria-invalid={!!err("teamId")}
            >
              <option value="">{t("students.form.teamNone")}</option>
              {teams.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name} · {te(`TeamStatus.${tm.status}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
        ) : (
          <p className="flex items-start gap-2 self-end rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            {t("students.form.teamAfterRegistration")}
          </p>
        )}
      </div>
      {leavingCaptain && (
        <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs font-medium text-warning" role="status">
          <Crown className="mt-px size-3.5 shrink-0" aria-hidden />
          {t("students.form.captainNotice", { team: s?.teamName ?? "" })}
        </p>
      )}
      {archived && s?.teamId && !leavingCaptain && (
        <p className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground" role="status">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          {t("students.form.archiveNotice", { team: s.teamName ?? "" })}
        </p>
      )}
      <Field label={t("students.form.notes")} htmlFor={id("notes")} error={err("notes")}>
        <Textarea id={id("notes")} name="notes" defaultValue={s?.notes ?? ""} rows={2} maxLength={2000} />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={close}>{tc("cancel")}</Button>
        <SubmitButton pending={pending} pendingLabel={t("form.pending")}>{s ? tc("save") : t("students.form.submitCreate")}</SubmitButton>
      </DialogFooter>
    </form>
  );
}

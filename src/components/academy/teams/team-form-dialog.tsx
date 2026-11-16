"use client";

import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Archive, Pencil, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect, SubmitButton } from "@/components/shared/form";
import { useFormAction } from "@/components/shared/use-form-action";
import { saveTeam } from "@/app/(app)/academy/teams/actions";
import { matchesQuery } from "@/lib/search";
import { cn } from "@/lib/utils";
import { useTeamOptions } from "./team-options";
import { TEAM_STATUSES, type TeamFormValue } from "./types";

type Props = { mode: "create"; team?: undefined } | { mode: "edit"; team: TeamFormValue };

export function TeamFormDialog(props: Props) {
  const t = useTranslations("teams");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.mode === "create" ? (
        <DialogTrigger render={<Button size="lg" />}>
          <Plus aria-hidden />
          {t("teams.form.create")}
        </DialogTrigger>
      ) : (
        <DialogTrigger
          render={<Button size="icon-sm" variant="ghost" className="size-8 text-muted-foreground hover:text-foreground" aria-label={t("teams.actions.editLabel", { name: props.team.name })} />}
        >
          <Pencil aria-hidden />
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{props.mode === "create" ? t("teams.form.createTitle") : t("teams.form.editTitle")}</DialogTitle>
          <DialogDescription>{t("teams.form.description")}</DialogDescription>
        </DialogHeader>
        {/* the popup unmounts when closed, so the form (roster, errors) starts fresh on every open */}
        <TeamForm team={props.team} close={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function TeamForm({ team, close }: { team?: TeamFormValue; close: () => void }) {
  const t = useTranslations("teams");
  const te = useTranslations("enums");
  const tc = useTranslations("common.actions");
  const opts = useTeamOptions();
  const uid = useId();
  const id = (s: string) => `${uid}-${s}`;

  const [universityId, setUniversityId] = useState(team?.universityId ?? opts.defaultUniversityId);
  const [facultyId, setFacultyId] = useState(team?.facultyId ?? "");
  const [status, setStatus] = useState<string>(team?.status ?? "FORMING");
  const [members, setMembers] = useState<string[]>(team?.memberIds ?? []);
  const [captainId, setCaptainId] = useState(team?.captainId ?? "");
  const [filter, setFilter] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  const { pending, onSubmit, error } = useFormAction(saveTeam, {
    onDone: (res) => {
      toast.success(t((res.message ?? "toast.teamUpdated") as never), { description: nameRef.current?.value });
      close();
    },
    onFail: (res) => toast.error(t((res.message ?? "errors.generic") as never)),
  });
  const err = (k: string) => {
    const key = error(k);
    return key ? t(key as never) : undefined;
  };

  const faculties = opts.faculties.filter((f) => f.universityId === universityId && (!f.archived || f.id === team?.facultyId));
  const mentors = opts.mentors.filter((m) => m.active || m.id === team?.mentorId);
  const competitions = opts.competitions.filter((c) => c.eligible || c.id === team?.competitionId);
  // eligible: same university, not archived, no team or this team (current members always listed so they can be removed)
  const isCurrent = (s: { teamId: string | null }) => !!team && s.teamId === team.id;
  const roster = opts.students
    .filter((s) => s.universityId === universityId && (isCurrent(s) || (s.status !== "ARCHIVED" && s.teamId === null)))
    .sort((a, b) => Number(isCurrent(b)) - Number(isCurrent(a))); // current members first (stable: names stay sorted)
  const byId = new Map(roster.map((s) => [s.id, s]));
  const visible = roster.filter((s) => matchesQuery(filter, s.name, s.email, s.faculty));
  const archiving = status === "ARCHIVED";
  const chosen = members.filter((m) => byId.has(m));

  function toggle(sid: string, on: boolean) {
    setMembers((prev) => (on ? [...new Set([...prev, sid])] : prev.filter((x) => x !== sid)));
    if (!on && captainId === sid) setCaptainId("");
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {team && <input type="hidden" name="teamId" value={team.id} />}
      {!archiving && chosen.map((m) => <input key={m} type="hidden" name="members" value={m} />)}
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label={t("teams.form.name")} htmlFor={id("name")} required error={err("name")}>
          <Input ref={nameRef} id={id("name")} name="name" defaultValue={team?.name} required minLength={2} maxLength={120} autoComplete="off" aria-invalid={!!err("name")} />
        </Field>
        <Field label={t("teams.form.status")} htmlFor={id("status")} required error={err("status")}>
          <NativeSelect id={id("status")} name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {TEAM_STATUSES.map((s) => <option key={s} value={s}>{te(`TeamStatus.${s}`)}</option>)}
          </NativeSelect>
        </Field>
        <Field label={t("teams.form.university")} htmlFor={id("uni")} required error={err("universityId")}>
          <NativeSelect
            id={id("uni")}
            name="universityId"
            value={universityId}
            onChange={(e) => {
              const next = e.target.value;
              setUniversityId(next);
              setFacultyId("");
              // students of another university cannot stay in the roster
              const keep = members.filter((m) => {
                const s = byId.get(m);
                return s && s.universityId === next;
              });
              setMembers(keep);
              if (captainId && !keep.includes(captainId)) setCaptainId("");
            }}
            aria-invalid={!!err("universityId")}
          >
            {opts.universities.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </NativeSelect>
        </Field>
        <Field label={t("teams.form.faculty")} htmlFor={id("faculty")} hint={faculties.length === 0 ? t("students.form.noFaculties") : undefined} error={err("facultyId")}>
          <NativeSelect id={id("faculty")} name="facultyId" value={facultyId} onChange={(e) => setFacultyId(e.target.value)} aria-invalid={!!err("facultyId")}>
            <option value="">{t("students.form.facultyNone")}</option>
            {faculties.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label={t("teams.form.mentor")} htmlFor={id("mentor")} hint={t("teams.form.mentorHint")} error={err("mentorId")}>
          <NativeSelect id={id("mentor")} name="mentorId" defaultValue={team?.mentorId ?? ""} aria-invalid={!!err("mentorId")}>
            <option value="">{t("teams.form.mentorNone")}</option>
            {mentors.map((m) => (
              <option key={m.id} value={m.id}>{m.active ? m.name : t("teams.form.inactive", { name: m.name })}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t("teams.form.competition")} htmlFor={id("comp")} hint={t("teams.form.competitionHint")} error={err("competitionId")}>
          <NativeSelect id={id("comp")} name="competitionId" defaultValue={team?.competitionId ?? ""} aria-invalid={!!err("competitionId")}>
            <option value="">{t("teams.form.competitionNone")}</option>
            {competitions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </NativeSelect>
        </Field>
      </div>

      <fieldset className="grid gap-2" aria-describedby={id("members-hint")} disabled={archiving}>
        <legend className="text-label font-medium">
          {t("teams.form.members")}
          <span className="tabular ml-2 text-xs font-normal text-muted-foreground">{t("teams.form.selected", { count: archiving ? 0 : chosen.length })}</span>
        </legend>
        {archiving ? (
          <p id={id("members-hint")} className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs font-medium text-warning" role="status">
            <Archive className="mt-px size-3.5 shrink-0" aria-hidden />
            {t("teams.form.archiveNotice")}
          </p>
        ) : (
          <p id={id("members-hint")} className="text-xs text-muted-foreground">{t("teams.form.membersHint")}</p>
        )}
        {!archiving && (
          <>
            {roster.length > 6 && (
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  type="search"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder={t("teams.form.memberFilter")}
                  aria-label={t("teams.form.memberFilter")}
                  className="pl-8"
                />
              </div>
            )}
            <div className="max-h-60 overflow-y-auto rounded-lg border" role="group" aria-label={t("teams.form.members")}>
              {roster.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">{t("teams.form.noEligible")}</p>
              ) : visible.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">{t("teams.form.noMatch")}</p>
              ) : (
                <ul className="divide-y">
                  {visible.map((s) => {
                    const checked = members.includes(s.id);
                    return (
                      <li key={s.id}>
                        <label className={cn("flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50", checked && "bg-accent/40")}>
                          <Checkbox checked={checked} onCheckedChange={(on) => toggle(s.id, on === true)} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{s.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {s.email}
                              {s.faculty ? ` · ${s.faculty}` : ""}
                            </span>
                          </span>
                          {s.status === "ARCHIVED" ? (
                            <span className="shrink-0 text-2xs font-medium text-danger">{te("StudentStatus.ARCHIVED")}</span>
                          ) : isCurrent(s) ? (
                            <span className="shrink-0 text-2xs text-muted-foreground">{t("teams.form.currentMember")}</span>
                          ) : null}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {err("members") && <p className="text-xs font-medium text-danger" role="alert">{err("members")}</p>}
          </>
        )}
      </fieldset>

      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field
          label={t("teams.form.captain")}
          htmlFor={id("captain")}
          hint={archiving ? undefined : chosen.length === 0 ? t("teams.form.captainNoMembers") : t("teams.form.captainHint")}
          error={err("captainId")}
        >
          <NativeSelect
            id={id("captain")}
            name="captainId"
            value={archiving ? "" : captainId}
            onChange={(e) => setCaptainId(e.target.value)}
            disabled={archiving || chosen.length === 0}
            aria-invalid={!!err("captainId")}
          >
            <option value="">{t("teams.form.captainNone")}</option>
            {chosen.map((m) => <option key={m} value={m}>{byId.get(m)?.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label={t("teams.form.notes")} htmlFor={id("notes")} error={err("notes")}>
          <Textarea id={id("notes")} name="notes" defaultValue={team?.notes ?? ""} rows={2} maxLength={2000} />
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={close}>{tc("cancel")}</Button>
        <SubmitButton pending={pending} pendingLabel={t("form.pending")}>{team ? tc("save") : t("teams.form.submitCreate")}</SubmitButton>
      </DialogFooter>
    </form>
  );
}

"use client";

import { startTransition, useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertCircle, ExternalLink, Info, Loader2, Plus, Search, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect } from "@/components/shared/form";
import { ToneBadge } from "@/components/shared/tone-badge";
import { COMPETITION_THEMES } from "@/lib/constants";
import { ruleStatusTone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { folded } from "@/lib/search";
import { initialActionState } from "@/lib/action-state";
import { INTAKE_LIMITS, INTAKE_NEEDS, type IntakeNeed } from "@/components/intake/shared";
import { submitIntake, updateIntake } from "@/app/(public)/apply/actions";
import { IntakeSuccess } from "./success";
import type { IntakeActionState, IntakeDraft, IntakeFormOptions, IntakeSubmission, MemberDraft } from "./types";

/** Values for ICU placeholders in intake.errors.* / hints. */
const LIMIT_PARAMS = {
  ideaMin: INTAKE_LIMITS.projectIdeaMin,
  ideaMax: INTAKE_LIMITS.projectIdea,
  noteMax: INTAKE_LIMITS.needsNote,
  maxMembers: INTAKE_LIMITS.maxMembers,
};

const emptyMember = (key: string): MemberDraft => ({ key, name: "", email: "", facultyId: "", role: "" });

function emptyDraft(options: IntakeFormOptions): IntakeDraft {
  return {
    competitionId: "", subcategory: "", teamName: "", universityId: options.defaultUniversityId, facultyId: "",
    members: [emptyMember("m0")], projectIdea: "", needs: [], needsNote: "", consent: false,
  };
}

const normEmail = (s: string) => s.trim().toLowerCase();

export type IntakePreset = { competitionId: string; captain: { name: string; email: string } | null; universityId: string };

/** New request on /apply: the form, then the success screen; "new request" remounts a clean form (keeping the captain prefill). */
export function IntakeApply({ options, preset }: { options: IntakeFormOptions; preset?: IntakePreset }) {
  const [round, setRound] = useState(0);
  const base = emptyDraft(options);
  const initial: IntakeDraft = {
    ...base,
    competitionId: round === 0 ? (preset?.competitionId ?? "") : "",
    universityId: preset?.universityId || base.universityId,
    members: [{ ...emptyMember("m0"), ...(preset?.captain ?? {}) }],
  };
  return <IntakeForm key={round} options={options} mode="create" initial={initial} onAnother={() => setRound((r) => r + 1)} />;
}

type Props = {
  options: IntakeFormOptions;
  mode: "create" | "edit";
  /** edit mode: the secret tracking token (the only handle the actions accept) */
  token?: string;
  initial?: IntakeDraft;
  onAnother?: () => void;
};

export function IntakeForm({ options, mode, token, initial, onAnother }: Props) {
  const t = useTranslations("intake");
  const tc = useTranslations("common");
  const te = useTranslations("enums");
  const router = useRouter();
  const uid = useId();
  const id = (s: string) => `${uid}-${s}`;
  const formRef = useRef<HTMLFormElement>(null);
  const keySeq = useRef(initial?.members.length ?? 1);

  const [draft, setDraft] = useState<IntakeDraft>(() => initial ?? emptyDraft(options));
  const [direction, setDirection] = useState("");
  const [query, setQuery] = useState("");

  const [state, dispatch, pending] = useActionState(async (prev: IntakeActionState, payload: IntakeSubmission) => {
    const res = mode === "edit" && token ? await updateIntake(prev, { ...payload, token }) : await submitIntake(prev, payload);
    if (res.ok && res.path && mode === "edit") {
      toast.success(t("status.updated"));
      router.push(res.path);
    }
    return res;
  }, initialActionState as IntakeActionState);

  // Server errors fade out field by field as the student edits (reset whenever a new answer arrives).
  const [answer, setAnswer] = useState(state);
  const [cleared, setCleared] = useState<ReadonlySet<string>>(new Set());
  if (answer !== state) {
    setAnswer(state);
    setCleared(new Set());
  }
  const serverErrors = !state.ok ? (state.errors ?? {}) : {};
  const errKey = (path: string) => (cleared.has(path) ? undefined : serverErrors[path]);
  const msg = (key: string | undefined) => (key ? t(key as never, LIMIT_PARAMS as never) : undefined);
  const clear = (...paths: string[]) => setCleared((s) => new Set([...s, ...paths]));
  const clearMembers = () => clear(...Object.keys(serverErrors).filter((k) => k.startsWith("members")));

  useEffect(() => {
    if (state.ok) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!state.message) return;
    const first = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    (first ?? formRef.current?.querySelector<HTMLElement>("[data-form-alert]"))?.focus();
  }, [state]);

  const set = <K extends keyof IntakeDraft>(key: K, value: IntakeDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    clear(key);
  };

  // ---------- competition ----------
  const byId = useMemo(() => new Map(options.competitions.map((c) => [c.id, c])), [options.competitions]);
  const selected = byId.get(draft.competitionId) ?? null;
  const themeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of options.competitions) if (c.theme) m.set(c.theme, (m.get(c.theme) ?? 0) + 1);
    return m;
  }, [options.competitions]);
  const visible = useMemo(() => {
    const q = folded(query.trim());
    return options.competitions.filter(
      (c) => (!direction || c.theme === direction) && (!q || folded(c.name).includes(q) || c.subcategories.some((s) => folded(s).includes(q))),
    );
  }, [options.competitions, direction, query]);
  const listed = selected && !visible.includes(selected) ? [selected, ...visible] : visible;
  const dirLabel = (theme: string | null) => (theme && tc.has(`directions.${theme}` as never) ? tc(`directions.${theme}` as never) : null);

  function pickCompetition(competitionId: string) {
    setDraft((d) => ({ ...d, competitionId, subcategory: "" }));
    clear("competitionId", "subcategory");
  }
  function pickDirection(value: string) {
    setDirection(value);
    if (value && selected && selected.theme !== value) pickCompetition("");
  }

  // ---------- team / university ----------
  const faculties = options.faculties.filter((f) => f.universityId === draft.universityId);
  function pickUniversity(universityId: string) {
    const ok = new Set(options.faculties.filter((f) => f.universityId === universityId).map((f) => f.id));
    setDraft((d) => ({
      ...d,
      universityId,
      facultyId: ok.has(d.facultyId) ? d.facultyId : "",
      members: d.members.map((m) => (ok.has(m.facultyId) ? m : { ...m, facultyId: "" })),
    }));
    clear("universityId", "facultyId");
  }

  // ---------- members ----------
  const duplicates = useMemo(() => {
    const seen = new Set<string>();
    return draft.members.map((m) => {
      const e = normEmail(m.email);
      if (!e) return false;
      const dup = seen.has(e);
      seen.add(e);
      return dup;
    });
  }, [draft.members]);
  const atMax = draft.members.length >= INTAKE_LIMITS.maxMembers;

  function setMember(i: number, patch: Partial<MemberDraft>) {
    setDraft((d) => ({ ...d, members: d.members.map((m, j) => (j === i ? { ...m, ...patch } : m)) }));
    clear(...Object.keys(patch).map((k) => `members.${i}.${k}`), "members");
  }
  function addMember() {
    if (atMax) return;
    const key = `m${keySeq.current++}`;
    setDraft((d) => ({ ...d, members: [...d.members, emptyMember(key)] }));
    clear("members");
    requestAnimationFrame(() => document.getElementById(id(`${key}-name`))?.focus());
  }
  function removeMember(i: number) {
    setDraft((d) => ({ ...d, members: d.members.filter((_, j) => j !== i) }));
    clearMembers(); // indexes shift — old row errors no longer point at the right row
  }

  function toggleNeed(need: IntakeNeed, on: boolean) {
    setDraft((d) => ({ ...d, needs: on ? [...new Set([...d.needs, need])] : d.needs.filter((n) => n !== need) }));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const website = (e.currentTarget.elements.namedItem("website") as HTMLInputElement | null)?.value ?? "";
    const values: IntakeSubmission["values"] = {
      ...draft,
      members: draft.members.map(({ name, email, facultyId, role }) => ({ name, email, facultyId, role })),
    };
    startTransition(() => dispatch({ values, website }));
  }

  if (state.ok && state.code && state.path && mode === "create") {
    return <IntakeSuccess code={state.code} path={state.path} link={state.link ?? null} onAnother={onAnother} />;
  }

  const formError = !state.ok && state.message ? msg(state.message) : undefined;
  const memberLabel = (i: number) => (i === 0 ? t("form.captain") : t("form.member", { n: i + 1 }));

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="relative space-y-6" aria-describedby={id("required")}>
      <p id={id("required")} className="text-xs text-muted-foreground">{t("form.requiredNote")}</p>

      {/* 1. Competition */}
      <Section n={1} title={t("form.sections.competition")} hint={t("form.sections.competitionHint")}>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field label={t("form.direction")} htmlFor={id("direction")}>
            <NativeSelect id={id("direction")} value={direction} onChange={(e) => pickDirection(e.target.value)} className="h-10">
              <option value="">{t("form.allDirections")}</option>
              {COMPETITION_THEMES.filter((th) => themeCounts.has(th)).map((th) => (
                <option key={th} value={th}>{t("form.option", { label: dirLabel(th) ?? th, count: themeCounts.get(th) ?? 0 })}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t("form.search")} htmlFor={id("search")} hint={t("form.searchHint")}>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id={id("search")}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("form.searchPlaceholder")}
                autoComplete="off"
                aria-describedby={id("search-hint")}
                className="h-10 pl-8"
              />
            </div>
          </Field>
        </div>

        <Field label={t("form.competition")} htmlFor={id("competition")} required error={msg(errKey("competitionId"))}>
          <NativeSelect
            id={id("competition")}
            value={draft.competitionId}
            onChange={(e) => pickCompetition(e.target.value)}
            required
            aria-invalid={!!errKey("competitionId")}
            aria-describedby={cn(errKey("competitionId") && id("competition-error"), id("competition-count"))}
            className="h-10"
          >
            <option value="">{t("form.competitionPlaceholder")}</option>
            {listed.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </NativeSelect>
        </Field>
        <p id={id("competition-count")} className="-mt-2 text-xs text-muted-foreground" aria-live="polite">
          {t("form.competitionCount", { count: visible.length, total: options.competitions.length })}
        </p>

        {selected && (
          <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              {dirLabel(selected.theme) && <ToneBadge tone="neutral" dot={false}>{dirLabel(selected.theme)}</ToneBadge>}
              {selected.ruleStatus ? (
                <ToneBadge tone={ruleStatusTone[selected.ruleStatus] ?? "info"}>
                  {t("form.tracked", { status: te(`RuleStatus.${selected.ruleStatus}` as never) })}
                </ToneBadge>
              ) : (
                <ToneBadge tone="neutral">{t("form.notTracked")}</ToneBadge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{selected.ruleStatus ? t("form.trackedHint") : t("form.notTrackedHint")}</p>
            {selected.url && (
              <a
                href={selected.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <ExternalLink className="size-3.5" aria-hidden />
                {t("form.official")}
                <span className="sr-only">{t("form.newTab")}</span>
              </a>
            )}
          </div>
        )}

        {selected && selected.subcategories.length > 0 ? (
          <Field label={t("form.subcategory")} htmlFor={id("subcategory")} required hint={t("form.subcategoryHint")} error={msg(errKey("subcategory"))}>
            <NativeSelect
              id={id("subcategory")}
              value={draft.subcategory}
              onChange={(e) => set("subcategory", e.target.value)}
              required
              aria-invalid={!!errKey("subcategory")}
              aria-describedby={errKey("subcategory") ? id("subcategory-error") : id("subcategory-hint")}
              className="h-10"
            >
              <option value="">{t("form.subcategoryPlaceholder")}</option>
              {selected.subcategories.map((s) => <option key={s} value={s}>{s}</option>)}
            </NativeSelect>
          </Field>
        ) : selected ? (
          <p className="text-xs text-muted-foreground">{t("form.subcategoryNone")}</p>
        ) : null}
        {errKey("subcategory") && !(selected && selected.subcategories.length > 0) && (
          <p className="text-xs font-medium text-danger" role="alert">{msg(errKey("subcategory"))}</p>
        )}
      </Section>

      {/* 2. Team */}
      <Section n={2} title={t("form.sections.team")} hint={t("form.sections.teamHint")}>
        <Field label={t("form.teamName")} htmlFor={id("team")} required hint={t("form.teamNameHint")} error={msg(errKey("teamName"))}>
          <Input
            id={id("team")}
            value={draft.teamName}
            onChange={(e) => set("teamName", e.target.value)}
            maxLength={INTAKE_LIMITS.teamName}
            required
            autoComplete="off"
            aria-invalid={!!errKey("teamName")}
            aria-describedby={errKey("teamName") ? id("team-error") : id("team-hint")}
            className="h-10"
          />
        </Field>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field label={t("form.university")} htmlFor={id("university")} required error={msg(errKey("universityId"))}>
            <NativeSelect
              id={id("university")}
              value={draft.universityId}
              onChange={(e) => pickUniversity(e.target.value)}
              required
              aria-invalid={!!errKey("universityId")}
              aria-describedby={errKey("universityId") ? id("university-error") : undefined}
              className="h-10"
            >
              {!draft.universityId && <option value="">{t("form.universityPlaceholder")}</option>}
              {options.universities.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </NativeSelect>
          </Field>
          <Field
            label={t("form.faculty")}
            htmlFor={id("faculty")}
            hint={faculties.length ? t("form.optional") : t("form.noFaculties")}
            error={msg(errKey("facultyId"))}
          >
            <NativeSelect
              id={id("faculty")}
              value={draft.facultyId}
              onChange={(e) => set("facultyId", e.target.value)}
              disabled={faculties.length === 0}
              aria-invalid={!!errKey("facultyId")}
              aria-describedby={errKey("facultyId") ? id("faculty-error") : id("faculty-hint")}
              className="h-10"
            >
              <option value="">{t("form.facultyNone")}</option>
              {faculties.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </NativeSelect>
          </Field>
        </div>
      </Section>

      {/* 3. Members */}
      <Section n={3} title={t("form.sections.members")} hint={t("form.sections.membersHint", { max: INTAKE_LIMITS.maxMembers })}>
        <ol className="space-y-3">
          {draft.members.map((m, i) => {
            const p = (f: string) => `members.${i}.${f}`;
            const emailErr = duplicates[i] ? "errors.duplicateEmail" : errKey(p("email"));
            const who = memberLabel(i);
            return (
              <li key={m.key}>
                <fieldset className={cn("relative rounded-lg border p-3 sm:p-4", i === 0 && "border-primary/40 bg-accent/30")}>
                  <legend className={cn("float-left mb-3 flex min-h-9 items-center text-sm font-semibold", i > 0 && "pr-24")}>
                    {who}
                    {i === 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">{t("form.captainTag")}</span>}
                  </legend>
                  {i > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-2.5 right-2.5 h-9 text-muted-foreground hover:text-danger sm:top-3.5 sm:right-3.5"
                      onClick={() => removeMember(i)}
                      aria-label={t("form.removeMember", { who })}
                    >
                      <Trash2 aria-hidden />
                      <span>{t("form.remove")}</span>
                    </Button>
                  )}
                  {i === 0 && <p className="clear-both mb-3 text-xs text-muted-foreground">{t("form.captainHint")}</p>}
                  <div className="clear-both grid items-start gap-3 sm:grid-cols-2">
                    <Field label={t("form.memberName")} htmlFor={id(`${m.key}-name`)} required error={msg(errKey(p("name")))}>
                      <Input
                        id={id(`${m.key}-name`)}
                        value={m.name}
                        onChange={(e) => setMember(i, { name: e.target.value })}
                        maxLength={INTAKE_LIMITS.personName}
                        required
                        autoComplete={i === 0 ? "name" : "off"}
                        aria-invalid={!!errKey(p("name"))}
                        aria-describedby={errKey(p("name")) ? id(`${m.key}-name-error`) : undefined}
                        className="h-10"
                      />
                    </Field>
                    <Field label={t("form.memberEmail")} htmlFor={id(`${m.key}-email`)} required error={msg(emailErr)}>
                      <Input
                        id={id(`${m.key}-email`)}
                        type="email"
                        inputMode="email"
                        value={m.email}
                        onChange={(e) => setMember(i, { email: e.target.value })}
                        maxLength={INTAKE_LIMITS.email}
                        required
                        autoComplete={i === 0 ? "email" : "off"}
                        spellCheck={false}
                        aria-invalid={!!emailErr}
                        aria-describedby={emailErr ? id(`${m.key}-email-error`) : undefined}
                        className="h-10"
                      />
                    </Field>
                    <Field label={t("form.memberFaculty")} htmlFor={id(`${m.key}-faculty`)} hint={t("form.optional")} error={msg(errKey(p("facultyId")))}>
                      <NativeSelect
                        id={id(`${m.key}-faculty`)}
                        value={m.facultyId}
                        onChange={(e) => setMember(i, { facultyId: e.target.value })}
                        disabled={faculties.length === 0}
                        aria-invalid={!!errKey(p("facultyId"))}
                        aria-describedby={errKey(p("facultyId")) ? id(`${m.key}-faculty-error`) : id(`${m.key}-faculty-hint`)}
                        className="h-10"
                      >
                        <option value="">{t("form.facultyNone")}</option>
                        {faculties.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </NativeSelect>
                    </Field>
                    <Field label={t("form.memberRole")} htmlFor={id(`${m.key}-role`)} hint={t("form.memberRoleHint")} error={msg(errKey(p("role")))}>
                      <Input
                        id={id(`${m.key}-role`)}
                        value={m.role}
                        onChange={(e) => setMember(i, { role: e.target.value })}
                        maxLength={INTAKE_LIMITS.role}
                        autoComplete="off"
                        aria-invalid={!!errKey(p("role"))}
                        aria-describedby={errKey(p("role")) ? id(`${m.key}-role-error`) : id(`${m.key}-role-hint`)}
                        className="h-10"
                      />
                    </Field>
                  </div>
                </fieldset>
              </li>
            );
          })}
        </ol>
        {errKey("members") && <p className="text-xs font-medium text-danger" role="alert">{msg(errKey("members"))}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" className="h-10" onClick={addMember} disabled={atMax}>
            <Plus aria-hidden />
            {t("form.addMember")}
          </Button>
          <span className="tabular text-xs text-muted-foreground" aria-live="polite">
            {atMax ? t("form.maxReached", { max: INTAKE_LIMITS.maxMembers }) : t("form.membersCount", { count: draft.members.length, max: INTAKE_LIMITS.maxMembers })}
          </span>
        </div>
      </Section>

      {/* 4. Idea and support */}
      <Section n={4} title={t("form.sections.idea")} hint={t("form.sections.ideaHint")}>
        <Field label={t("form.idea")} htmlFor={id("idea")} required error={msg(errKey("projectIdea"))}>
          <Textarea
            id={id("idea")}
            value={draft.projectIdea}
            onChange={(e) => set("projectIdea", e.target.value)}
            maxLength={INTAKE_LIMITS.projectIdea}
            rows={5}
            required
            aria-invalid={!!errKey("projectIdea")}
            aria-describedby={cn(errKey("projectIdea") && id("idea-error"), id("idea-count"))}
            className="min-h-28"
          />
        </Field>
        <Counter id={id("idea-count")} hint={t("form.ideaHint", LIMIT_PARAMS)} count={draft.projectIdea.trim().length} max={INTAKE_LIMITS.projectIdea} min={INTAKE_LIMITS.projectIdeaMin} />

        <fieldset className="space-y-2">
          <legend className="text-label font-medium">{t("form.needs")}</legend>
          <p className="text-xs text-muted-foreground">{t("form.needsHint")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {INTAKE_NEEDS.map((n) => (
              <label key={n} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50">
                <Checkbox checked={draft.needs.includes(n)} onCheckedChange={(v) => toggleNeed(n, v === true)} />
                <span className="min-w-0">{t(`needs.${n}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <Field label={t("form.needsNote")} htmlFor={id("note")} error={msg(errKey("needsNote"))}>
          <Textarea
            id={id("note")}
            value={draft.needsNote}
            onChange={(e) => set("needsNote", e.target.value)}
            maxLength={INTAKE_LIMITS.needsNote}
            rows={3}
            aria-invalid={!!errKey("needsNote")}
            aria-describedby={cn(errKey("needsNote") && id("note-error"), id("note-count"))}
          />
        </Field>
        <Counter id={id("note-count")} hint={t("form.needsNoteHint")} count={draft.needsNote.trim().length} max={INTAKE_LIMITS.needsNote} />
      </Section>

      {/* 5. Consent and submit */}
      <Section n={5} title={t("form.sections.consent")}>
        <div className="grid gap-1.5">
          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 hover:bg-muted/50",
              errKey("consent") && !draft.consent && "border-destructive",
            )}
          >
            <Checkbox
              checked={draft.consent}
              onCheckedChange={(v) => set("consent", v === true)}
              aria-invalid={!!errKey("consent") && !draft.consent}
              aria-describedby={errKey("consent") ? id("consent-error") : undefined}
              aria-required
              className="mt-0.5"
            />
            <span className="min-w-0 text-sm">
              <span className="font-medium">{t("form.consent")}</span>
              <span className="text-danger" aria-hidden> *</span>
              <span className="mt-1 block text-xs text-muted-foreground">{t("form.consentHint")}</span>
            </span>
          </label>
          {errKey("consent") && !draft.consent && (
            <p id={id("consent-error")} className="text-xs font-medium text-danger" role="alert">{msg(errKey("consent"))}</p>
          )}
        </div>

        {mode === "create" && (
          <p className="flex items-start gap-2 rounded-lg bg-info-soft px-3 py-2.5 text-xs text-info">
            <Info className="mt-px size-4 shrink-0" aria-hidden />
            <span>{t("form.linkNotice")}</span>
          </p>
        )}

        {/* Honeypot: invisible to people and assistive tech; bots that fill it get a fake success. */}
        <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
          <label htmlFor={id("website")}>{t("form.honeypot")}</label>
          <input id={id("website")} name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
        </div>

        {formError && (
          <p
            data-form-alert
            tabIndex={-1}
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger outline-none"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{formError}</span>
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          {mode === "edit" && token && (
            <Button variant="outline" className="h-10" nativeButton={false} render={<Link href={`/apply/status/${token}`} />}>
              {t("form.cancelEdit")}
            </Button>
          )}
          <Button type="submit" className="h-10 px-4" disabled={pending} aria-busy={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
            {pending ? t("form.submitting") : mode === "edit" ? t("form.resubmit") : t("form.submit")}
          </Button>
        </div>
      </Section>
    </form>
  );
}

function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  const hid = useId();
  return (
    <section aria-labelledby={hid} className="rounded-xl border bg-card p-4 shadow-card sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span aria-hidden className="tabular grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {n}
        </span>
        <div className="min-w-0">
          <h2 id={hid} className="text-base font-semibold">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-pretty text-muted-foreground">{hint}</p>}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Counter({ id, hint, count, max, min }: { id: string; hint: string; count: number; max: number; min?: number }) {
  const short = min !== undefined && count > 0 && count < min;
  return (
    <div id={id} className="-mt-2 flex items-start justify-between gap-3 text-xs text-muted-foreground">
      <span>{hint}</span>
      <span className={cn("tabular shrink-0", short && "text-warning", count >= max && "text-danger")}>
        {count} / {max}
      </span>
    </div>
  );
}

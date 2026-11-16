"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, CircleAlert, Eye, Lock, RotateCcw, UsersRound, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect, SubmitButton } from "@/components/shared/form";
import { useFormAction } from "@/components/shared/use-form-action";
import { ADMIN_TRANSITIONS, INTAKE_LIMITS } from "@/components/intake/shared";
import { acceptIntake, moveIntake } from "@/app/(app)/academy/intake/actions";
import type { DecisionRequest, IntakeActionState, MentorOption } from "./types";

const DIALOG = "max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg";
const LIMIT_PARAMS = { min: INTAKE_LIMITS.reviewNoteMin, max: INTAKE_LIMITS.reviewNoteMax };

/** Toast for a failed action; "changed meanwhile" offers a reload. */
function useFailToast() {
  const t = useTranslations("intakeAdmin");
  const router = useRouter();
  return (res: IntakeActionState) => {
    if (res.stale) {
      toast.error(t("errors.stale"), { action: { label: t("decision.reload"), onClick: () => router.refresh() }, duration: 10_000 });
    } else {
      toast.error(t((res.message ?? "errors.generic") as never, LIMIT_PARAMS as never));
    }
  };
}

function Hidden({ request }: { request: DecisionRequest }) {
  return (
    <>
      <input type="hidden" name="id" value={request.id} />
      <input type="hidden" name="updatedAt" value={request.updatedAt} />
    </>
  );
}

/** The written reason, with a live character count. */
function NoteField({ id, error, label, hint }: { id: string; error?: string; label: string; hint: string }) {
  const t = useTranslations("intakeAdmin");
  const [value, setValue] = useState("");
  return (
    <Field label={label} htmlFor={id} required error={error} hint={hint}>
      <Textarea
        id={id}
        name="note"
        required
        minLength={INTAKE_LIMITS.reviewNoteMin}
        maxLength={INTAKE_LIMITS.reviewNoteMax}
        rows={4}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={`${error ? `${id}-error` : `${id}-hint`} ${id}-count`}
      />
      <span id={`${id}-count`} className="tabular -mt-1 text-right text-2xs text-muted-foreground" aria-live="polite">
        {t("decision.noteCount", { count: value.trim().length, max: INTAKE_LIMITS.reviewNoteMax })}
      </span>
    </Field>
  );
}

/** "Take into review" — no note needed. */
function ReviewButton({ request }: { request: DecisionRequest }) {
  const t = useTranslations("intakeAdmin");
  const onFail = useFailToast();
  const { pending, onSubmit } = useFormAction<IntakeActionState>(moveIntake, {
    onDone: () => toast.success(t("toast.moved.UNDER_REVIEW"), { description: `${request.code} · ${request.teamName}` }),
    onFail,
  });
  return (
    <form onSubmit={onSubmit}>
      <Hidden request={request} />
      <input type="hidden" name="to" value="UNDER_REVIEW" />
      <SubmitButton pending={pending} className="w-full" pendingLabel={t("decision.UNDER_REVIEW.pending")}>
        <Eye aria-hidden />
        {t("decision.UNDER_REVIEW.trigger")}
      </SubmitButton>
    </form>
  );
}

/** NEEDS_CHANGES / REJECTED with a written reason. */
function NoteDialog({ request, to, note }: { request: DecisionRequest; to: "NEEDS_CHANGES" | "REJECTED"; note: React.ReactNode }) {
  const t = useTranslations("intakeAdmin");
  const onFail = useFailToast();
  const uid = useId();
  const [open, setOpen] = useState(false);
  const { pending, onSubmit, error } = useFormAction<IntakeActionState>(moveIntake, {
    onDone: () => {
      toast.success(t(`toast.moved.${to}`), { description: `${request.code} · ${request.teamName}` });
      setOpen(false);
    },
    onFail,
  });
  const err = error("note") ? t(error("note") as never, LIMIT_PARAMS as never) : undefined;
  const Icon = to === "REJECTED" ? XCircle : RotateCcw;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={to === "REJECTED" ? "destructive" : "outline"} size="lg" className="w-full" />}>
        <Icon aria-hidden />
        {t(`decision.${to}.trigger`)}
      </DialogTrigger>
      <DialogContent className={DIALOG}>
        <DialogHeader>
          <DialogTitle>{t(`decision.${to}.title`, { code: request.code })}</DialogTitle>
          <DialogDescription>{t(`decision.${to}.description`, { team: request.teamName })}</DialogDescription>
        </DialogHeader>
        {note}
        <form onSubmit={onSubmit} className="grid gap-4">
          <Hidden request={request} />
          <input type="hidden" name="to" value={to} />
          <NoteField id={`${uid}-note`} error={err} label={t("decision.note")} hint={t(`decision.${to}.hint`)} />
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" onClick={() => setOpen(false)}>{t("decision.cancel")}</Button>
            <SubmitButton pending={pending} variant={to === "REJECTED" ? "destructive" : "default"} pendingLabel={t(`decision.${to}.pending`)}>
              {t(`decision.${to}.submit`)}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Accept → creates the ACTIVE Academy team (one server transaction). */
function AcceptDialog({ request, mentors, note }: { request: DecisionRequest; mentors: MentorOption[]; note: React.ReactNode }) {
  const t = useTranslations("intakeAdmin");
  const router = useRouter();
  const onFail = useFailToast();
  const uid = useId();
  const id = (s: string) => `${uid}-${s}`;
  const [open, setOpen] = useState(false);
  const { pending, onSubmit, error } = useFormAction<IntakeActionState>(acceptIntake, {
    onDone: (res) => {
      const teamId = res.teamId;
      toast.success(t("toast.accepted"), {
        description: request.teamName,
        action: teamId ? { label: t("decision.openTeam"), onClick: () => router.push(`/academy/teams?team=${teamId}`) } : undefined,
        duration: 10_000,
      });
      setOpen(false);
    },
    onFail,
  });
  const err = (k: string) => (error(k) ? t(error(k) as never, LIMIT_PARAMS as never) : undefined);
  const newStudents = request.memberCount - request.existingStudents;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" className="w-full" />}>
        <CheckCircle2 aria-hidden />
        {t("decision.ACCEPTED.trigger")}
      </DialogTrigger>
      <DialogContent className={DIALOG}>
        <DialogHeader>
          <DialogTitle>{t("decision.ACCEPTED.title", { code: request.code })}</DialogTitle>
          <DialogDescription>{t("decision.ACCEPTED.description", { team: request.teamName })}</DialogDescription>
        </DialogHeader>
        {note}
        <div className="rounded-lg border border-dashed p-3 text-xs">
          <p className="font-semibold">{t("decision.ACCEPTED.willHappen")}</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-muted-foreground">
            <li>{t("decision.ACCEPTED.team", { team: request.teamName })}</li>
            <li>{t("decision.ACCEPTED.students", { created: newStudents, linked: request.existingStudents })}</li>
            <li>{t("decision.ACCEPTED.captain", { name: request.captainName })}</li>
            <li>
              {t("decision.ACCEPTED.competition", { competition: request.competitionName })}
              {request.subcategory && ` · ${request.subcategory}`}
            </li>
            {request.untracked && <li className="font-medium text-warning">{t("decision.ACCEPTED.tracking")}</li>}
          </ul>
        </div>
        <form onSubmit={onSubmit} className="grid gap-4">
          <Hidden request={request} />
          <Field label={t("decision.ACCEPTED.mentor")} htmlFor={id("mentor")} hint={t("decision.ACCEPTED.mentorHint")} error={err("mentorId")}>
            <NativeSelect
              id={id("mentor")} name="mentorId" defaultValue="" aria-invalid={!!err("mentorId")}
              aria-describedby={err("mentorId") ? `${id("mentor")}-error` : `${id("mentor")}-hint`}
            >
              <option value="">{t("decision.ACCEPTED.noMentor")}</option>
              {mentors.map((m) => (
                <option key={m.id} value={m.id}>{t("decision.ACCEPTED.mentorOption", { name: m.name, count: m.teams })}</option>
              ))}
            </NativeSelect>
          </Field>
          <NoteField id={id("note")} error={err("note")} label={t("decision.note")} hint={t("decision.ACCEPTED.hint")} />
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" onClick={() => setOpen(false)}>{t("decision.cancel")}</Button>
            <SubmitButton pending={pending} pendingLabel={t("decision.ACCEPTED.pending")}>{t("decision.ACCEPTED.submit")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Decision panel of a preparation request. Offers exactly the ADMIN_TRANSITIONS of the current status; every decision except
 * "take into review" needs a written reason. Accept is disabled while blocking conflicts exist (the server re-checks anyway).
 */
export function DecisionPanel({ request, mentors, note }: { request: DecisionRequest; mentors: MentorOption[]; note: React.ReactNode }) {
  const t = useTranslations("intakeAdmin");
  const moves = ADMIN_TRANSITIONS[request.status];

  if (request.status === "ACCEPTED") {
    return (
      <div className="space-y-3">
        <p className="flex items-start gap-2 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          <span>{request.teamId ? t("decision.final.ACCEPTED") : t("decision.final.acceptedNoTeam")}</span>
        </p>
        {request.teamId && (
          <Button variant="outline" size="lg" className="w-full" nativeButton={false} render={<Link href={`/academy/teams?team=${request.teamId}`} />}>
            <UsersRound aria-hidden />
            {t("decision.openTeam")}
          </Button>
        )}
      </div>
    );
  }
  if (moves.length === 0) {
    return (
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{t(`decision.final.${request.status}` as never)}</span>
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {note}
      {request.status === "NEEDS_CHANGES" && <p className="text-xs text-pretty text-muted-foreground">{t("decision.waitingStudents")}</p>}
      {request.status === "SUBMITTED" && <p className="text-xs text-pretty text-muted-foreground">{t("decision.acceptAfterReview")}</p>}
      <div className="grid gap-2">
        {moves.includes("ACCEPTED") &&
          (request.blocking > 0 ? (
            <div className="grid gap-1.5">
              <Button size="lg" className="w-full" disabled aria-describedby="accept-blocked">
                <CheckCircle2 aria-hidden />
                {t("decision.ACCEPTED.trigger")}
              </Button>
              <p id="accept-blocked" className="flex items-start gap-1.5 text-xs font-medium text-danger">
                <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
                {t("decision.blocked", { count: request.blocking })}
              </p>
            </div>
          ) : (
            <AcceptDialog request={request} mentors={mentors} note={note} />
          ))}
        {moves.includes("UNDER_REVIEW") && <ReviewButton request={request} />}
        {moves.includes("NEEDS_CHANGES") && <NoteDialog request={request} to="NEEDS_CHANGES" note={note} />}
        {moves.includes("REJECTED") && <NoteDialog request={request} to="REJECTED" note={note} />}
      </div>
    </div>
  );
}

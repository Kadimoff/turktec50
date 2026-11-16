"use server";
// Public preparation-request actions (no account). Mutations on an existing request take the secret TRACKING TOKEN,
// never the request id; data loaders live in the server-only module src/components/intake/public/server.ts.
import { randomInt } from "node:crypto";
import { refresh, revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logAudit, notify } from "@/lib/audit";
import { done, fail, zodErrors, type ActionState } from "@/lib/actions";
import { nextIntakeCode, withUniqueRetry } from "@/lib/codes";
import { clientIp, consume, isAllowed, LIMITS, recordEvent } from "@/lib/rate-limit";
import { revalidateSets } from "@/lib/revalidate";
import type { IntakeStatus } from "@/generated/prisma/enums";
import { hashIntakeToken, isIntakeTokenShape, newIntakeToken } from "@/components/intake/token";
import {
  INTAKE_LIMITS, OPEN_INTAKE_STATUSES, STUDENT_EDITABLE_STATUSES, intakeFormSchema, type IntakeFormValue,
} from "@/components/intake/shared";
import { requestOrigin } from "@/components/intake/public/server";
import type { IntakeActionState, IntakeSubmission, LookupState } from "@/components/intake/public/types";

type Errors = Record<string, string>;
type Fail = ActionState & { ok: false };
const RATE_LIMITED = "errors.rateLimited"; // one generic message for every spam limit
const STATUS_CHANGED = "errors.statusChanged";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isEditable = (s: IntakeStatus) => (STUDENT_EDITABLE_STATUSES as readonly IntakeStatus[]).includes(s);
const statusPath = (token: string) => `/apply/status/${token}`;

// Rate-limit buckets (src/lib/rate-limit.ts). The IP is a soft key: it is skipped when unknown, and every bucket that matters
// also has a hard key (the whole site, the request, the request code) or a database rule (open requests per captain e-mail).
const SUBMIT = "intake";
const SUBMIT_GLOBAL = "intake-global";
const EDIT = "intake-edit";
const LOOKUP = "intake-lookup";
const known = (ip: string) => ip !== "unknown";
const refuse = (message: string, errors?: Errors): Fail => ({ ...fail(message, errors), ok: false });

/**
 * Untrusted client payload → zod-validated values + server-side reference checks. On failure every field error is
 * returned at once (a missing sub-category shows up together with, say, a duplicate e-mail).
 */
async function validate(input: unknown): Promise<{ ok: true; value: IntakeFormValue; subcategory: string | null } | Fail> {
  const values = input && typeof input === "object" ? (input as Partial<IntakeSubmission>).values : undefined;
  const res = intakeFormSchema.safeParse(values);
  if (res.success) {
    const refs = await verifyRefs(res.data);
    return refs.ok ? { ok: true, value: res.data, subcategory: refs.subcategory } : refs;
  }
  const errors: Errors = zodErrors(res.error.issues);
  const loose = looseRefs(values);
  const refs = loose ? await verifyRefs(loose) : null;
  if (refs && !refs.ok) for (const [k, v] of Object.entries(refs.errors ?? {})) errors[k] ??= v;
  return refuse("errors.fix", errors);
}

type RefInput = { competitionId: string; subcategory?: string; universityId: string; facultyId?: string; members: { facultyId?: string }[] };

/** Reference fields of a payload that failed zod (type-guarded, capped) so their errors can be reported too. */
function looseRefs(values: unknown): RefInput | null {
  if (!values || typeof values !== "object") return null;
  const v = values as Record<string, unknown>;
  const s = (x: unknown) => (typeof x === "string" ? x.slice(0, 200) : undefined);
  const competitionId = s(v.competitionId);
  const universityId = s(v.universityId);
  if (!competitionId || !universityId) return null; // zod already reports the missing one
  const members = Array.isArray(v.members) ? v.members.slice(0, INTAKE_LIMITS.maxMembers) : [];
  return {
    competitionId, universityId, subcategory: s(v.subcategory), facultyId: s(v.facultyId),
    members: members.map((m) => ({ facultyId: m && typeof m === "object" ? s((m as Record<string, unknown>).facultyId) : undefined })),
  };
}

const honeypot = (input: unknown) => {
  const w = input && typeof input === "object" ? (input as Partial<IntakeSubmission>).website : undefined;
  return typeof w === "string" && w.trim().length > 0;
};

const clean = (s: string | undefined) => (s && s.trim() ? s.trim() : null);

/** Server-side reference checks: catalog card, its sub-category, university and ACTIVE faculties of that university. */
async function verifyRefs(v: RefInput): Promise<{ ok: true; subcategory: string | null } | Fail> {
  const errors: Errors = {};
  const [card, university] = await Promise.all([
    prisma.competition.findFirst({ where: { id: v.competitionId, catalogId: { not: null } }, select: { subcategories: true } }),
    prisma.university.findUnique({ where: { id: v.universityId }, select: { id: true } }),
  ]);
  const sub = clean(v.subcategory);
  if (!card) errors.competitionId = "errors.competition";
  else if (card.subcategories.length > 0 ? !sub || !card.subcategories.includes(sub) : sub !== null) errors.subcategory = "errors.subcategory";
  if (!university) errors.universityId = "errors.university";

  const wanted = [clean(v.facultyId), ...v.members.map((m) => clean(m.facultyId))];
  const ids = [...new Set(wanted.filter((x): x is string => x !== null))];
  if (university && ids.length) {
    const ok = new Set(
      (await prisma.faculty.findMany({ where: { id: { in: ids }, universityId: university.id, status: "ACTIVE" }, select: { id: true } })).map((f) => f.id),
    );
    wanted.forEach((id, i) => {
      if (id && !ok.has(id)) errors[i === 0 ? "facultyId" : `members.${i - 1}.facultyId`] = "errors.faculty";
    });
  }
  return Object.keys(errors).length ? refuse("errors.fix", errors) : { ok: true, subcategory: sub };
}

function memberRows(v: IntakeFormValue) {
  return v.members.map((m, i) => ({
    name: m.name, email: m.email, facultyId: clean(m.facultyId), role: clean(m.role), isCaptain: i === 0, order: i,
  }));
}

function requestFields(v: IntakeFormValue, subcategory: string | null) {
  return {
    teamName: v.teamName, universityId: v.universityId, facultyId: clean(v.facultyId), competitionId: v.competitionId, subcategory,
    projectIdea: v.projectIdea, needs: [...new Set(v.needs)], needsNote: clean(v.needsNote), consentAt: new Date(),
  };
}

/** Open requests where this e-mail is the captain (spam control: at most INTAKE_LIMITS.openPerCaptain). */
async function captainOpenCount(email: string, exceptId?: string) {
  return prisma.intakeRequest.count({
    where: {
      status: { in: [...OPEN_INTAKE_STATUSES] },
      members: { some: { isCaptain: true, email } },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
  });
}

/** In-app notice to active coordinators; anyone who still has an unread notice of this type is skipped (no flood). */
async function notifyAdmins(type: "intake_submitted" | "intake_resubmitted", team: string) {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", active: true, notifications: { none: { type, read: false } } },
    select: { id: true },
  });
  await notify(admins.map((a) => a.id), type, { team }, "/academy/intake");
}

function revalidateAdmin(id?: string) {
  revalidateSets("intake", "academy");
  if (id) revalidatePath(`/academy/intake/${id}`);
}

async function success(code: string, token: string): Promise<IntakeActionState> {
  const origin = await requestOrigin();
  return done("success.title", { code, path: statusPath(token), link: origin ? `${origin}${statusPath(token)}` : null });
}

// ---------- submit (new request) ----------

export async function submitIntake(_prev: IntakeActionState, input: IntakeSubmission): Promise<IntakeActionState> {
  try {
    const ip = await clientIp();
    if (honeypot(input)) {
      // Bots get a believable answer and use up their budget; nothing is stored, logged or notified.
      if (known(ip)) await recordEvent(SUBMIT, ip);
      return await success(`HZ-${String(randomInt(1000, 10000))}`, newIntakeToken().token);
    }
    const [ipOk, siteOk] = await Promise.all([
      known(ip) ? isAllowed(SUBMIT, ip, LIMITS.intakeIp) : Promise.resolve(true),
      isAllowed(SUBMIT_GLOBAL, "*", LIMITS.intakeGlobal),
    ]);
    if (!ipOk || !siteOk) return fail(RATE_LIMITED);

    const checked = await validate(input);
    if (!checked.ok) return checked;
    const v = checked.value;
    if ((await captainOpenCount(v.members[0]!.email)) >= INTAKE_LIMITS.openPerCaptain) return fail(RATE_LIMITED);

    const { token, hash } = newIntakeToken();
    // two submissions at the same moment may pick the same HZ code: the second one retries with the next code
    const created = await withUniqueRetry(() =>
      prisma.$transaction(async (tx) => {
        const code = await nextIntakeCode(tx);
        return tx.intakeRequest.create({
          data: {
            code, tokenHash: hash, status: "SUBMITTED", ...requestFields(v, checked.subcategory),
            members: { create: memberRows(v) },
            events: { create: { from: null, to: "SUBMITTED", source: "public" } },
          },
          select: { id: true, code: true },
        });
      }),
    );
    await Promise.all([known(ip) ? recordEvent(SUBMIT, ip) : null, recordEvent(SUBMIT_GLOBAL, "*")]);

    await logAudit({
      actorId: null, action: "intake.submit", entity: "IntakeRequest", entityId: created.id,
      summary: `${created.code} · ${v.teamName}`, meta: { source: "public" },
    });
    await notifyAdmins("intake_submitted", v.teamName);
    revalidateAdmin();
    return await success(created.code, token);
  } catch (e) {
    console.error("[intake] submit failed", e instanceof Error ? e.message : e);
    return fail("errors.generic");
  }
}

// ---------- edit + resubmit (tracking link) ----------

export async function updateIntake(_prev: IntakeActionState, input: IntakeSubmission & { token: string }): Promise<IntakeActionState> {
  try {
    const token = input && typeof input === "object" && typeof input.token === "string" ? input.token : "";
    if (!isIntakeTokenShape(token)) return fail("errors.invalid");
    const ip = await clientIp();
    if (honeypot(input)) return await success("", token);

    const current = await prisma.intakeRequest.findUnique({ where: { tokenHash: hashIntakeToken(token) }, select: { id: true, code: true, status: true } });
    if (!current) return fail("errors.invalid");
    const [ipOk, requestOk] = await Promise.all([
      known(ip) ? isAllowed(EDIT, ip, LIMITS.intakeIp) : Promise.resolve(true),
      isAllowed(EDIT, `request:${current.id}`, LIMITS.intakeIp),
    ]);
    if (!ipOk || !requestOk) return fail(RATE_LIMITED);
    if (!isEditable(current.status)) return fail(STATUS_CHANGED);

    const checked = await validate(input);
    if (!checked.ok) return checked;
    const v = checked.value;
    if ((await captainOpenCount(v.members[0]!.email, current.id)) >= INTAKE_LIMITS.openPerCaptain) return fail(RATE_LIMITED);

    const moved = await prisma.$transaction(async (tx) => {
      // Status is re-checked inside the write: a coordinator who takes it into review at the same moment wins.
      const { count } = await tx.intakeRequest.updateMany({
        where: { id: current.id, status: current.status },
        data: { ...requestFields(v, checked.subcategory), status: "SUBMITTED" },
      });
      if (count !== 1) return false;
      await tx.intakeMember.deleteMany({ where: { requestId: current.id } });
      await tx.intakeMember.createMany({ data: memberRows(v).map((m) => ({ ...m, requestId: current.id })) });
      await tx.intakeEvent.create({ data: { requestId: current.id, from: current.status, to: "SUBMITTED", source: "public" } });
      return true;
    });
    if (!moved) return fail(STATUS_CHANGED);
    await Promise.all([known(ip) ? recordEvent(EDIT, ip) : null, recordEvent(EDIT, `request:${current.id}`)]);

    await logAudit({
      actorId: null, action: "intake.update", entity: "IntakeRequest", entityId: current.id,
      summary: `${current.code} · ${v.teamName}`, meta: { source: "public", from: current.status },
    });
    await notifyAdmins("intake_resubmitted", v.teamName);
    revalidateAdmin(current.id);
    return await success(current.code, token);
  } catch (e) {
    console.error("[intake] update failed", e instanceof Error ? e.message : e);
    return fail("errors.generic");
  }
}

// ---------- withdraw (tracking link) ----------

export async function withdrawIntake(token: string): Promise<ActionState> {
  try {
    if (typeof token !== "string" || !isIntakeTokenShape(token)) return fail("errors.invalid");
    const current = await prisma.intakeRequest.findUnique({ where: { tokenHash: hashIntakeToken(token) }, select: { id: true, code: true, status: true, teamName: true } });
    if (!current) return fail("errors.invalid");
    if (!isEditable(current.status)) return fail(STATUS_CHANGED);

    const moved = await prisma.$transaction(async (tx) => {
      const { count } = await tx.intakeRequest.updateMany({ where: { id: current.id, status: current.status }, data: { status: "WITHDRAWN" } });
      if (count !== 1) return false;
      await tx.intakeEvent.create({ data: { requestId: current.id, from: current.status, to: "WITHDRAWN", source: "public" } });
      return true;
    });
    if (!moved) return fail(STATUS_CHANGED);

    await logAudit({
      actorId: null, action: "intake.withdraw", entity: "IntakeRequest", entityId: current.id,
      summary: `${current.code} · ${current.teamName}`, meta: { source: "public", from: current.status },
    });
    revalidateAdmin(current.id);
    refresh();
    return done("status.withdrawn");
  } catch (e) {
    console.error("[intake] withdraw failed", e instanceof Error ? e.message : e);
    return fail("errors.generic");
  }
}

// ---------- read-only lookup by code + captain e-mail (for a lost link) ----------

export async function lookupIntake(_prev: LookupState, fd: FormData): Promise<LookupState> {
  const rawCode = fd.get("code");
  const rawEmail = fd.get("email");
  const code = (typeof rawCode === "string" ? rawCode : "").trim().toUpperCase().slice(0, 20);
  const email = (typeof rawEmail === "string" ? rawEmail : "").trim().toLowerCase().slice(0, INTAKE_LIMITS.email + 1);
  const errors: Errors = {};
  if (!/^HZ-\d{4,6}$/.test(code)) errors.code = "errors.lookupCode";
  if (email.length > INTAKE_LIMITS.email || !EMAIL_RE.test(email)) errors.email = "errors.email";
  if (Object.keys(errors).length) return fail("errors.fix", errors);
  try {
    const ip = await clientIp();
    // every attempt counts (also a miss): per IP (soft) and per request code (hard)
    const ipOk = known(ip) ? await consume(LOOKUP, ip, LIMITS.intakeLookupIp) : true;
    if (!ipOk || !(await consume(LOOKUP, `code:${code}`, LIMITS.intakeLookupIp))) return fail("errors.lookupLimited");

    const r = await prisma.intakeRequest.findUnique({
      where: { code },
      select: {
        code: true, status: true, submittedAt: true,
        members: { where: { isCaptain: true }, select: { email: true } },
        events: { orderBy: { at: "desc" }, take: 1, select: { at: true } },
      },
    });
    // Same answer for an unknown code and a wrong e-mail.
    if (!r || !r.members.some((m) => m.email === email)) return fail("errors.notFound");
    return done("lookup.title", {
      code: r.code, status: r.status, submittedAt: r.submittedAt.toISOString(), changedAt: (r.events[0]?.at ?? r.submittedAt).toISOString(),
    });
  } catch (e) {
    console.error("[intake] lookup failed", e instanceof Error ? e.message : e);
    return fail("errors.generic");
  }
}

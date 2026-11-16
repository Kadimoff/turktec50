import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { hashIntakeToken, isIntakeTokenShape } from "@/components/intake/token";
import { INTAKE_NEEDS, type IntakeNeed } from "@/components/intake/shared";
import { isHttpsUrl } from "@/components/academy/catalog/helpers";
import type { IntakeDraft, IntakeFormOptions } from "./types";

// ---------- form options ----------

/** TEKNOFEST catalog cards, universities (pilot host first) and ACTIVE faculties for the public form. */
export async function getIntakeFormOptions(): Promise<IntakeFormOptions> {
  const [cards, universities, faculties] = await Promise.all([
    prisma.competition.findMany({
      where: { catalogId: { not: null } },
      select: { id: true, name: true, theme: true, subcategories: true, url: true, ruleStatus: true },
    }),
    prisma.university.findMany({ select: { id: true, name: true, shortName: true, isPartner: true } }),
    prisma.faculty.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, universityId: true } }),
  ]);
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "tr");
  universities.sort((a, b) => Number(a.isPartner) - Number(b.isPartner) || byName(a, b));
  return {
    competitions: cards.sort(byName).map((c) => ({ ...c, url: c.url && isHttpsUrl(c.url) ? c.url : null })),
    universities: universities.map(({ id, name, shortName }) => ({ id, name, shortName })),
    faculties: faculties.sort(byName),
    defaultUniversityId: universities.find((u) => !u.isPartner)?.id ?? universities[0]?.id ?? "",
  };
}

// ---------- tracking page ----------

/** The request behind a tracking token (no actor / reviewer names, no audit data). null when the token is unknown. */
export async function getIntakeByToken(token: string) {
  if (!isIntakeTokenShape(token)) return null;
  return prisma.intakeRequest.findUnique({
    where: { tokenHash: hashIntakeToken(token) },
    select: {
      id: true, code: true, status: true, teamName: true, subcategory: true, projectIdea: true, needs: true, needsNote: true,
      reviewNote: true, reviewedAt: true, submittedAt: true, updatedAt: true, competitionId: true, universityId: true, facultyId: true,
      competition: { select: { name: true, theme: true, url: true } },
      university: { select: { name: true, shortName: true } },
      faculty: { select: { name: true } },
      team: { select: { name: true, mentor: { select: { name: true } } } },
      members: { orderBy: { order: "asc" }, select: { name: true, email: true, role: true, isCaptain: true, facultyId: true, faculty: { select: { name: true } } } },
      events: { orderBy: { at: "asc" }, select: { id: true, from: true, to: true, note: true, source: true, at: true } },
    },
  });
}
export type PublicIntake = NonNullable<Awaited<ReturnType<typeof getIntakeByToken>>>;

/** Prefill for the edit form. Faculties that were archived since are dropped (the form only offers ACTIVE ones). */
export function intakeDraftOf(r: PublicIntake, activeFacultyIds: Set<string>): IntakeDraft {
  const fac = (id: string | null) => (id && activeFacultyIds.has(id) ? id : "");
  return {
    competitionId: r.competitionId,
    subcategory: r.subcategory ?? "",
    teamName: r.teamName,
    universityId: r.universityId,
    facultyId: fac(r.facultyId),
    members: r.members.map((m, i) => ({ key: `m${i}`, name: m.name, email: m.email, facultyId: fac(m.facultyId), role: m.role ?? "" })),
    projectIdea: r.projectIdea,
    needs: r.needs.filter((n): n is IntakeNeed => (INTAKE_NEEDS as readonly string[]).includes(n)),
    needsNote: r.needsNote ?? "",
    consent: true,
  };
}

// ---------- request context ----------

const HOST_RE = /^(?:[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*|\[[0-9A-Fa-f:.]+\])(?::\d{1,5})?$/;

/** Absolute origin of the current request (e.g. http://192.168.1.20:3000), or null when the Host header looks odd. */
export async function requestOrigin() {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0]!.trim();
  const proto = (h.get("x-forwarded-proto") ?? "http").split(",")[0]!.trim();
  if (!HOST_RE.test(host) || (proto !== "http" && proto !== "https")) return null;
  return `${proto}://${host}`;
}

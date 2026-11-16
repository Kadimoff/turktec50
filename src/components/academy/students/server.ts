import "server-only";
import { prisma } from "@/lib/db";
import type { FacultyOption, UniversityOption } from "./types";

/** Universities for Academy dialogs: the pilot host (isPartner = false) first, then partners by name. */
export async function loadUniversityOptions(): Promise<{ universities: UniversityOption[]; defaultUniversityId: string }> {
  const rows = await prisma.university.findMany({
    select: { id: true, name: true, shortName: true, isPartner: true },
    orderBy: [{ isPartner: "asc" }, { name: "asc" }],
  });
  return {
    universities: rows.map((u) => ({ id: u.id, label: `${u.shortName} — ${u.name}` })),
    defaultUniversityId: rows.find((u) => !u.isPartner)?.id ?? rows[0]?.id ?? "",
  };
}

export async function loadFacultyOptions(): Promise<FacultyOption[]> {
  const rows = await prisma.faculty.findMany({ select: { id: true, name: true, universityId: true, status: true }, orderBy: { name: "asc" } });
  return rows.map((f) => ({ id: f.id, name: f.name, universityId: f.universityId, archived: f.status === "ARCHIVED" }));
}

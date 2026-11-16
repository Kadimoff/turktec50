import { getTranslations } from "next-intl/server";
import { FlaskConical, SearchX } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import type { LabStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { EnumBadge } from "@/components/shared/enum-badge";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Count, CountChips, ListSection, Notes, Th } from "./list-bits";
import { RecordActions } from "./record-actions";
import { LabDialog } from "./registry-dialogs";
import type { FacultyOption, LabValue, UniversityOption } from "./types";

export async function LabList({ q, status, universities, faculties, hostId }: { q?: string; status?: LabStatus; universities: UniversityOption[]; faculties: FacultyOption[]; hostId?: string }) {
  const t = await getTranslations("registry");
  const where: Prisma.LabWhereInput = {
    ...(status && { status }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } }, { contact: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } }, { faculty: { name: { contains: q, mode: "insensitive" } } },
      ],
    }),
  };
  const rows = await prisma.lab.findMany({
    where,
    orderBy: [{ university: { shortName: "asc" } }, { name: "asc" }],
    select: {
      id: true, universityId: true, facultyId: true, name: true, contact: true, status: true, notes: true,
      university: { select: { shortName: true } },
      faculty: { select: { name: true } },
      _count: { select: { projects: true, trainings: true, resourceRequests: true } },
    },
  });
  const ids = rows.map((r) => r.id);
  const [openRequests, upcoming] = ids.length
    ? await Promise.all([
        prisma.resourceRequest.groupBy({ by: ["labId"], where: { labId: { in: ids }, status: { in: ["NEW", "UNDER_REVIEW"] } }, _count: { _all: true } }),
        prisma.training.groupBy({ by: ["labId"], where: { labId: { in: ids }, startsAt: { gte: new Date() } }, _count: { _all: true } }),
      ])
    : [[], []];
  const openOf = new Map(openRequests.map((g) => [g.labId, g._count._all]));
  const upcomingOf = new Map(upcoming.map((g) => [g.labId, g._count._all]));
  const filtered = !!(q || status);
  const create = <LabDialog universities={universities} faculties={faculties} defaultUniversityId={hostId} />;

  const actions = (l: (typeof rows)[number]) => {
    const value: LabValue = { id: l.id, universityId: l.universityId, facultyId: l.facultyId, name: l.name, contact: l.contact, status: l.status, notes: l.notes };
    return (
      <RecordActions
        kind="lab" id={l.id} name={l.name} retired={l.status === "CLOSED"}
        usage={{ projects: l._count.projects, trainings: l._count.trainings, requests: l._count.resourceRequests }}
        editor={<LabDialog lab={value} universities={universities} faculties={faculties} />}
      />
    );
  };
  const where2 = (l: (typeof rows)[number]) => `${l.faculty?.name ?? t("noFaculty")} · ${l.university.shortName}`;

  return (
    <ListSection id="labs-title" title={t("tabs.labs")} found={t("found", { count: rows.length })} action={create}>
      {rows.length === 0 ? (
        <div className="p-4">
          {filtered ? (
            <EmptyState icon={SearchX} title={t("empty.noResults")} description={t("empty.noResultsHint")} />
          ) : (
            <EmptyState icon={FlaskConical} title={t("empty.labs")} description={t("empty.labsHint")} />
          )}
        </div>
      ) : (
        <>
          <ul className="divide-y lg:hidden">
            {rows.map((l) => {
              const open = openOf.get(l.id) ?? 0;
              const next = upcomingOf.get(l.id) ?? 0;
              return (
                <li key={l.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-semibold", l.status === "CLOSED" && "text-muted-foreground")}>{l.name}</p>
                    <p className="text-xs text-muted-foreground">{where2(l)}</p>
                    {l.contact && <p className="mt-0.5 break-words text-xs">{l.contact}</p>}
                    <div className="mt-1.5"><EnumBadge enumName="LabStatus" value={l.status} /></div>
                    <CountChips
                      items={[
                        { key: "projects", value: l._count.projects, label: t("usage.projects", { count: l._count.projects }) },
                        { key: "open", value: open, label: t("usage.openRequests", { count: open }) },
                        { key: "upcoming", value: next, label: t("usage.upcomingTrainings", { count: next }) },
                      ]}
                    />
                    <Notes text={l.notes} className="mt-2" />
                  </div>
                  {actions(l)}
                </li>
              );
            })}
          </ul>
          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th className="pl-5">{t("cols.lab")}</Th>
                  <Th>{t("cols.contact")}</Th>
                  <Th numeric>{t("cols.projects")}</Th>
                  <Th numeric>{t("cols.openRequests")}</Th>
                  <Th numeric>{t("cols.upcomingTrainings")}</Th>
                  <Th>{t("cols.status")}</Th>
                  <Th className="pr-5 text-right"><span className="sr-only">{t("cols.actions")}</span></Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((l) => (
                  <TableRow key={l.id} className="h-14">
                    <TableCell className="max-w-md whitespace-normal pl-5">
                      <p className={cn("font-medium", l.status === "CLOSED" && "text-muted-foreground")}>{l.name}</p>
                      <p className="text-xs text-muted-foreground">{where2(l)}</p>
                      <Notes text={l.notes} className="mt-0.5 line-clamp-1" />
                    </TableCell>
                    <TableCell className="max-w-56 whitespace-normal break-words">{l.contact ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-right"><Count value={l._count.projects} /></TableCell>
                    <TableCell className="text-right"><Count value={openOf.get(l.id) ?? 0} /></TableCell>
                    <TableCell className="text-right"><Count value={upcomingOf.get(l.id) ?? 0} /></TableCell>
                    <TableCell><EnumBadge enumName="LabStatus" value={l.status} /></TableCell>
                    <TableCell className="pr-5 text-right">{actions(l)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </ListSection>
  );
}

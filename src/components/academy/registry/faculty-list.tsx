import { getTranslations } from "next-intl/server";
import { Building2, SearchX } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import type { RegistryStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { EnumBadge } from "@/components/shared/enum-badge";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Count, CountChips, ListSection, Notes, Th } from "./list-bits";
import { RecordActions } from "./record-actions";
import { FacultyDialog } from "./registry-dialogs";
import type { FacultyValue, UniversityOption } from "./types";

export async function FacultyList({ q, status, universities, hostId }: { q?: string; status?: RegistryStatus; universities: UniversityOption[]; hostId?: string }) {
  const t = await getTranslations("registry");
  const where: Prisma.FacultyWhereInput = {
    ...(status && { status }),
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { coordinator: { contains: q, mode: "insensitive" } }, { notes: { contains: q, mode: "insensitive" } }] }),
  };
  const rows = await prisma.faculty.findMany({
    where,
    orderBy: [{ university: { shortName: "asc" } }, { name: "asc" }],
    select: {
      id: true, universityId: true, name: true, coordinator: true, status: true, notes: true,
      university: { select: { shortName: true } },
      _count: { select: { students: true, teams: true, projects: true, labs: true, users: true, intakeRequests: true, intakeMembers: true } },
    },
  });
  const filtered = !!(q || status);
  const create = <FacultyDialog universities={universities} defaultUniversityId={hostId} />;

  const actions = (f: (typeof rows)[number]) => {
    const value: FacultyValue = { id: f.id, universityId: f.universityId, name: f.name, coordinator: f.coordinator, status: f.status, notes: f.notes };
    return (
      <RecordActions
        kind="faculty" id={f.id} name={f.name} retired={f.status === "ARCHIVED"} usage={f._count}
        editor={<FacultyDialog faculty={value} universities={universities} />}
      />
    );
  };

  return (
    <ListSection id="faculties-title" title={t("tabs.faculties")} found={t("found", { count: rows.length })} action={create}>
      {rows.length === 0 ? (
        <div className="p-4">
          {filtered ? (
            <EmptyState icon={SearchX} title={t("empty.noResults")} description={t("empty.noResultsHint")} />
          ) : (
            <EmptyState icon={Building2} title={t("empty.faculties")} description={t("empty.facultiesHint")} />
          )}
        </div>
      ) : (
        <>
          <ul className="divide-y lg:hidden">
            {rows.map((f) => (
              <li key={f.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-semibold", f.status === "ARCHIVED" && "text-muted-foreground")}>{f.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {f.university.shortName}
                    {" · "}
                    {f.coordinator ?? t("noCoordinator")}
                  </p>
                  <div className="mt-1.5"><EnumBadge enumName="RegistryStatus" value={f.status} /></div>
                  <CountChips
                    items={(["students", "teams", "projects", "labs"] as const).map((k) => ({ key: k, value: f._count[k], label: t(`usage.${k}`, { count: f._count[k] }) }))}
                  />
                  <Notes text={f.notes} className="mt-2" />
                </div>
                {actions(f)}
              </li>
            ))}
          </ul>
          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th className="pl-5">{t("cols.faculty")}</Th>
                  <Th>{t("cols.coordinator")}</Th>
                  <Th numeric>{t("cols.students")}</Th>
                  <Th numeric>{t("cols.teams")}</Th>
                  <Th numeric>{t("cols.projects")}</Th>
                  <Th numeric>{t("cols.labs")}</Th>
                  <Th>{t("cols.status")}</Th>
                  <Th className="pr-5 text-right"><span className="sr-only">{t("cols.actions")}</span></Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((f) => (
                  <TableRow key={f.id} className="h-14">
                    <TableCell className="max-w-md whitespace-normal pl-5">
                      <p className={cn("font-medium", f.status === "ARCHIVED" && "text-muted-foreground")}>{f.name}</p>
                      <p className="text-xs text-muted-foreground">{f.university.shortName}</p>
                      <Notes text={f.notes} className="mt-0.5 line-clamp-1" />
                    </TableCell>
                    <TableCell className="max-w-56 whitespace-normal">{f.coordinator ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-right"><Count value={f._count.students} /></TableCell>
                    <TableCell className="text-right"><Count value={f._count.teams} /></TableCell>
                    <TableCell className="text-right"><Count value={f._count.projects} /></TableCell>
                    <TableCell className="text-right"><Count value={f._count.labs} /></TableCell>
                    <TableCell><EnumBadge enumName="RegistryStatus" value={f.status} /></TableCell>
                    <TableCell className="pr-5 text-right">{actions(f)}</TableCell>
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

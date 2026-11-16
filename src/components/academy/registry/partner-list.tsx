import { getTranslations } from "next-intl/server";
import { Handshake, SearchX } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import type { PartnerStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { EnumBadge } from "@/components/shared/enum-badge";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Count, CountChips, ListSection, Notes, Th } from "./list-bits";
import { RecordActions } from "./record-actions";
import { PartnerDialog } from "./registry-dialogs";
import type { PartnerValue } from "./types";

export async function PartnerList({ q, status }: { q?: string; status?: PartnerStatus }) {
  const t = await getTranslations("registry");
  const where: Prisma.PartnerWhereInput = {
    ...(status && { status }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } }, { sector: { contains: q, mode: "insensitive" } },
        { contact: { contains: q, mode: "insensitive" } }, { notes: { contains: q, mode: "insensitive" } },
      ],
    }),
  };
  const rows = await prisma.partner.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, sector: true, contact: true, status: true, notes: true,
      _count: { select: { projects: true, resourceRequests: true } },
    },
  });
  const filtered = !!(q || status);

  const actions = (p: (typeof rows)[number]) => {
    const value: PartnerValue = { id: p.id, name: p.name, sector: p.sector, contact: p.contact, status: p.status, notes: p.notes };
    return (
      <RecordActions
        kind="partner" id={p.id} name={p.name} retired={p.status === "ARCHIVED"}
        usage={{ projects: p._count.projects, requests: p._count.resourceRequests }}
        editor={<PartnerDialog partner={value} />}
      />
    );
  };

  return (
    <ListSection id="partners-title" title={t("tabs.partners")} found={t("found", { count: rows.length })} action={<PartnerDialog />}>
      {rows.length === 0 ? (
        <div className="p-4">
          {filtered ? (
            <EmptyState icon={SearchX} title={t("empty.noResults")} description={t("empty.noResultsHint")} />
          ) : (
            <EmptyState icon={Handshake} title={t("empty.partners")} description={t("empty.partnersHint")} />
          )}
        </div>
      ) : (
        <>
          <ul className="divide-y lg:hidden">
            {rows.map((p) => (
              <li key={p.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-semibold", p.status === "ARCHIVED" && "text-muted-foreground")}>{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.sector ?? t("noSector")}</p>
                  {p.contact && <p className="mt-0.5 break-words text-xs">{p.contact}</p>}
                  <div className="mt-1.5"><EnumBadge enumName="PartnerStatus" value={p.status} /></div>
                  <CountChips
                    items={[
                      { key: "projects", value: p._count.projects, label: t("usage.projects", { count: p._count.projects }) },
                      { key: "requests", value: p._count.resourceRequests, label: t("usage.requests", { count: p._count.resourceRequests }) },
                    ]}
                  />
                  <Notes text={p.notes} className="mt-2" />
                </div>
                {actions(p)}
              </li>
            ))}
          </ul>
          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th className="pl-5">{t("cols.partner")}</Th>
                  <Th>{t("cols.sector")}</Th>
                  <Th>{t("cols.contact")}</Th>
                  <Th numeric>{t("cols.projects")}</Th>
                  <Th numeric>{t("cols.requests")}</Th>
                  <Th>{t("cols.status")}</Th>
                  <Th className="pr-5 text-right"><span className="sr-only">{t("cols.actions")}</span></Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id} className="h-14">
                    <TableCell className="max-w-md whitespace-normal pl-5">
                      <p className={cn("font-medium", p.status === "ARCHIVED" && "text-muted-foreground")}>{p.name}</p>
                      <Notes text={p.notes} className="mt-0.5 line-clamp-1" />
                    </TableCell>
                    <TableCell className="max-w-56 whitespace-normal">{p.sector ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="max-w-56 whitespace-normal break-words">{p.contact ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-right"><Count value={p._count.projects} /></TableCell>
                    <TableCell className="text-right"><Count value={p._count.resourceRequests} /></TableCell>
                    <TableCell><EnumBadge enumName="PartnerStatus" value={p.status} /></TableCell>
                    <TableCell className="pr-5 text-right">{actions(p)}</TableCell>
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

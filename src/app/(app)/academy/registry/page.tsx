import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/shared/filter-bar";
import { pick, str } from "@/lib/search-params";
import { RegistryTabs } from "@/components/academy/registry/registry-tabs";
import { FacultyList } from "@/components/academy/registry/faculty-list";
import { LabList } from "@/components/academy/registry/lab-list";
import { PartnerList } from "@/components/academy/registry/partner-list";
import { LAB_STATUSES, PANEL_ID, PARTNER_STATUSES, REGISTRY_STATUSES, REGISTRY_TABS, tabId, type RegistryTab } from "@/components/academy/registry/types";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("registry") };
}

const STATUS_ENUM = { faculties: "RegistryStatus", labs: "LabStatus", partners: "PartnerStatus" } as const;
const STATUSES: Record<RegistryTab, readonly string[]> = { faculties: REGISTRY_STATUSES, labs: LAB_STATUSES, partners: PARTNER_STATUSES };
const href = (tab: RegistryTab) => (tab === "faculties" ? "/academy/registry" : `/academy/registry?tab=${tab}`);

export default async function RegistryPage(props: PageProps<"/academy/registry">) {
  await requireUser(["ADMIN"]);
  const sp = await props.searchParams;
  const [t, tc, te] = await Promise.all([getTranslations("registry"), getTranslations("common"), getTranslations("enums")]);

  const tab: RegistryTab = pick(sp.tab, REGISTRY_TABS, "faculties");
  const q = str(sp.q, 80);
  const status = pick(sp.status, STATUSES[tab]);

  const [counts, universities, faculties] = await Promise.all([
    Promise.all([prisma.faculty.count(), prisma.lab.count(), prisma.partner.count()]),
    tab === "partners"
      ? Promise.resolve([])
      : prisma.university.findMany({ orderBy: [{ isPartner: "asc" }, { shortName: "asc" }], select: { id: true, shortName: true, name: true, isPartner: true } }),
    tab === "labs"
      ? prisma.faculty.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, universityId: true, status: true } })
      : Promise.resolve([]),
  ]);
  const hostId = universities.find((u) => !u.isPartner)?.id;

  const tabs = REGISTRY_TABS.map((key, i) => ({ key, label: t(`tabs.${key}`), count: counts[i]!, href: href(key) }));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />

      <RegistryTabs label={t("tabsLabel")} tabs={tabs} active={tab} />

      <div role="tabpanel" id={PANEL_ID} aria-labelledby={tabId(tab)} className="space-y-4">
        <FilterBar
          action="/academy/registry"
          keep={{ tab: tab === "faculties" ? undefined : tab }}
          search={{ label: tc("filters.search"), placeholder: t(`search.${tab}`), value: q }}
          selects={[
            {
              name: "status",
              label: t("cols.status"),
              allLabel: tc("actions.all"),
              value: status ?? "",
              options: STATUSES[tab].map((s) => ({ value: s, label: te(`${STATUS_ENUM[tab]}.${s}` as never) })),
            },
          ]}
        />

        {tab === "faculties" && <FacultyList q={q} status={status as (typeof REGISTRY_STATUSES)[number] | undefined} universities={universities} hostId={hostId} />}
        {tab === "labs" && <LabList q={q} status={status as (typeof LAB_STATUSES)[number] | undefined} universities={universities} faculties={faculties} hostId={hostId} />}
        {tab === "partners" && <PartnerList q={q} status={status as (typeof PARTNER_STATUSES)[number] | undefined} />}
      </div>
    </div>
  );
}

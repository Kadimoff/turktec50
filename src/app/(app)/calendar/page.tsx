import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";

// PLACEHOLDER — owned by module agent: A dashboard-kpi
export default async function Page() {
  await requireUser();
  return <PageHeader title="calendar" description="TODO: A dashboard-kpi" />;
}

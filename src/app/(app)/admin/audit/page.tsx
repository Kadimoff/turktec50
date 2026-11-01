import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";

// PLACEHOLDER — owned by module agent: E jury-admin
export default async function Page() {
  await requireUser();
  return <PageHeader title="admin/audit" description="TODO: E jury-admin" />;
}

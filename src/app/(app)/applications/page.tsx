import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";

// PLACEHOLDER — owned by module agent: B selection-projects
export default async function Page() {
  await requireUser();
  return <PageHeader title="applications" description="TODO: B selection-projects" />;
}

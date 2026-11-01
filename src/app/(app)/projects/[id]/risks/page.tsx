import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";

// PLACEHOLDER — owned by module agent: D documents-risks
export default async function Page() {
  await requireUser();
  return <PageHeader title="projects/[id]/risks" description="TODO: D documents-risks" />;
}

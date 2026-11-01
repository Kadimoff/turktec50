import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";

// PLACEHOLDER — owned by module agent: C tasks-mentors
export default async function Page() {
  await requireUser();
  return <PageHeader title="mentors" description="TODO: C tasks-mentors" />;
}

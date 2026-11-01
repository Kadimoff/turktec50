import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <EmptyState
      icon={SearchX}
      title={t("states.notFoundTitle")}
      description={t("states.notFoundBody")}
      action={<Button nativeButton={false} render={<Link href="/dashboard" />}>{t("actions.back")}</Button>}
      className="mt-10"
    />
  );
}

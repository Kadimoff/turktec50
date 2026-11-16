import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

/** Unknown / malformed tracking link (and any other notFound() under /apply). */
export default async function ApplyNotFound() {
  const t = await getTranslations("intake.notFound");
  return (
    <EmptyState
      icon={SearchX}
      title={t("title")}
      description={t("body")}
      className="mt-4"
      action={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="h-10 px-4" nativeButton={false} render={<Link href="/apply" />}>{t("apply")}</Button>
          <Button variant="outline" className="h-10" nativeButton={false} render={<Link href="/apply/lookup" />}>{t("lookup")}</Button>
        </div>
      }
    />
  );
}

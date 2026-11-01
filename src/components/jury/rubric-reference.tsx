import { getTranslations } from "next-intl/server";
import { BookOpenCheck } from "lucide-react";
import { prisma } from "@/lib/db";

/** Reference card: criteria + weights of the MIDTERM and FINAL rubrics (from DB). */
export async function RubricReference() {
  const [t, te, rubrics] = await Promise.all([
    getTranslations("jury"),
    getTranslations("enums"),
    prisma.rubric.findMany({
      where: { kind: { in: ["MIDTERM", "FINAL"] } },
      select: { kind: true, criteria: { orderBy: { order: "asc" }, select: { id: true, key: true, weight: true } } },
    }),
  ]);
  const ordered = ["MIDTERM", "FINAL"].map((k) => rubrics.find((r) => r.kind === k)).filter((r) => !!r);
  return (
    <section className="rounded-xl border bg-card p-4 shadow-card sm:p-5" aria-labelledby="rubric-ref-title">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground" aria-hidden>
          <BookOpenCheck className="size-4" />
        </span>
        <div>
          <h2 id="rubric-ref-title" className="text-sm font-semibold">{t("reference.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("reference.hint")}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-5 md:grid-cols-2">
        {ordered.map((r) => (
          <div key={r.kind}>
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">{te(`RubricKind.${r.kind}`)}</h3>
            <ul className="mt-2 space-y-2.5">
              {r.criteria.map((c) => (
                <li key={c.id}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{t(`criteria.${c.key}.title`)}</span>
                    <span className="tabular shrink-0 text-xs font-semibold text-muted-foreground">{c.weight}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div className="h-full rounded-full bg-chart-1" style={{ width: `${c.weight * 2.5}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{t(`criteria.${c.key}.hint`)}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        <span className="font-semibold">{t("reference.scaleLabel")}</span>{" "}
        {[1, 2, 3, 4, 5].map((n) => `${n} ${t(`scale.${n}` as never)}`).join(" · ")}
      </p>
    </section>
  );
}

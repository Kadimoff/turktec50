import { getTranslations } from "next-intl/server";
import { Mail } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";

export type MentorCardData = {
  id: string;
  name: string;
  title: string | null;
  email: string;
  expertise: string | null;
  projects: number;
  completed: number;
  minutes: number;
  /** TEAM view: the mentor's focus on this project */
  focus?: string | null;
  upcoming?: number;
};

/** Mentor directory card: identity, expertise tags and activity numbers. */
export async function MentorCard({ m, variant = "pool", className }: { m: MentorCardData; variant?: "pool" | "team"; className?: string }) {
  const t = await getTranslations("mentors");
  const tags = (m.expertise ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const hours = Math.round((m.minutes / 60) * 10) / 10;
  const stats =
    variant === "pool"
      ? [
          { label: t("pool.projectsLabel"), value: m.projects },
          { label: t("pool.sessionsLabel"), value: m.completed },
          { label: t("pool.hoursLabel"), value: hours },
        ]
      : [
          { label: t("pool.sessionsLabel"), value: m.completed },
          { label: t("pool.upcomingLabel"), value: m.upcoming ?? 0 },
          { label: t("pool.hoursLabel"), value: hours },
        ];
  return (
    <article className={cn("flex flex-col rounded-xl border bg-card p-4 shadow-card", className)} aria-labelledby={`mentor-${m.id}`}>
      <div className="flex items-start gap-3">
        <UserAvatar name={m.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 id={`mentor-${m.id}`} className="truncate text-sm font-semibold">
            {m.name}
          </h3>
          <p className="line-clamp-2 text-xs text-muted-foreground">{m.title ?? "—"}</p>
          {variant === "team" && m.focus && (
            <p className="mt-1 text-xs">
              <span className="text-muted-foreground">{t("myMentors.focus")}:</span> <span className="font-medium">{m.focus}</span>
            </p>
          )}
        </div>
        <a
          href={`mailto:${m.email}`}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          aria-label={t("pool.email", { name: m.name })}
        >
          <Mail className="size-4" aria-hidden />
        </a>
      </div>
      {tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t("pool.expertise")}>
          {tags.map((tag) => (
            <li key={tag} className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {tag}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto pt-4">
      <dl className="grid grid-cols-3 gap-2 border-t pt-3 text-center">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-[11px] text-muted-foreground">{s.label}</dt>
            <dd className="tabular text-base font-bold">{s.value}</dd>
          </div>
        ))}
      </dl>
      </div>
    </article>
  );
}

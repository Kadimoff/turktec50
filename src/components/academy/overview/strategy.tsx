import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ArrowRight, Building2, FlaskConical, Handshake, Landmark, UserRoundCog, UsersRound, type LucideIcon,
} from "lucide-react";

type NavKey = "catalog" | "registry" | "mentors" | "teams" | "students" | "applications" | "trainings" | "projects" | "tasks" | "announcements";

const HREF: Record<NavKey, string> = {
  catalog: "/academy/catalog",
  registry: "/academy/registry",
  mentors: "/mentors",
  teams: "/academy/teams",
  students: "/academy/students",
  applications: "/applications",
  trainings: "/academy/trainings",
  projects: "/projects",
  tasks: "/tasks",
  announcements: "/announcements",
};

// Operating model of the ADNSU TEKNOFEST 2027 Academy (rolePlan / roadmap of the original panel).
const ROLES: { key: string; icon: LucideIcon; links: NavKey[] }[] = [
  { key: "office", icon: Landmark, links: ["projects", "catalog"] },
  { key: "faculties", icon: Building2, links: ["registry"] },
  { key: "mentors", icon: UserRoundCog, links: ["mentors"] },
  { key: "labs", icon: FlaskConical, links: ["registry", "trainings"] },
  { key: "teams", icon: UsersRound, links: ["teams", "students"] },
  { key: "partners", icon: Handshake, links: ["registry"] },
];

const STAGES: { key: string; links: NavKey[] }[] = [
  { key: "mobilisation", links: ["registry"] },
  { key: "selection", links: ["students", "applications"] },
  { key: "training", links: ["trainings", "catalog"] },
  { key: "prototype", links: ["projects"] },
  { key: "application", links: ["tasks"] },
  { key: "results", links: ["announcements"] },
];

function Links({ links, label }: { links: NavKey[]; label: (k: NavKey) => string }) {
  return (
    <ul className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-3">
      {links.map((k) => (
        <li key={k}>
          <Link
            href={HREF[k]}
            className="inline-flex min-h-8 items-center gap-1 rounded-md text-xs font-semibold text-primary transition-colors hover:text-primary/80 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {label(k)}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** "Preparation strategy": responsibilities (6 roles) and the 6 numbered preparation stages. */
export async function AcademyStrategy() {
  const [t, tn] = await Promise.all([getTranslations("academy.strategy"), getTranslations("nav")]);
  const label = (k: NavKey) => tn(k);
  return (
    <section aria-labelledby="strategy-title" className="space-y-5">
      <div>
        <h2 id="strategy-title" className="text-lg font-semibold tracking-tight">{t("title")}</h2>
        <p className="max-w-3xl text-sm text-pretty text-muted-foreground">{t("description")}</p>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground">{t("rolesTitle")}</h3>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ROLES.map(({ key, icon: Icon, links }) => (
            <li key={key} className="flex flex-col rounded-xl border bg-card p-4 shadow-card sm:p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground" aria-hidden>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-pretty">{t(`roles.${key}.name` as never)}</h4>
                  <p className="mt-1 text-sm text-pretty text-muted-foreground">{t(`roles.${key}.text` as never)}</p>
                </div>
              </div>
              <div className="flex flex-1 flex-col pl-11">
                <Links links={links} label={label} />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground">{t("stagesTitle")}</h3>
        <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {STAGES.map(({ key, links }, i) => (
            <li key={key} className="flex flex-col rounded-xl border bg-card p-4 shadow-card sm:p-5">
              <div className="flex items-start gap-3">
                <span className="tabular grid size-8 shrink-0 place-items-center rounded-full border-2 border-primary text-xs font-bold text-primary" aria-hidden>
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-pretty">
                    <span className="sr-only">{t("stageNumber", { n: i + 1 })} </span>
                    {t(`stages.${key}.name` as never)}
                  </h4>
                  <p className="mt-1 text-sm text-pretty text-muted-foreground">{t(`stages.${key}.text` as never)}</p>
                </div>
              </div>
              <div className="flex flex-1 flex-col pl-11">
                <Links links={links} label={label} />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

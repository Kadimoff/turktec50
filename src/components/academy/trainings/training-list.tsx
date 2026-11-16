import { getLocale, getTranslations } from "next-intl/server";
import { addMinutes } from "date-fns";
import { AlertTriangle, Clock, MapPin, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { bakuHm, bakuYmd } from "@/lib/dates";
import { fmtBaku, fmtDateTime, fmtRelative, fmtTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { EnumBadge } from "@/components/shared/enum-badge";
import { ToneBadge } from "@/components/shared/tone-badge";
import { DeleteTrainingButton, TrainingDialog } from "./training-dialogs";
import type { Option, TrainingValue } from "./types";

export const trainingSelect = {
  id: true, title: true, startsAt: true, durationMin: true, status: true, notes: true, mentorId: true,
  mentor: { select: { id: true, name: true, title: true } },
  lab: { select: { id: true, name: true, status: true, faculty: { select: { name: true } } } },
} satisfies Prisma.TrainingSelect;

export type TrainingRow = Prisma.TrainingGetPayload<{ select: typeof trainingSelect }>;

type Viewer = { id: string; role: string };
type Admin = { mentors: Option[]; labs: Option[]; defaultDate: string } | null;

/** One section ("upcoming" / "past") of the training schedule. */
export async function TrainingSection({
  kind, rows, viewer, admin, now, emptyIcon,
}: {
  kind: "upcoming" | "past";
  rows: TrainingRow[];
  viewer: Viewer;
  admin: Admin;
  now: Date;
  emptyIcon: LucideIcon;
}) {
  const t = await getTranslations("trainings");
  const id = `trainings-${kind}`;
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="text-base font-semibold">{t(`sections.${kind}`)}</h2>
        <p className="tabular text-xs text-muted-foreground">{t("count", { count: rows.length })}</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          title={t(`empty.${kind}`)}
          description={kind === "upcoming" ? (admin ? t("empty.upcomingAdmin") : t("empty.upcomingHint")) : t("empty.pastHint")}
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-card shadow-card">
          {rows.map((r) => <TrainingItem key={r.id} row={r} viewer={viewer} admin={admin} now={now} />)}
        </ul>
      )}
    </section>
  );
}

async function TrainingItem({ row, viewer, admin, now }: { row: TrainingRow; viewer: Viewer; admin: Admin; now: Date }) {
  const [t, te, locale] = await Promise.all([getTranslations("trainings"), getTranslations("enums"), getLocale()]);
  const endsAt = addMinutes(row.startsAt, row.durationMin);
  const ongoing = row.startsAt <= now && endsAt > now;
  const past = endsAt <= now;
  const mine = viewer.role === "MENTOR" && row.mentorId === viewer.id;
  const value: TrainingValue | null = admin && {
    id: row.id, title: row.title, date: bakuYmd(row.startsAt), time: bakuHm(row.startsAt), durationMin: row.durationMin, status: row.status,
    mentor: row.mentor && { id: row.mentor.id, name: row.mentor.name, hint: row.mentor.title },
    lab: row.lab && { id: row.lab.id, name: row.lab.name, hint: row.lab.status === "AVAILABLE" ? null : te(`LabStatus.${row.lab.status}`) },
    notes: row.notes,
  };

  return (
    <li className={cn("flex gap-3 p-4 sm:gap-4 sm:px-5", mine && "bg-primary/5")}>
      <time
        dateTime={row.startsAt.toISOString()}
        title={`${fmtDateTime(row.startsAt, locale)} · ${t("timezone")}`}
        className={cn("flex w-14 shrink-0 flex-col items-center self-start rounded-lg border py-1.5 text-center", past ? "bg-muted/60 text-muted-foreground" : "bg-background")}
      >
        <span className="text-2xs font-semibold leading-4 text-primary">{fmtBaku(row.startsAt, "MMM", locale)}</span>
        <span className="tabular text-xl font-bold leading-6">{fmtBaku(row.startsAt, "d", locale)}</span>
        <span className="text-2xs leading-4 text-muted-foreground">{fmtBaku(row.startsAt, "EEE", locale)}</span>
      </time>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-pretty">{row.title}</h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <EnumBadge enumName="TrainingStatus" value={row.status} />
              {ongoing && <ToneBadge tone="info">{t("ongoing")}</ToneBadge>}
              {mine && <ToneBadge tone="brand">{t("youLead")}</ToneBadge>}
            </div>
          </div>
          {admin && value && (
            <div className="-mt-1 -mr-2 flex shrink-0 items-center">
              <TrainingDialog training={value} mentors={admin.mentors} labs={admin.labs} defaultDate={admin.defaultDate} />
              <DeleteTrainingButton id={row.id} title={row.title} />
            </div>
          )}
        </div>

        <dl className="mt-2.5 grid gap-x-6 gap-y-1.5 text-label sm:grid-cols-2 xl:grid-cols-3">
          <Meta icon={Clock} label={t("meta.time")}>
            <span className="tabular">{fmtTime(row.startsAt)}–{fmtTime(endsAt)}</span>
            <span className="text-muted-foreground"> · {t("duration", { count: row.durationMin })} · {fmtRelative(row.startsAt, locale)}</span>
          </Meta>
          <Meta icon={MapPin} label={t("meta.lab")}>
            {row.lab ? (
              <>
                {row.lab.name}
                {row.lab.status !== "AVAILABLE" && (
                  <span className={row.lab.status === "CLOSED" ? "text-danger" : "text-warning"}> · {te(`LabStatus.${row.lab.status}`)}</span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">{t("noLab")}</span>
            )}
          </Meta>
          <Meta icon={UserRound} label={t("meta.mentor")}>
            {row.mentor ? row.mentor.name : <span className="text-muted-foreground">{t("noMentor")}</span>}
          </Meta>
        </dl>

        {row.notes && <p className="mt-2.5 whitespace-pre-line text-label text-muted-foreground">{row.notes}</p>}

        {admin && past && row.status !== "COMPLETED" && (
          <p className="mt-2.5 flex items-start gap-1.5 text-xs font-medium text-warning">
            <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
            {t("statusStale")}
          </p>
        )}
      </div>
    </li>
  );
}

function Meta({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-1.5">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <dt className="sr-only">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

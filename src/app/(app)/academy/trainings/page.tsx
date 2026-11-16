import { getTranslations } from "next-intl/server";
import { addMinutes } from "date-fns";
import { CalendarClock, CalendarPlus, History } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { bakuAddDays, bakuYmd } from "@/lib/dates";
import { PageHeader } from "@/components/shared/page-header";
import { TrainingDialog } from "@/components/academy/trainings/training-dialogs";
import { TrainingSection, trainingSelect } from "@/components/academy/trainings/training-list";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("trainings") };
}

const PAST_LIMIT = 30;

export default async function TrainingsPage() {
  const user = await requireUser(["ADMIN", "MENTOR", "TEAM"]);
  const t = await getTranslations("trainings");
  const isAdmin = user.role === "ADMIN";
  const now = new Date();

  const [recent, past, mentors, labs] = await Promise.all([
    // started at most a day ago → may still be running; split by end time below
    prisma.training.findMany({ where: { startsAt: { gte: new Date(now.getTime() - 86_400_000) } }, orderBy: { startsAt: "asc" }, select: trainingSelect }),
    prisma.training.findMany({ where: { startsAt: { lt: now } }, orderBy: { startsAt: "desc" }, take: PAST_LIMIT, select: trainingSelect }),
    isAdmin ? prisma.user.findMany({ where: { role: "MENTOR", active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, title: true } }) : [],
    isAdmin ? prisma.lab.findMany({ where: { status: { not: "CLOSED" } }, orderBy: { name: "asc" }, select: { id: true, name: true, faculty: { select: { name: true } } } }) : [],
  ]);
  const ended = (r: (typeof recent)[number]) => addMinutes(r.startsAt, r.durationMin) <= now;
  const upcoming = recent.filter((r) => !ended(r));
  const done = past.filter(ended);

  const admin = isAdmin
    ? {
        mentors: mentors.map((m) => ({ id: m.id, name: m.name, hint: m.title })),
        labs: labs.map((l) => ({ id: l.id, name: l.name, hint: l.faculty?.name ?? null })),
        defaultDate: bakuYmd(bakuAddDays(now, 1)),
      }
    : null;
  const description = isAdmin ? t("descriptionAdmin") : user.role === "MENTOR" ? t("descriptionMentor") : t("descriptionTeam");
  const viewer = { id: user.id, role: user.role };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={description}
        actions={admin && <TrainingDialog mentors={admin.mentors} labs={admin.labs} defaultDate={admin.defaultDate} />}
      />
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarClock className="size-4 shrink-0 text-primary" aria-hidden />
        {t("timezoneNote")}
      </p>
      <TrainingSection kind="upcoming" rows={upcoming} viewer={viewer} admin={admin} now={now} emptyIcon={CalendarPlus} />
      <TrainingSection kind="past" rows={done} viewer={viewer} admin={admin} now={now} emptyIcon={History} />
    </div>
  );
}

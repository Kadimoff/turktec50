// Client-safe view models for Academy trainings.
import type { TrainingStatus } from "@/generated/prisma/enums";

export const TRAINING_STATUSES: TrainingStatus[] = ["PLANNED", "REGISTRATION_OPEN", "COMPLETED"];

export type Option = { id: string; name: string; hint?: string | null };

/** Serializable training passed to the edit dialog. date/time are Baku wall-clock values for the inputs. */
export type TrainingValue = {
  id: string;
  title: string;
  date: string; // yyyy-MM-dd (Asia/Baku)
  time: string; // HH:mm (Asia/Baku)
  durationMin: number;
  status: TrainingStatus;
  mentor: Option | null;
  lab: Option | null;
  notes: string | null;
};

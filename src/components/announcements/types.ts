// Client-safe view models for announcements.
import type { Role } from "@/generated/prisma/enums";

export const ROLES: Role[] = ["ADMIN", "TEAM", "MENTOR", "JURY"];

export type AnnouncementValue = { id: string; title: string; body: string; audience: Role[] };

export const TITLE_MAX = 160;
export const BODY_MAX = 4000;

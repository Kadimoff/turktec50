import type { Role } from "@/generated/prisma/enums";

export type NavIcon =
  | "dashboard" | "project" | "applications" | "projects" | "tasks" | "mentors" | "documents" | "risks"
  | "jury" | "kpi" | "calendar" | "users" | "audit" | "system"
  | "academy" | "catalog" | "students" | "teams" | "registry" | "trainings" | "announcements" | "intake";
export type NavItem = { key: string; href: string; icon: NavIcon };
export type NavGroup = { key: "workspace" | "evaluation" | "academy" | "program" | "admin"; items: NavItem[] };

/** Role-based navigation. Each role only sees its own menu. */
export function navFor(role: Role, myProjectId?: string | null, isRoot = false): NavGroup[] {
  const d: NavItem = { key: "dashboard", href: "/dashboard", icon: "dashboard" };
  const catalog: NavItem = { key: "catalog", href: "/academy/catalog", icon: "catalog" };
  const announcements: NavItem = { key: "announcements", href: "/announcements", icon: "announcements" };
  const calendar: NavItem = { key: "calendar", href: "/calendar", icon: "calendar" };
  switch (role) {
    case "ADMIN":
      return [
        { key: "workspace", items: [d, { key: "projects", href: "/projects", icon: "projects" }, { key: "tasks", href: "/tasks", icon: "tasks" }, { key: "mentors", href: "/mentors", icon: "mentors" }, { key: "documents", href: "/documents", icon: "documents" }, { key: "risks", href: "/risks", icon: "risks" }] },
        { key: "evaluation", items: [{ key: "applications", href: "/applications", icon: "applications" }, { key: "jury", href: "/jury", icon: "jury" }] },
        { key: "academy", items: [{ key: "academy", href: "/academy", icon: "academy" }, { key: "intake", href: "/academy/intake", icon: "intake" }, catalog, { key: "students", href: "/academy/students", icon: "students" }, { key: "teams", href: "/academy/teams", icon: "teams" }, { key: "registry", href: "/academy/registry", icon: "registry" }, { key: "trainings", href: "/academy/trainings", icon: "trainings" }] },
        { key: "program", items: [{ key: "kpi", href: "/kpi", icon: "kpi" }, calendar, announcements] },
        { key: "admin", items: [{ key: "users", href: "/admin/users", icon: "users" }, { key: "audit", href: "/admin/audit", icon: "audit" }, ...(isRoot ? [{ key: "system", href: "/admin/system", icon: "system" as const }] : [])] },
      ];
    case "TEAM":
      return [
        { key: "workspace", items: [d, ...(myProjectId ? [{ key: "myProject", href: `/projects/${myProjectId}`, icon: "project" as const }] : []), { key: "tasks", href: "/tasks", icon: "tasks" }, { key: "mentors", href: "/mentors", icon: "mentors" }, { key: "documents", href: "/documents", icon: "documents" }, { key: "risks", href: "/risks", icon: "risks" }] },
        { key: "program", items: [catalog, { key: "applyPrep", href: "/apply", icon: "intake" }, calendar, { key: "trainings", href: "/academy/trainings", icon: "trainings" }, announcements] },
      ];
    case "MENTOR":
      return [
        { key: "workspace", items: [d, { key: "projects", href: "/projects", icon: "projects" }, { key: "tasks", href: "/tasks", icon: "tasks" }, { key: "mentors", href: "/mentors", icon: "mentors" }, { key: "documents", href: "/documents", icon: "documents" }, { key: "risks", href: "/risks", icon: "risks" }] },
        { key: "program", items: [catalog, { key: "myAcademyTeams", href: "/academy/teams", icon: "teams" }, calendar, { key: "trainings", href: "/academy/trainings", icon: "trainings" }, announcements] },
      ];
    case "JURY":
      return [
        { key: "workspace", items: [d, { key: "projects", href: "/projects", icon: "projects" }] },
        { key: "evaluation", items: [{ key: "jury", href: "/jury", icon: "jury" }, { key: "applications", href: "/applications", icon: "applications" }] },
        { key: "program", items: [calendar, announcements] },
      ];
  }
}

import type { Role } from "@/generated/prisma/enums";

export type NavIcon =
  | "dashboard" | "project" | "applications" | "projects" | "tasks" | "mentors" | "documents" | "risks"
  | "jury" | "kpi" | "calendar" | "users" | "audit";
export type NavItem = { key: string; href: string; icon: NavIcon };
export type NavGroup = { key: "workspace" | "evaluation" | "program" | "admin"; items: NavItem[] };

/** Role-based navigation. Each role only sees its own menu. */
export function navFor(role: Role, myProjectId?: string | null): NavGroup[] {
  const d: NavItem = { key: "dashboard", href: "/dashboard", icon: "dashboard" };
  switch (role) {
    case "ADMIN":
      return [
        { key: "workspace", items: [d, { key: "projects", href: "/projects", icon: "projects" }, { key: "tasks", href: "/tasks", icon: "tasks" }, { key: "mentors", href: "/mentors", icon: "mentors" }, { key: "documents", href: "/documents", icon: "documents" }, { key: "risks", href: "/risks", icon: "risks" }] },
        { key: "evaluation", items: [{ key: "applications", href: "/applications", icon: "applications" }, { key: "jury", href: "/jury", icon: "jury" }] },
        { key: "program", items: [{ key: "kpi", href: "/kpi", icon: "kpi" }, { key: "calendar", href: "/calendar", icon: "calendar" }] },
        { key: "admin", items: [{ key: "users", href: "/admin/users", icon: "users" }, { key: "audit", href: "/admin/audit", icon: "audit" }] },
      ];
    case "TEAM":
      return [
        { key: "workspace", items: [d, ...(myProjectId ? [{ key: "myProject", href: `/projects/${myProjectId}`, icon: "project" as const }] : []), { key: "tasks", href: "/tasks", icon: "tasks" }, { key: "mentors", href: "/mentors", icon: "mentors" }, { key: "documents", href: "/documents", icon: "documents" }, { key: "risks", href: "/risks", icon: "risks" }] },
        { key: "program", items: [{ key: "calendar", href: "/calendar", icon: "calendar" }] },
      ];
    case "MENTOR":
      return [
        { key: "workspace", items: [d, { key: "projects", href: "/projects", icon: "projects" }, { key: "tasks", href: "/tasks", icon: "tasks" }, { key: "mentors", href: "/mentors", icon: "mentors" }, { key: "documents", href: "/documents", icon: "documents" }, { key: "risks", href: "/risks", icon: "risks" }] },
        { key: "program", items: [{ key: "calendar", href: "/calendar", icon: "calendar" }] },
      ];
    case "JURY":
      return [
        { key: "workspace", items: [d, { key: "projects", href: "/projects", icon: "projects" }] },
        { key: "evaluation", items: [{ key: "jury", href: "/jury", icon: "jury" }, { key: "applications", href: "/applications", icon: "applications" }] },
        { key: "program", items: [{ key: "calendar", href: "/calendar", icon: "calendar" }] },
      ];
  }
}

"use client";
import { createContext, useContext } from "react";
import type { TaskFormProject } from "./types";

type TaskCtx = {
  /** projects the user can create tasks in (with members for the assignee select) */
  projects: TaskFormProject[];
  canCreate: boolean;
  currentWeek: number;
  /** hide the project column/chip when the page is already scoped to one project */
  showProject: boolean;
};

const Ctx = createContext<TaskCtx>({ projects: [], canCreate: false, currentWeek: 1, showProject: true });

export function TaskProvider({ value, children }: { value: TaskCtx; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTaskContext() {
  return useContext(Ctx);
}

"use client";

import { createContext, useContext } from "react";
import type { StudentFormOptions } from "./types";

const Ctx = createContext<StudentFormOptions | null>(null);

/** Serializes the dialog options once per page instead of once per row. */
export function StudentOptionsProvider({ value, children }: { value: StudentFormOptions; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStudentOptions() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStudentOptions must be used inside <StudentOptionsProvider>");
  return v;
}

"use client";

import { createContext, useContext } from "react";
import type { TeamFormOptions } from "./types";

const Ctx = createContext<TeamFormOptions | null>(null);

/** Serializes the dialog options once per page instead of once per row. */
export function TeamOptionsProvider({ value, children }: { value: TeamFormOptions; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTeamOptions() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTeamOptions must be used inside <TeamOptionsProvider>");
  return v;
}

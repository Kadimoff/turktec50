/**
 * Pure layout for the swim-lane process diagram (no React, unit-tested in tests/workflow.test.ts).
 * Main-line stages get one column each, placed in the lane of their primary responsible role;
 * WAITING / REJECTED stages hang off the previous main stage (decision diamond) in the "side paths" lane.
 */
import type { Role, WorkflowScope, WorkflowStageKind } from "../../generated/prisma/enums";

export type LayoutStage = { id: string; scope: WorkflowScope; kind: WorkflowStageKind; roles: Role[] };

export const DIM = {
  labelW: 156,
  colW: 172,
  nodeW: 128,
  nodeH: 64,
  titleH: 56,
  phaseH: 34,
  laneH: 92,
  branchGap: 14,
  streamRowH: 30,
  funnelH: 196,
  legendH: 46,
  pad: 24,
} as const;

export type NodeBox = { id: string; x: number; y: number; w: number; h: number; lane: number; col: number; branch: boolean };
export type Column = { main: string; branches: string[]; scope: WorkflowScope; x: number };

export function isBranchKind(kind: WorkflowStageKind) {
  return kind === "WAITING" || kind === "REJECTED";
}

export function computeLayout(stages: LayoutStage[], lanes: Role[], streamRows: number) {
  const cols: Column[] = [];
  for (const s of stages) {
    const last = cols[cols.length - 1];
    if (isBranchKind(s.kind) && last && last.scope === s.scope) last.branches.push(s.id);
    else cols.push({ main: s.id, branches: [], scope: s.scope, x: 0 });
  }
  cols.forEach((c, i) => { c.x = DIM.labelW + i * DIM.colW + (DIM.colW - DIM.nodeW) / 2; });

  const maxBranches = Math.max(1, ...cols.map((c) => c.branches.length));
  const lanesTop = DIM.titleH + DIM.phaseH;
  const branchTop = lanesTop + lanes.length * DIM.laneH;
  const branchH = maxBranches * (DIM.nodeH + DIM.branchGap) + DIM.branchGap + 8;
  const streamsTop = branchTop + branchH;
  const streamsH = streamRows * DIM.streamRowH + 24;
  const funnelTop = streamsTop + streamsH;
  const legendTop = funnelTop + DIM.funnelH;
  const width = DIM.labelW + Math.max(cols.length, 5) * DIM.colW + DIM.pad;
  const height = legendTop + DIM.legendH;

  const byId = new Map(stages.map((s) => [s.id, s]));
  const nodes = new Map<string, NodeBox>();
  cols.forEach((c, ci) => {
    const s = byId.get(c.main)!;
    const lane = Math.max(0, lanes.indexOf(s.roles[0] ?? "ADMIN"));
    nodes.set(c.main, { id: c.main, x: c.x, y: lanesTop + lane * DIM.laneH + (DIM.laneH - DIM.nodeH) / 2, w: DIM.nodeW, h: DIM.nodeH, lane, col: ci, branch: false });
    c.branches.forEach((b, bi) => {
      nodes.set(b, { id: b, x: c.x, y: branchTop + DIM.branchGap + 4 + bi * (DIM.nodeH + DIM.branchGap), w: DIM.nodeW, h: DIM.nodeH, lane: -1, col: ci, branch: true });
    });
  });

  return { cols, nodes, width, height, lanesTop, branchTop, branchH, streamsTop, streamsH, funnelTop, legendTop };
}

/** Orthogonal arrow path between two main nodes (right edge → left edge). */
export function arrowPath(a: NodeBox, b: NodeBox) {
  const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2;
  if (Math.abs(y1 - y2) < 1) return `M${x1},${y1} H${x2 - 2}`;
  const xm = x1 + 12;
  const r = 6, dir = y2 > y1 ? 1 : -1;
  return `M${x1},${y1} H${xm - r} Q${xm},${y1} ${xm},${y1 + dir * r} V${y2 - dir * r} Q${xm},${y2} ${xm + r},${y2} H${x2 - 2}`;
}

/** Greedy word wrap by an average glyph width; at most `maxLines` lines (last one ellipsized). */
export function wrapText(text: string, maxChars: number, maxLines = 3) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars || !cur) cur = next;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1]!.slice(0, Math.max(1, maxChars - 1))}…`;
    return kept;
  }
  return lines.map((l) => (l.length > maxChars + 3 ? `${l.slice(0, maxChars)}…` : l));
}

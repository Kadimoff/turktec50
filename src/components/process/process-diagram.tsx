"use client";
import { forwardRef } from "react";
import { useTranslations } from "next-intl";
import type { WorkflowStageKind } from "@/generated/prisma/enums";
import { arrowPath, computeLayout, DIM, wrapText } from "./layout";
import { LANES, type DiagramStage, type FunnelStat, type StreamStat } from "./types";

/** Colors are design tokens (CSS variables) — they follow light/dark theme and are resolved to hex on export. */
const KIND_STYLE: Record<WorkflowStageKind, { fill: string; stroke: string; text: string; dash?: string }> = {
  NORMAL: { fill: "var(--accent)", stroke: "var(--primary)", text: "var(--accent-foreground)" },
  DECISION: { fill: "var(--info-soft)", stroke: "var(--info)", text: "var(--info)" },
  WAITING: { fill: "var(--warning-soft)", stroke: "var(--warning)", text: "var(--warning)", dash: "5 4" },
  REJECTED: { fill: "var(--danger-soft)", stroke: "var(--danger)", text: "var(--danger)", dash: "5 4" },
  DONE: { fill: "var(--success-soft)", stroke: "var(--success)", text: "var(--success)" },
};

type Props = {
  stages: DiagramStage[];
  streams: StreamStat[];
  funnel: FunnelStat[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  title: string;
  subtitle: string;
  /** "fit" = width 100% (presentation), otherwise natural pixel size × zoom */
  fit?: boolean;
  zoom?: number;
  /** presentation mode: larger type inside the same boxes */
  large?: boolean;
};

export const ProcessDiagram = forwardRef<SVGSVGElement, Props>(function ProcessDiagram(
  { stages, streams, funnel, selectedId, onSelect, title, subtitle, fit, zoom = 1, large },
  ref,
) {
  const t = useTranslations("process");
  const L = computeLayout(stages, LANES, streams.length);
  const k = large ? 1.14 : 1; // type scale
  const byId = new Map(stages.map((s) => [s.id, s]));
  const mainCols = L.cols;
  const appCols = mainCols.filter((c) => c.scope === "APPLICATION");
  const prjCols = mainCols.filter((c) => c.scope === "PROJECT");
  const colSpan = (cs: typeof mainCols) => (cs.length ? { x0: cs[0]!.x - (DIM.colW - DIM.nodeW) / 2, x1: cs[cs.length - 1]!.x + DIM.nodeW + (DIM.colW - DIM.nodeW) / 2 } : null);
  const appSpan = colSpan(appCols);
  const prjSpan = colSpan(prjCols);
  const contentRight = L.width - DIM.pad / 2;

  const handleKey = (id: string) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(id); }
  };

  const node = (s: DiagramStage) => {
    const b = L.nodes.get(s.id);
    if (!b) return null;
    const st = KIND_STYLE[s.kind];
    const lines = wrapText(s.name, large ? 15 : 17, 3);
    const lineH = 14 * k;
    const textTop = b.y + b.h / 2 - ((lines.length - 1) * lineH) / 2;
    const selected = selectedId === s.id;
    const label = `${s.name}: ${s.count}${s.mine ? ` · ${t("diagram.you")}` : ""}`;
    return (
      <g
        key={s.id}
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-pressed={selected}
        data-stage-id={s.id}
        data-stage-key={s.systemKey ?? "custom"}
        onClick={() => onSelect(s.id)}
        onKeyDown={handleKey(s.id)}
        className="wf-node cursor-pointer outline-none [&:focus-visible>.wf-focus]:opacity-100"
      >
        <title>{s.description ? `${s.name} — ${s.description}` : s.name}</title>
        <rect className="wf-ui wf-focus opacity-0" x={b.x - 5} y={b.y - 5} width={b.w + 10} height={b.h + 10} rx={14} fill="none" stroke="var(--ring)" strokeWidth={2} />
        {selected && <rect className="wf-ui" x={b.x - 5} y={b.y - 5} width={b.w + 10} height={b.h + 10} rx={14} fill="none" stroke="var(--ring)" strokeWidth={2} strokeDasharray="4 3" />}
        <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={10} fill={st.fill} stroke={st.stroke} strokeWidth={s.mine ? 3 : 1.5} strokeDasharray={st.dash} />
        {!s.systemKey && <circle cx={b.x + 9} cy={b.y + 9} r={3} fill={st.stroke}><title>{t("diagram.customStage")}</title></circle>}
        {lines.map((ln, i) => (
          <text key={i} x={b.x + b.w / 2} y={textTop + i * lineH} textAnchor="middle" dominantBaseline="central" fontSize={11.5 * k} fontWeight={600} fill={st.text}>{ln}</text>
        ))}
        <g>
          <rect x={b.x + b.w - 26} y={b.y - 10} width={34} height={20} rx={10} fill={s.count > 0 ? "var(--primary)" : "var(--muted)"} stroke="var(--card)" strokeWidth={2} />
          <text x={b.x + b.w - 9} y={b.y} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fill={s.count > 0 ? "var(--primary-foreground)" : "var(--muted-foreground)"}>{s.count}</text>
        </g>
        {s.mine && (
          <text x={b.x + b.w / 2} y={b.y + b.h + 13} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--primary)">▲ {t("diagram.you")}</text>
        )}
      </g>
    );
  };

  // connectors between consecutive main-line nodes
  const arrows: React.ReactNode[] = [];
  const diamonds: React.ReactNode[] = [];
  mainCols.forEach((c, i) => {
    const b = L.nodes.get(c.main)!;
    if (i > 0) {
      const a = L.nodes.get(mainCols[i - 1]!.main)!;
      const crossScope = mainCols[i - 1]!.scope !== c.scope;
      arrows.push(<path key={`a${i}`} d={arrowPath(a, b)} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.6} strokeDasharray={crossScope ? "6 4" : undefined} markerEnd="url(#wf-arrow)" />);
    }
    if (c.branches.length) {
      const dx = b.x - 22, dy = b.y + b.h / 2, r = 9;
      const last = L.nodes.get(c.branches[c.branches.length - 1]!)!;
      diamonds.push(
        <g key={`d${i}`}>
          <path d={`M${dx},${dy + r} V${last.y + last.h / 2}`} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.4} />
          {c.branches.map((id) => {
            const bb = L.nodes.get(id)!;
            const kind = byId.get(id)!.kind;
            const color = kind === "WAITING" ? "var(--warning)" : "var(--danger)";
            return <path key={id} d={`M${dx},${bb.y + bb.h / 2} H${bb.x - 2}`} fill="none" stroke={color} strokeWidth={1.8} strokeDasharray="5 3" markerEnd={kind === "WAITING" ? "url(#wf-arrow-warn)" : "url(#wf-arrow-danger)"} />;
          })}
          <polygon points={`${dx},${dy - r} ${dx + r},${dy} ${dx},${dy + r} ${dx - r},${dy}`} fill="var(--card)" stroke="var(--info)" strokeWidth={1.8} />
          <text x={dx} y={dy - r - 6} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--info)">{t("diagram.decision")}</text>
        </g>,
      );
    }
  });

  // secondary responsible roles: dashed "participates" pills in their lanes, linked to the node
  const pills: React.ReactNode[] = [];
  for (const c of mainCols) {
    const s = byId.get(c.main)!;
    const b = L.nodes.get(c.main)!;
    for (const r of s.roles.slice(1)) {
      const lane = LANES.indexOf(r);
      if (lane < 0 || lane === b.lane) continue;
      const py = L.lanesTop + lane * DIM.laneH + DIM.laneH / 2;
      const ny = py > b.y ? b.y + b.h : b.y;
      pills.push(
        <g key={`${c.main}-${r}`}>
          <path d={`M${b.x + b.w / 2},${ny} V${py + (py > b.y ? -13 : 13)}`} stroke="var(--muted-foreground)" strokeWidth={1.2} strokeDasharray="2 3" fill="none" />
          <rect x={b.x + 2} y={py - 13} width={b.w - 4} height={26} rx={13} fill="var(--card)" stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="4 3" />
          <text x={b.x + b.w / 2} y={py} textAnchor="middle" dominantBaseline="central" fontSize={10.5 * k} fill="var(--muted-foreground)">{t(`diagram.participates.${r}`)}</text>
        </g>,
      );
    }
  }

  const laneLabel = (y: number, h: number, titleText: string, hint: string, key: string) => (
    <g key={key}>
      <text x={14} y={y + h / 2 - 7} fontSize={12.5 * k} fontWeight={700} fill="var(--foreground)">{titleText}</text>
      {wrapText(hint, large ? 19 : 22, 2).map((ln, i) => (
        <text key={i} x={14} y={y + h / 2 + 9 + i * 13 * k} fontSize={10.5 * k} fill="var(--muted-foreground)">{ln}</text>
      ))}
    </g>
  );

  // parallel streams: bars across the incubation columns
  const sx0 = (prjSpan ?? appSpan ?? { x0: DIM.labelW }).x0 + 6;
  const sx1 = (prjSpan ?? appSpan ?? { x1: contentRight }).x1 - 6;
  // KPI funnel: 5 trapezoids, height ∝ plan
  const fx0 = DIM.labelW + 6, fx1 = contentRight - 6;
  const fw = (fx1 - fx0) / Math.max(1, funnel.length);
  const maxPlan = Math.max(1, ...funnel.map((f) => f.plan));
  const fh = (plan: number) => 26 + 74 * (plan / maxPlan);
  const fMid = L.funnelTop + 64;

  const legend: { kind: WorkflowStageKind; label: string }[] = [
    { kind: "NORMAL", label: t("kinds.NORMAL") }, { kind: "DECISION", label: t("kinds.DECISION") }, { kind: "WAITING", label: t("kinds.WAITING") },
    { kind: "REJECTED", label: t("kinds.REJECTED") }, { kind: "DONE", label: t("kinds.DONE") },
  ];

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${L.width} ${L.height}`}
      width={fit ? "100%" : L.width * zoom}
      height={fit ? (large ? "100%" : undefined) : L.height * zoom}
      preserveAspectRatio="xMidYMid meet"
      role="group"
      aria-label={title}
      fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"
      className="block select-none"
      data-testid="process-diagram"
    >
      <defs>
        <marker id="wf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--muted-foreground)" /></marker>
        <marker id="wf-arrow-warn" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--warning)" /></marker>
        <marker id="wf-arrow-danger" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--danger)" /></marker>
      </defs>
      <rect x={0} y={0} width={L.width} height={L.height} fill="var(--card)" />

      {/* title */}
      <text x={14} y={24} fontSize={17} fontWeight={800} fill="var(--foreground)">{title}</text>
      <text x={14} y={43} fontSize={11.5} fill="var(--muted-foreground)">{subtitle}</text>

      {/* phase bands */}
      {appSpan && (
        <g>
          <rect x={appSpan.x0 + 2} y={DIM.titleH} width={appSpan.x1 - appSpan.x0 - 4} height={L.branchTop + L.branchH - DIM.titleH} rx={10} fill="var(--info-soft)" opacity={0.45} />
          <text x={appSpan.x0 + 12} y={DIM.titleH + 21} fontSize={12} fontWeight={700} fill="var(--info)">{t("diagram.phaseApplications")}</text>
        </g>
      )}
      {prjSpan && (
        <g>
          <rect x={prjSpan.x0 + 2} y={DIM.titleH} width={prjSpan.x1 - prjSpan.x0 - 4} height={L.branchTop + L.branchH - DIM.titleH} rx={10} fill="var(--accent)" opacity={0.4} />
          <text x={prjSpan.x0 + 12} y={DIM.titleH + 21} fontSize={12} fontWeight={700} fill="var(--accent-foreground)">{t("diagram.phaseProjects")}</text>
        </g>
      )}

      {/* lanes */}
      {LANES.map((r, i) => {
        const y = L.lanesTop + i * DIM.laneH;
        return (
          <g key={r}>
            <line x1={8} x2={contentRight} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} />
            {laneLabel(y, DIM.laneH, t(`lanes.${r}`), t(`laneHints.${r}`), `l${r}`)}
          </g>
        );
      })}
      <line x1={8} x2={contentRight} y1={L.branchTop} y2={L.branchTop} stroke="var(--border)" strokeWidth={1} />
      {laneLabel(L.branchTop, L.branchH, t("diagram.branchLane"), t("diagram.branchLaneHint"), "lb")}
      <line x1={8} x2={contentRight} y1={L.streamsTop} y2={L.streamsTop} stroke="var(--border)" strokeWidth={1} />
      {laneLabel(L.streamsTop, L.streamsH, t("diagram.streamsLane"), t("diagram.streamsLaneHint"), "ls")}
      <line x1={8} x2={contentRight} y1={L.funnelTop} y2={L.funnelTop} stroke="var(--border)" strokeWidth={1} />
      {laneLabel(L.funnelTop, 128, t("diagram.funnelLane"), funnel.some((f) => f.actual !== null) ? t("diagram.funnelLaneHint") : t("diagram.funnelPlanOnly"), "lf")}

      {pills}
      {arrows}
      {diamonds}
      {stages.map(node)}

      {/* parallel streams */}
      {streams.map((s, i) => {
        const y = L.streamsTop + 12 + i * DIM.streamRowH;
        const pct = s.total > 0 ? Math.min(1, s.done / s.total) : 0;
        return (
          <g key={s.key} data-stream={s.key}>
            <rect x={sx0} y={y} width={sx1 - sx0} height={DIM.streamRowH - 8} rx={11} fill="var(--secondary)" stroke="var(--border)" />
            {s.key !== "risks" && <rect x={sx0} y={y} width={Math.max(0, (sx1 - sx0) * pct)} height={DIM.streamRowH - 8} rx={11} fill="var(--chart-1)" opacity={0.18} />}
            <text x={sx0 + 12} y={y + (DIM.streamRowH - 8) / 2} dominantBaseline="central" fontSize={11.5 * k} fontWeight={600} fill="var(--foreground)">{t(`streams.${s.key}`)}</text>
            <text x={sx1 - 12} y={y + (DIM.streamRowH - 8) / 2} dominantBaseline="central" textAnchor="end" fontSize={11.5 * k} fill="var(--muted-foreground)">{t(`streams.${s.key}Value`, { done: s.done, total: s.total })}</text>
          </g>
        );
      })}

      {/* KPI funnel: plan vs actual */}
      {funnel.map((f, i) => {
        const x = fx0 + i * fw;
        const h1 = fh(f.plan);
        const h2 = i < funnel.length - 1 ? fh(funnel[i + 1]!.plan) : h1 * 0.8;
        const pct = f.actual !== null && f.plan > 0 ? Math.round((f.actual / f.plan) * 100) : null;
        return (
          <g key={f.key} data-funnel={f.key}>
            <polygon
              points={`${x + 4},${fMid - h1 / 2} ${x + fw - 4},${fMid - h2 / 2} ${x + fw - 4},${fMid + h2 / 2} ${x + 4},${fMid + h1 / 2}`}
              fill="var(--accent)" stroke="var(--primary)" strokeWidth={1.2}
            />
            <text x={x + fw / 2} y={fMid} textAnchor="middle" dominantBaseline="central" fontSize={18} fontWeight={800} fill="var(--accent-foreground)">{f.plan}</text>
            {wrapText(t(`funnel.${f.key}`), 24, 2).map((ln, li) => (
              <text key={li} x={x + fw / 2} y={L.funnelTop + 128 + li * 14} textAnchor="middle" fontSize={11.5 * k} fontWeight={600} fill="var(--foreground)">{ln}</text>
            ))}
            <text x={x + fw / 2} y={L.funnelTop + 162} textAnchor="middle" fontSize={11 * k} fill="var(--muted-foreground)">
              {f.actual !== null ? t("funnel.planActual", { plan: f.plan, actual: f.actual, pct: pct ?? 0 }) : t("funnel.planOnly", { plan: f.plan })}
            </text>
            {f.actual !== null && (
              <g>
                <rect x={x + 18} y={L.funnelTop + 172} width={fw - 36} height={6} rx={3} fill="var(--muted)" />
                <rect x={x + 18} y={L.funnelTop + 172} width={(fw - 36) * Math.min(1, (pct ?? 0) / 100)} height={6} rx={3} fill={(pct ?? 0) >= 100 ? "var(--success)" : "var(--primary)"} />
              </g>
            )}
          </g>
        );
      })}

      {/* legend */}
      <line x1={8} x2={contentRight} y1={L.legendTop} y2={L.legendTop} stroke="var(--border)" strokeWidth={1} />
      <g transform={`translate(14, ${L.legendTop + 24})`}>
        {legend.map((l, i) => {
          const st = KIND_STYLE[l.kind];
          return (
            <g key={l.kind} transform={`translate(${i * 150}, 0)`}>
              <rect x={0} y={-8} width={22} height={16} rx={4} fill={st.fill} stroke={st.stroke} strokeDasharray={st.dash} strokeWidth={1.4} />
              <text x={30} y={0} dominantBaseline="central" fontSize={11} fill="var(--foreground)">{l.label}</text>
            </g>
          );
        })}
        <g transform={`translate(${legend.length * 150 + 10}, 0)`}>
          <polygon points="11,-8 19,0 11,8 3,0" fill="var(--card)" stroke="var(--info)" strokeWidth={1.6} />
          <text x={30} y={0} dominantBaseline="central" fontSize={11} fill="var(--foreground)">{t("diagram.decisionPoint")}</text>
        </g>
        <g transform={`translate(${legend.length * 150 + 290}, 0)`}>
          <rect x={0} y={-8} width={26} height={16} rx={8} fill="var(--card)" stroke="var(--muted-foreground)" strokeDasharray="4 3" />
          <text x={34} y={0} dominantBaseline="central" fontSize={11} fill="var(--foreground)">{t("diagram.participatesLegend")}</text>
        </g>
      </g>
    </svg>
  );
});

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRight, Download, ImageDown, Maximize2, Minimize2, Settings2, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToneBadge } from "@/components/shared/tone-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/tones";
import { ProcessDiagram } from "./process-diagram";
import type { ProcessData } from "./types";

const KIND_TONE: Record<string, Tone> = { NORMAL: "brand", DECISION: "info", WAITING: "warning", REJECTED: "danger", DONE: "success" };

/** Resolve CSS variables to concrete colors and strip interactive-only parts, so the SVG renders anywhere. */
function serializeSvg(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const cs = getComputedStyle(document.documentElement);
  const resolve = (v: string) => v.replace(/var\((--[\w-]+)\)/g, (_, name: string) => cs.getPropertyValue(name).trim() || "#000000");
  clone.querySelectorAll(".wf-ui").forEach((el) => el.remove());
  for (const el of [clone, ...Array.from(clone.querySelectorAll("*"))]) {
    for (const attr of Array.from(el.attributes)) {
      if (attr.value.includes("var(")) el.setAttribute(attr.name, resolve(attr.value));
      if (attr.name === "tabindex" || attr.name === "class" || attr.name.startsWith("aria-pressed")) el.removeAttribute(attr.name);
    }
  }
  const vb = svg.viewBox.baseVal;
  clone.setAttribute("width", String(vb.width));
  clone.setAttribute("height", String(vb.height));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return { text: `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`, width: vb.width, height: vb.height };
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function ProcessView({ data, canManage, initialSelected }: { data: ProcessData; canManage: boolean; initialSelected: string | null }) {
  const t = useTranslations("process");
  const svgRef = useRef<SVGSVGElement>(null);
  const [selected, setSelected] = useState<string | null>(initialSelected);
  const [presenting, setPresenting] = useState(false);
  const [zoom, setZoom] = useState<number | "fit">(1);
  const listRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // bring the initially selected stage (e.g. the team's own stage) into view inside the horizontally scrolling diagram
  useEffect(() => {
    const box = scrollRef.current;
    const el = initialSelected ? box?.querySelector<SVGGElement>(`[data-stage-id="${initialSelected}"]`) : null;
    if (!box || !el) return;
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    box.scrollLeft += r.left - b.left - b.width / 2 + r.width / 2;
  }, [initialSelected]);

  const stage = data.stages.find((s) => s.id === selected) ?? null;
  const items = stage ? (data.items[stage.id] ?? []) : [];
  const stamp = new Date(data.generatedAt).toISOString().slice(0, 10);
  const title = t("diagram.title");
  const subtitle = t("diagram.subtitle", { date: data.generatedLabel });

  const select = useCallback((id: string) => {
    setSelected((cur) => (cur === id ? cur : id));
    if (!presenting) setTimeout(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  }, [presenting]);

  const enter = async () => {
    setPresenting(true);
    setZoom("fit");
    try { await document.documentElement.requestFullscreen?.(); } catch { /* overlay still works without the Fullscreen API */ }
  };
  const exit = useCallback(async () => {
    setPresenting(false);
    setZoom(1);
    if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch { /* ignore */ } }
  }, []);

  useEffect(() => {
    if (!presenting) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") void exit(); };
    const onFs = () => { if (!document.fullscreenElement) { setPresenting(false); setZoom(1); } };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("fullscreenchange", onFs); document.body.style.overflow = ""; };
  }, [presenting, exit]);

  const downloadSvg = () => {
    if (!svgRef.current) return;
    const { text } = serializeSvg(svgRef.current);
    download(new Blob([text], { type: "image/svg+xml;charset=utf-8" }), `turktech50-process-${stamp}.svg`);
    toast.success(t("actions.downloaded"));
  };
  const downloadPng = async () => {
    if (!svgRef.current) return;
    const { text, width, height } = serializeSvg(svgRef.current);
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
    try {
      await img.decode();
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      if (!blob) throw new Error("png");
      download(blob, `turktech50-process-${stamp}.png`);
      toast.success(t("actions.downloaded"));
    } catch {
      toast.error(t("actions.downloadFailed"));
    }
  };

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 no-print">
      <Button variant="default" onClick={presenting ? exit : enter} data-testid="present-toggle">
        {presenting ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
        {presenting ? t("actions.exitPresent") : t("actions.present")}
      </Button>
      <Button variant="outline" onClick={downloadSvg} data-testid="download-svg"><Download aria-hidden />{t("actions.downloadSvg")}</Button>
      <Button variant="outline" onClick={downloadPng} data-testid="download-png"><ImageDown aria-hidden />{t("actions.downloadPng")}</Button>
      {canManage && !presenting && (
        <Button variant="ghost" nativeButton={false} render={<Link href="/admin/workflow" />}><Settings2 aria-hidden />{t("actions.manage")}</Button>
      )}
    </div>
  );

  const diagram = (
    <ProcessDiagram
      ref={svgRef}
      stages={data.stages}
      streams={data.streams}
      funnel={data.funnel}
      selectedId={selected}
      onSelect={select}
      title={title}
      subtitle={subtitle}
      fit={zoom === "fit"}
      zoom={zoom === "fit" ? 1 : zoom}
      large={presenting}
    />
  );

  if (presenting) {
    // portal to <body>: the app shell creates stacking contexts that would otherwise let the sidebar show through
    return createPortal(
      <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true" aria-label={t("present.label")} data-testid="presentation">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-6 py-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-wide text-primary">{t("eyebrow")}</p>
            <h2 className="text-3xl font-bold tracking-tight text-balance lg:text-4xl">{title}</h2>
            <p className="mt-1 text-lg text-muted-foreground">{t("present.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-lg" aria-label={t("actions.zoomOut")} onClick={() => setZoom((z) => Math.max(0.5, (z === "fit" ? 1 : z) - 0.15))}><ZoomOut aria-hidden /></Button>
            <Button variant="outline" size="lg" onClick={() => setZoom("fit")} aria-pressed={zoom === "fit"}>{t("actions.fit")}</Button>
            <Button variant="outline" size="icon-lg" aria-label={t("actions.zoomIn")} onClick={() => setZoom((z) => Math.min(2.5, (z === "fit" ? 1 : z) + 0.15))}><ZoomIn aria-hidden /></Button>
            <Button size="lg" onClick={exit} data-testid="present-exit"><X aria-hidden />{t("actions.exitPresent")}</Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
          <div className={cn("mx-auto rounded-xl border bg-card shadow-card", zoom === "fit" ? "w-full" : "w-max")}>{diagram}</div>
          {stage && (
            <p className="mx-auto mt-4 max-w-5xl text-center text-xl">
              <span className="font-bold">{stage.name}</span>
              <span className="text-muted-foreground"> — {stage.description || t("list.noDescription")}</span>
              <span className="tabular ml-2 font-semibold text-primary">({stage.count})</span>
            </p>
          )}
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <div className="space-y-6">
      {toolbar}
      <section className="min-w-0 rounded-xl border bg-card shadow-card" aria-labelledby="proc-diagram">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b p-4 sm:p-5">
          <div>
            <h2 id="proc-diagram" className="text-sm font-semibold">{t("diagramCard.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("diagramCard.hint")}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon-sm" aria-label={t("actions.zoomOut")} onClick={() => setZoom((z) => Math.max(0.5, (z === "fit" ? 1 : z) - 0.15))}><ZoomOut aria-hidden /></Button>
            <Button variant="outline" size="sm" onClick={() => setZoom((z) => (z === "fit" ? 1 : "fit"))} aria-pressed={zoom === "fit"}>{zoom === "fit" ? t("actions.actualSize") : t("actions.fit")}</Button>
            <Button variant="outline" size="icon-sm" aria-label={t("actions.zoomIn")} onClick={() => setZoom((z) => Math.min(2.5, (z === "fit" ? 1 : z) + 0.15))}><ZoomIn aria-hidden /></Button>
          </div>
        </div>
        {/* horizontal scroll inside the card on small screens; the page itself never overflows */}
        <div ref={scrollRef} className="overflow-x-auto p-2 sm:p-3" data-testid="diagram-scroll">
          <div className={cn(zoom === "fit" ? "min-w-[1100px]" : "w-max")}>{diagram}</div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-5">
        {/* selected stage list */}
        <section ref={listRef} className="min-w-0 rounded-xl border bg-card shadow-card xl:col-span-3" aria-labelledby="proc-list" aria-live="polite" data-testid="stage-list">
          {!stage ? (
            <div className="p-5">
              <h2 id="proc-list" className="text-sm font-semibold">{t("list.title")}</h2>
              <EmptyState title={t("list.pick")} description={t("list.pickHint")} className="mt-3 py-8" />
            </div>
          ) : (
            <>
              <div className="border-b p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="proc-list" className="text-base font-semibold">{stage.name}</h2>
                  <ToneBadge tone={KIND_TONE[stage.kind]}>{t(`kinds.${stage.kind}`)}</ToneBadge>
                  <ToneBadge tone="neutral" dot={false}>{t(`scopes.${stage.scope}`)}</ToneBadge>
                  {!stage.systemKey && <ToneBadge tone="neutral" dot={false}>{t("diagram.customStage")}</ToneBadge>}
                </div>
                {stage.description && <p className="mt-1.5 text-sm text-pretty text-muted-foreground">{stage.description}</p>}
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("list.responsible")}: <span className="font-medium text-foreground">{stage.roles.map((r) => t(`lanes.${r}`)).join(", ") || "—"}</span>
                  {" · "}
                  <span className="tabular font-medium text-foreground">{t(stage.scope === "PROJECT" ? "list.projects" : "list.applications", { count: stage.count })}</span>
                </p>
              </div>
              {items.length === 0 ? (
                <EmptyState title={t("list.empty")} description={stage.count > 0 ? t("list.hiddenHint") : undefined} className="m-5 py-8" />
              ) : (
                <ul className="max-h-[28rem] divide-y overflow-y-auto" data-testid="stage-items">
                  {items.map((it) => {
                    const body = (
                      <>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            <span className="font-mono text-xs text-primary">{it.code}</span> · {it.title}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">{it.sub}</span>
                        </span>
                        <span className="shrink-0 text-right text-xs text-muted-foreground">
                          <span className="block">{t("list.since")}</span>
                          <span className="tabular block font-medium text-foreground">{it.since}</span>
                        </span>
                        {it.href && <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                      </>
                    );
                    return (
                      <li key={it.id}>
                        {it.href ? (
                          <Link href={it.href} className="flex min-h-12 items-center gap-3 px-5 py-2.5 transition-colors duration-150 hover:bg-muted/50 focus-visible:bg-muted focus-visible:outline-none">{body}</Link>
                        ) : (
                          <div className="flex min-h-12 items-center gap-3 px-5 py-2.5">{body}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </section>

        {/* accessible stage table (also the mobile-friendly overview) */}
        <section className="min-w-0 rounded-xl border bg-card shadow-card xl:col-span-2" aria-labelledby="proc-table">
          <div className="border-b p-5 pb-3">
            <h2 id="proc-table" className="text-sm font-semibold">{t("table.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("table.hint")}</p>
          </div>
          <ol className="divide-y" data-testid="stage-table">
            {data.stages.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelected(s.id)}
                  aria-pressed={selected === s.id}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-3 px-5 py-2 text-left transition-colors duration-150 hover:bg-muted/50 focus-visible:bg-muted focus-visible:outline-none",
                    selected === s.id && "bg-accent/60",
                  )}
                >
                  <span className="tabular w-6 shrink-0 text-xs text-muted-foreground">{i + 1}.</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{s.name}{s.mine && <span className="ml-1.5 text-xs font-semibold text-primary">· {t("diagram.you")}</span>}</span>
                    <span className="block truncate text-xs text-muted-foreground">{t(`scopes.${s.scope}`)} · {s.roles.map((r) => t(`lanes.${r}`)).join(", ")}</span>
                  </span>
                  <ToneBadge tone={KIND_TONE[s.kind]} dot={false} className="hidden sm:inline-flex">{t(`kinds.${s.kind}`)}</ToneBadge>
                  <span className="tabular w-8 shrink-0 text-right text-sm font-semibold">{s.count}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

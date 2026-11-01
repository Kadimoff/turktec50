"use client";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type WeekPoint = { week: number; value: number; current: boolean };

/** Single-series weekly bar chart (program weeks). Values are also available in the table below the chart. */
export function WeekChart({
  data,
  weekLabel,
  valueLabel,
  currentLabel,
  tableLabel,
  unit = "",
  color = "var(--chart-1)",
}: {
  data: WeekPoint[];
  weekLabel: string; // e.g. "H{n}" pattern resolved by parent: "H" prefix
  valueLabel: string;
  currentLabel: string;
  tableLabel: string;
  unit?: string;
  color?: string;
}) {
  const rows = data.map((d) => ({ ...d, name: `${weekLabel}${d.week}` }));
  return (
    <div>
      <div className="h-56 w-full" role="img" aria-label={`${valueLabel}: ${rows.map((r) => `${r.name} ${r.value}${unit}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -18 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: "var(--border)" }} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} width={44} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0]!.payload as (typeof rows)[number];
                return (
                  <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                    <p className="font-semibold">
                      {p.name}
                      {p.current && <span className="ml-1.5 font-normal text-muted-foreground">· {currentLabel}</span>}
                    </p>
                    <p className="mt-0.5">
                      <span className="text-muted-foreground">{valueLabel}: </span>
                      <span className="tabular font-semibold">{p.value}{unit}</span>
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.week} fill={color} fillOpacity={r.current ? 0.5 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-xs no-print">
        <summary className="inline-flex min-h-8 cursor-pointer items-center rounded-md text-muted-foreground hover:text-foreground">{tableLabel}</summary>
        <div className="mt-1 overflow-x-auto">
          <table className="w-full text-left">
            <tbody>
              <tr className="border-b">
                {rows.map((r) => (
                  <th key={r.week} scope="col" className="px-1.5 py-1 font-semibold text-muted-foreground">{r.name}</th>
                ))}
              </tr>
              <tr>
                {rows.map((r) => (
                  <td key={r.week} className="tabular px-1.5 py-1">{r.value}{unit}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

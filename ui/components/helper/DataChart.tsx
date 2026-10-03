"use client";

import { useId, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import { formatValue, type ChartSpec } from "./Chart";

type View = "bar" | "line" | "pie";
type Point = { label: string; value: number };

const PALETTE = [
  "oklch(0.62 0.21 293)", // violet
  "oklch(0.72 0.13 215)", // cyan
  "oklch(0.72 0.15 160)", // emerald
  "oklch(0.8 0.15 80)",   // amber
  "oklch(0.7 0.18 10)",   // rose
  "oklch(0.62 0.18 265)", // indigo
  "oklch(0.75 0.12 235)", // sky
  "oklch(0.68 0.2 330)",  // fuchsia
];
const AXIS = { fill: "var(--muted-foreground)", fontSize: 12 };
const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

type TipProps = { active?: boolean; payload?: { name?: string; value?: number; payload?: Point }[]; label?: string };
function Tip({ active, payload, label, unit }: TipProps & { unit: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-medium">{p.payload?.label ?? label ?? p.name}</p>
      <p className="mt-0.5 tabular-nums text-muted-foreground">{formatValue(Number(p.value), unit)}</p>
    </div>
  );
}

export default function DataChart({ spec }: { spec: ChartSpec }) {
  const reduce = !!useReducedMotion();
  const gid = useId().replace(/:/g, "");
  const [mi, setMi] = useState(0);
  const [view, setView] = useState<View>("bar");

  const metric = spec.metrics[Math.min(mi, spec.metrics.length - 1)];
  const data = useMemo<Point[]>(
    () => spec.rows.flatMap((r) => (typeof r[metric.key] === "number" ? [{ label: String(r.label), value: r[metric.key] as number }] : [])),
    [spec.rows, metric.key],
  );

  const canLine = data.length >= 3;
  const canPie = data.length >= 2 && data.length <= 8 && data.every((d) => d.value > 0);
  const active: View = view === "line" && !canLine ? "bar" : view === "pie" && !canPie ? "bar" : view;
  const total = data.reduce((a, d) => a + d.value, 0);
  const labelW = Math.min(180, Math.max(80, Math.max(...data.map((d) => d.label.length)) * 6.5));
  const views: [View, string, boolean][] = [["bar", "Bars", true], ["line", "Trend", canLine], ["pie", "Share", canPie]];

  return (
    <figure className="mt-5 rounded-xl border border-border bg-muted/40 p-4">
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{spec.title ?? metric.label}</p>
          <p className="text-xs text-muted-foreground">Visualised from the data above</p>
        </div>
        <div role="group" aria-label="Chart type" className="inline-flex rounded-lg border border-border bg-background p-0.5">
          {views.filter(([, , ok]) => ok).map(([v, label]) => (
            <button
              key={v}
              type="button"
              aria-pressed={active === v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none",
                active === v ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </figcaption>

      {spec.metrics.length > 1 && (
        <div role="group" aria-label="Metric" className="mt-3 flex flex-wrap gap-1.5">
          {spec.metrics.map((m, i) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={i === mi}
              onClick={() => setMi(i)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none",
                i === mi ? "border-brand/50 bg-brand-soft text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      <div role="img" aria-label={`${active} chart of ${metric.label}`} className="mt-4 w-full">
        {active === "bar" && (
          <div style={{ height: Math.max(170, data.length * 36 + 24) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 4, right: 56, top: 4, bottom: 4 }}>
                <defs>
                  <linearGradient id={`${gid}-g`} x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor={PALETTE[0]} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={PALETTE[1]} stopOpacity={0.95} />
                  </linearGradient>
                </defs>
                <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 4" />
                <XAxis type="number" hide domain={[0, "dataMax"]} />
                <YAxis type="category" dataKey="label" width={labelW} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(s: string) => trunc(s, 26)} />
                <Tooltip cursor={{ fill: "var(--accent)", opacity: 0.5 }} content={<Tip unit={metric.unit} />} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={20} fill={`url(#${gid}-g)`} isAnimationActive={!reduce} animationDuration={700}>
                  <LabelList dataKey="value" position="right" formatter={(v) => formatValue(Number(v), metric.unit)} style={AXIS} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {active === "line" && (
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ left: 0, right: 16, top: 12, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
                <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(s: string) => trunc(s, 12)} interval="preserveStartEnd" />
                <YAxis width={52} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => formatValue(Number(v))} />
                <Tooltip content={<Tip unit={metric.unit} />} />
                <Line type="monotone" dataKey="value" stroke={PALETTE[0]} strokeWidth={2.5} dot={{ r: 3.5, fill: PALETTE[0], strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={!reduce} animationDuration={800} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {active === "pie" && (
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
            <div className="h-52 w-52 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<Tip unit={metric.unit} />} />
                  <Pie data={data} dataKey="value" nameKey="label" innerRadius={58} outerRadius={92} paddingAngle={2} stroke="none" isAnimationActive={!reduce} animationDuration={700}>
                    {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="w-full min-w-0 flex-1 space-y-1.5 text-sm">
              {data.map((d, i) => (
                <li key={d.label} className="flex items-center gap-2.5">
                  <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                  <span className="min-w-0 flex-1 truncate">{d.label}</span>
                  <span className="tabular-nums text-muted-foreground">{((d.value / total) * 100).toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <ul className="sr-only">
        {data.map((d) => <li key={d.label}>{d.label}: {formatValue(d.value, metric.unit)}</li>)}
      </ul>
    </figure>
  );
}
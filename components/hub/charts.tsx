"use client";

import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from "recharts";

/**
 * Interactive charts for the Hub console. Built on Recharts (the same engine
 * shadcn/ui charts use) so hovering reveals per-point stats. Themed with the
 * WHRD brand tokens for a calm, premium feel.
 */

const BRAND = {
  purple: "#734e9e",
  cyan: "#4bb6e2",
  magenta: "#ce2087",
  cyanDeep: "#12718f",
};

interface Point { label: string; value: number }

function TooltipCard({ active, payload, label, suffix }: { active?: boolean; payload?: { value: number }[]; label?: string; suffix?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface/95 backdrop-blur px-3 py-2 shadow-lg">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-sm font-black text-ink">{payload[0].value}{suffix ? ` ${suffix}` : ""}</p>
    </div>
  );
}

export function TrendArea({ data, color = BRAND.purple, suffix, height = 210 }: { data: Point[]; color?: string; suffix?: string; height?: number }) {
  const id = `grad-${color.replace("#", "")}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 6, left: 6, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.32} />
            <stop offset="90%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke="var(--line)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} tickLine={false} axisLine={false} minTickGap={40} />
        <YAxis hide domain={[0, "auto"]} />
        <Tooltip content={<TooltipCard suffix={suffix} />} cursor={{ stroke: color, strokeOpacity: 0.3, strokeWidth: 1.5 }} />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.6} fill={`url(#${id})`} dot={false} activeDot={{ r: 5, fill: color, stroke: "var(--surface)", strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ValueBars({ data, color = BRAND.cyan, suffix, height = 260, horizontal = false }: { data: Point[]; color?: string; suffix?: string; height?: number; horizontal?: boolean }) {
  const palette = [BRAND.purple, BRAND.cyan, BRAND.magenta, BRAND.cyanDeep];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 12, left: horizontal ? 8 : -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: "var(--ink)" }} tickLine={false} axisLine={false} width={128} />
          </>
        ) : (
          <>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={54} />
            <YAxis width={44} tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} allowDecimals={false} />
          </>
        )}
        <Tooltip content={<TooltipCard suffix={suffix} />} cursor={{ fill: color, fillOpacity: 0.06 }} />
        <Bar dataKey="value" radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]} maxBarSize={horizontal ? 22 : 44}>
          {data.map((_, i) => (
            <Cell key={i} fill={horizontal ? palette[i % palette.length] : color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Shared chart chrome for the Progress charts: clean y scales, tooltip card, legend keys.
import { round } from "@strike/core";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.ts";

export const SURFACE = "var(--color-surface)";
export const ACCENT = "var(--color-accent)";
export const INK_3 = "var(--color-ink-3)";
export const GRID = "var(--color-line)";
export const CROSSHAIR = "var(--color-line-strong)";

export const axisTick = { fill: INK_3, fontSize: 11 };

/** Recessive axis text with tabular figures. Apply to the chart wrapper. */
export const chartFrameClass =
  "[&_.recharts-cartesian-axis-tick-value]:tnum [&_.recharts-surface]:overflow-visible [&_.recharts-wrapper]:outline-none";

function niceStep(raw: number): number {
  if (!(raw > 0)) return 1;
  const exp = 10 ** Math.floor(Math.log10(raw));
  const f = raw / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * exp;
}

/** Decimals needed to print ticks on this step without rounding them. */
export function stepDecimals(step: number): number {
  for (let d = 0; d < 3; d++) if (Math.abs(Math.round(step * 10 ** d) - step * 10 ** d) < 1e-9) return d;
  return 3;
}

/**
 * A padded y domain snapped to a clean 1 / 2 / 5 step, never starting at zero for no reason.
 * `minSpan` keeps flat series from being blown up into noise.
 */
export function niceScale(values: number[], { minSpan, target = 4, pad = 0.12 }: { minSpan: number; target?: number; pad?: number }) {
  const finite = values.filter((v) => Number.isFinite(v));
  const lo0 = finite.length ? Math.min(...finite) : 0;
  const hi0 = finite.length ? Math.max(...finite) : 1;
  const span = hi0 - lo0;
  const padding = Math.max(span * pad, (minSpan - span) / 2, 0);
  const lo = lo0 - padding;
  const hi = hi0 + padding;
  const step = niceStep((hi - lo) / target);
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 1000; v += step) ticks.push(round(v, 4));
  return { domain: [round(start, 4), round(end, 4)] as [number, number], ticks, step };
}

/** Rough width for a y axis whose ticks are formatted strings. */
export const yAxisWidth = (labels: string[]) => Math.max(28, Math.max(...labels.map((l) => l.length)) * 6.6 + 10);

export function LineKey({ className }: { className?: string }) {
  return <span aria-hidden className={cn("inline-block h-[2px] w-3.5 shrink-0 rounded-full bg-accent", className)} />;
}

export function DotKey({ className }: { className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full bg-ink-3", className)} />;
}

export function HairlineKey() {
  return <span aria-hidden className="inline-block h-px w-3.5 shrink-0 bg-ink-3/60" />;
}

export function Legend({ items, className }: { items: { key: ReactNode; label: string }[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2", className)} aria-hidden>
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          {i.key}
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export interface TipRow {
  key: ReactNode;
  value: string;
  label: string;
}

/** The app's tooltip: value leads, series name follows. */
export function TooltipCard({ title, rows }: { title: string; rows: TipRow[] }) {
  return (
    <div className="pointer-events-none min-w-36 rounded-xl border border-line-strong bg-raised px-3 py-2.5 shadow-[0_8px_28px_rgb(0_0_0/0.4)]">
      <p className="text-xs text-ink-3">{title}</p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2 text-[13px]">
            {r.key}
            <span className="tnum font-semibold text-ink">{r.value}</span>
            <span className="text-ink-3">{r.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { round, type Units, type WeightPoint } from "@strike/core";
import { useMemo, type ReactNode } from "react";
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "../../lib/cn.ts";
import { bodyUnit, fmtDate, fmtDateShort, fmtNum } from "../../lib/format.ts";
import {
  ACCENT,
  axisTick,
  chartFrameClass,
  CROSSHAIR,
  DotKey,
  GRID,
  HairlineKey,
  INK_3,
  Legend,
  LineKey,
  niceScale,
  stepDecimals,
  SURFACE,
  TooltipCard,
  yAxisWidth,
} from "./chartKit.tsx";
import { fixed, kgToDisplay } from "./util.ts";

interface Row {
  date: string;
  /** Weigh-in in the display unit, null on days without one. */
  w: number | null;
  /** Trend in the display unit. */
  t: number;
}

interface WeightChartProps {
  points: WeightPoint[];
  units: Units;
  goalKg: number | null;
  /** Accessible summary of what the chart shows. */
  summary: string;
  className?: string;
  height?: number;
  /** Controls beside the legend. */
  toolbar?: ReactNode;
  /** Controls under the plot. */
  footer?: ReactNode;
}

/** Daily weigh-ins as quiet dots under a smoothed trend line. */
export function WeightChart({ points, units, goalKg, summary, className, height = 240, toolbar, footer }: WeightChartProps) {
  const unit = bodyUnit(units);

  const rows = useMemo<Row[]>(
    () =>
      points.map((p) => ({
        date: p.date,
        w: p.weightKg == null ? null : round(kgToDisplay(p.weightKg, units), 1),
        t: round(kgToDisplay(p.trendKg, units), 2),
      })),
    [points, units],
  );

  const { scale, goal } = useMemo(() => {
    const values = rows.flatMap((r) => (r.w == null ? [r.t] : [r.w, r.t]));
    const minSpan = units === "imperial" ? 4 : 2;
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const span = Math.max(hi - lo, minSpan);
    const g = goalKg == null ? null : kgToDisplay(goalKg, units);
    // Only draw the goal when it sits near the data; a far-off goal would flatten the trend.
    const near = g != null && g >= lo - span * 0.75 && g <= hi + span * 0.75;
    return { scale: niceScale(near ? [...values, g] : values, { minSpan }), goal: near ? g : null };
  }, [rows, goalKg, units]);

  const tickDecimals = stepDecimals(scale.step);
  const tickLabel = (v: number) => fixed(v, tickDecimals);
  const dense = rows.length > 120;
  const dotR = dense ? 3 : 4;
  const ringW = dense ? 1.5 : 2;

  return (
    <figure className={cn("min-w-0", className)}>
      <figcaption className="sr-only">{summary}</figcaption>
      <div className="mb-3 flex min-h-7 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Legend
          items={[
            { key: <DotKey />, label: "Weigh-in" },
            { key: <LineKey />, label: "Trend" },
            ...(goal != null ? [{ key: <HairlineKey />, label: "Goal" }] : []),
          ]}
        />
        {toolbar}
      </div>
      <div className={chartFrameClass} style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 6, right: 6, bottom: 0, left: 0 }} accessibilityLayer={false}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => fmtDateShort(d)}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              minTickGap={28}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={scale.domain}
              ticks={scale.ticks}
              tickFormatter={tickLabel}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              tickMargin={6}
              width={yAxisWidth(scale.ticks.map(tickLabel))}
              allowDataOverflow
            />
            {goal != null && (
              <ReferenceLine
                y={goal}
                stroke={INK_3}
                strokeOpacity={0.55}
                strokeWidth={1}
                label={{ value: `Goal ${fmtNum(goal, 1)}`, position: "insideBottomRight", fill: INK_3, fontSize: 11, offset: 6 }}
              />
            )}
            <Tooltip
              cursor={{ stroke: CROSSHAIR, strokeWidth: 1 }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as Row | undefined;
                if (!active || !row) return null;
                return (
                  <TooltipCard
                    title={fmtDate(row.date)}
                    rows={[
                      ...(row.w != null ? [{ key: <DotKey />, value: `${fixed(row.w, 1)} ${unit}`, label: "Weigh-in" }] : []),
                      { key: <LineKey />, value: `${fixed(row.t, 1)} ${unit}`, label: "Trend" },
                    ]}
                  />
                );
              }}
            />
            <Line
              type="linear"
              dataKey="w"
              name="Weigh-in"
              stroke="none"
              dot={{ r: dotR, fill: INK_3, stroke: SURFACE, strokeWidth: ringW }}
              activeDot={{ r: dotR + 1, fill: "var(--color-ink-2)", stroke: SURFACE, strokeWidth: 2 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="t"
              name="Trend"
              zIndex={700}
              stroke={ACCENT}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={{ r: 5, fill: ACCENT, stroke: SURFACE, strokeWidth: 2 }}
              animationDuration={900}
              animationEasing="ease-out"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {footer && <div className="mt-4">{footer}</div>}
    </figure>
  );
}

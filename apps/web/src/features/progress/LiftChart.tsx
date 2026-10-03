import type { ExerciseHistoryResponse } from "@strike/core";
import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "../../lib/cn.ts";
import { fmtDate, fmtDateShort, fmtLoad } from "../../lib/format.ts";
import { ACCENT, axisTick, chartFrameClass, CROSSHAIR, GRID, LineKey, niceScale, stepDecimals, SURFACE, TooltipCard, yAxisWidth } from "./chartKit.tsx";
import { fixed } from "./util.ts";

type HistoryPoint = ExerciseHistoryResponse["points"][number];

interface Row {
  date: string;
  v: number | null;
  weight: number | null;
  reps: number;
}

interface LiftChartProps {
  points: HistoryPoint[];
  /** e1RM for loaded lifts; best reps for bodyweight-only lifts. */
  mode: "e1rm" | "reps";
  unit: "lb" | "kg";
  summary: string;
  className?: string;
  height?: number;
}

/** Session-over-session estimated 1RM (or best reps) for one exercise. */
export function LiftChart({ points, mode, unit, summary, className, height = 220 }: LiftChartProps) {
  const rows = useMemo<Row[]>(
    () =>
      points.map((p) => ({
        date: p.date,
        v: mode === "e1rm" ? p.e1rm : p.bestReps,
        weight: p.bestWeight,
        reps: p.bestReps,
      })),
    [points, mode],
  );

  const scale = useMemo(() => {
    const values = rows.map((r) => r.v).filter((v): v is number => v != null);
    const top = values.length ? Math.max(...values) : 10;
    return niceScale(values, { minSpan: mode === "e1rm" ? Math.max(5, top * 0.12) : 4, pad: 0.15 });
  }, [rows, mode]);

  const decimals = stepDecimals(scale.step);
  const tickLabel = (v: number) => fixed(v, decimals);

  return (
    <figure className={cn("min-w-0", className)}>
      <figcaption className="sr-only">{summary}</figcaption>
      <div className={chartFrameClass} style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 14, bottom: 0, left: 0 }} accessibilityLayer={false}>
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
              padding={{ left: 12, right: 12 }}
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
            <Tooltip
              cursor={{ stroke: CROSSHAIR, strokeWidth: 1 }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as Row | undefined;
                if (!active || !row) return null;
                const best = row.weight == null ? `${row.reps} reps` : `${fmtLoad(row.weight)} ${unit} × ${row.reps}`;
                return (
                  <TooltipCard
                    title={fmtDate(row.date)}
                    rows={
                      mode === "e1rm"
                        ? [
                            { key: <LineKey />, value: row.v == null ? "-" : `${fmtLoad(row.v)} ${unit}`, label: "e1RM" },
                            { key: <span className="inline-block w-3.5" aria-hidden />, value: best, label: "Best set" },
                          ]
                        : [{ key: <LineKey />, value: `${row.reps}`, label: "Best reps" }]
                    }
                  />
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="v"
              stroke={ACCENT}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              connectNulls
              dot={{ r: 4, fill: ACCENT, stroke: SURFACE, strokeWidth: 2 }}
              activeDot={{ r: 5.5, fill: ACCENT, stroke: SURFACE, strokeWidth: 2 }}
              animationDuration={800}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

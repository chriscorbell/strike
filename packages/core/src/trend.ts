import { addDays, daysBetween } from "./dates.ts";

export interface WeighIn {
  date: string;
  weightKg: number;
}

export interface TrendPoint {
  date: string;
  /** Null on days without a weigh-in. */
  weightKg: number | null;
  trendKg: number;
}

/**
 * Exponentially smoothed weight, one point per calendar day from the first weigh-in to `through`.
 * Each weigh-in moves the trend 10% of the way toward it; days without one carry the trend forward.
 */
export function trendSeries(entries: WeighIn[], through: string, alpha = 0.1): TrendPoint[] {
  if (entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const byDate = new Map(sorted.map((e) => [e.date, e.weightKg]));
  const first = sorted[0]!;
  const out: TrendPoint[] = [];
  let trend = first.weightKg;
  const span = daysBetween(first.date, through);
  for (let i = 0; i <= span; i++) {
    const date = addDays(first.date, i);
    const w = byDate.get(date) ?? null;
    if (w != null && i > 0) trend = trend + alpha * (w - trend);
    out.push({ date, weightKg: w, trendKg: trend });
  }
  return out;
}

/** Least-squares slope of the trend over the last `days` days, in kg per week. */
export function trendRateKgPerWeek(series: TrendPoint[], days = 14): number | null {
  const window = series.slice(-days);
  if (window.length < 7) return null;
  const n = window.length;
  const xs = window.map((_, i) => i);
  const ys = window.map((p) => p.trendKg);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  return den === 0 ? 0 : (num / den) * 7;
}

export function latestTrend(series: TrendPoint[]): number | null {
  return series.length ? series[series.length - 1]!.trendKg : null;
}

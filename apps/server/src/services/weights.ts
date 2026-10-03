import { asc, eq } from "drizzle-orm";
import { addDays, latestTrend, targetRateKgPerWeek, trendRateKgPerWeek, trendSeries, type Profile, type WeightsResponse } from "@strike/core";
import { db, schema } from "../db/index.ts";

export function allWeighIns() {
  return db.select().from(schema.weights).orderBy(asc(schema.weights.date)).all();
}

/**
 * One weigh-in per day. A manual entry always wins; an Apple Health reading only fills a day that has
 * no manual entry.
 */
export function upsertWeight(date: string, weightKg: number, source: "manual" | "healthkit"): boolean {
  const existing = db.select().from(schema.weights).where(eq(schema.weights.date, date)).get();
  if (existing && existing.source === "manual" && source === "healthkit") return false;
  const kg = Math.round(weightKg * 100) / 100;
  if (existing && existing.weightKg === kg && existing.source === source) return false;
  db.insert(schema.weights)
    .values({ date, weightKg: kg, source, updatedAt: new Date().toISOString() })
    .onConflictDoUpdate({ target: schema.weights.date, set: { weightKg: kg, source, updatedAt: new Date().toISOString() } })
    .run();
  return true;
}

export function deleteWeight(date: string) {
  db.delete(schema.weights).where(eq(schema.weights.date, date)).run();
}

export function weightOn(date: string): number | null {
  return db.select().from(schema.weights).where(eq(schema.weights.date, date)).get()?.weightKg ?? null;
}

export function trendThrough(today: string) {
  const entries = allWeighIns();
  const series = trendSeries(entries, today);
  return { entries, series, latest: latestTrend(series), rate: trendRateKgPerWeek(series) };
}

/** Best current body-weight estimate: the trend, else the latest weigh-in. */
export function currentWeightKg(today: string): number | null {
  const { latest, entries } = trendThrough(today);
  return latest ?? entries[entries.length - 1]?.weightKg ?? null;
}

export function weightsView(profile: Profile, today: string, days: number): WeightsResponse {
  const { series, latest, rate } = trendThrough(today);
  const from = addDays(today, -days + 1);
  return {
    points: series.filter((p) => p.date >= from),
    rateKgPerWeek: rate,
    targetRateKgPerWeek: targetRateKgPerWeek(profile.goal, latest ?? 0),
    latestTrendKg: latest,
  };
}

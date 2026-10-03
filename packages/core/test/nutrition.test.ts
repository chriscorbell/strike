import { describe, expect, it } from "vitest";
import { applyAdjustment, initialTargets, navyBodyFat, planMeals, trendRateKgPerWeek, trendSeries, weeklyAdjustment, addDays } from "../src/index.ts";
import { profile } from "./fixtures.ts";

const stats = { weightKg: 90, heightCm: 180, age: 32, sex: "male" as const, bodyFatPercent: null };

describe("targets", () => {
  const t = initialTargets({ stats, profile, effectiveDate: "2026-10-04" });
  it("sets a deficit for fat loss with more food on training days", () => {
    expect(t.rest.kcal).toBeLessThan(t.maintenanceKcal.rest);
    expect(t.training.kcal).toBeGreaterThan(t.rest.kcal);
    expect(t.training.proteinG).toBe(t.rest.proteinG);
    expect(t.training.carbsG).toBeGreaterThan(t.rest.carbsG);
  });
  it("keeps macros consistent with calories", () => {
    for (const m of [t.rest, t.training]) expect(m.kcal).toBe(m.proteinG * 4 + m.carbsG * 4 + m.fatG * 9);
  });
  it("holds until there are two weeks of data", () => {
    expect(weeklyAdjustment({ current: t, stats, rateKgPerWeek: 0, targetRateKgPerWeek: -0.45, daysOfData: 7, recentWeighIns: 7 }).deltaKcal).toBe(0);
  });
  it("cuts calories when loss stalls, within limits", () => {
    const a = weeklyAdjustment({ current: t, stats, rateKgPerWeek: 0, targetRateKgPerWeek: -0.45, daysOfData: 21, recentWeighIns: 6 });
    expect(a.deltaKcal).toBeLessThan(0);
    expect(a.deltaKcal).toBeGreaterThanOrEqual(-250);
    const next = applyAdjustment(t, a.deltaKcal, stats, "2026-10-11", a.reason);
    expect(next.rest.proteinG).toBe(t.rest.proteinG);
    expect(next.rest.carbsG).toBeLessThan(t.rest.carbsG);
  });
  it("leaves calories alone when on pace", () => {
    expect(weeklyAdjustment({ current: t, stats, rateKgPerWeek: -0.42, targetRateKgPerWeek: -0.45, daysOfData: 21, recentWeighIns: 6 }).deltaKcal).toBe(0);
  });
});

describe("trend", () => {
  it("measures a steady loss", () => {
    const entries = Array.from({ length: 42 }, (_, i) => ({ date: addDays("2026-08-01", i), weightKg: 90 - i * (0.5 / 7) }));
    const series = trendSeries(entries, addDays("2026-08-01", 41));
    const rate = trendRateKgPerWeek(series)!;
    expect(rate).toBeLessThan(-0.4);
    expect(rate).toBeGreaterThan(-0.6);
  });
});

describe("navy body fat", () => {
  it("is plausible", () => {
    const bf = navyBodyFat("male", 180, 90, 38, null)!;
    expect(bf).toBeGreaterThan(15);
    expect(bf).toBeLessThan(25);
  });
});

describe("meal timing", () => {
  const targets = { kcal: 2400, proteinG: 180, carbsG: 250, fatG: 70 };
  it("puts meals around an evening workout", () => {
    const meals = planMeals({ wakeTime: "07:00", sleepTime: "23:00", mealsPerDay: 4, workout: { start: "17:30", minutes: 60 }, targets });
    expect(meals).toHaveLength(4);
    expect(meals.map((m) => m.role)).toContain("pre_workout");
    expect(meals.map((m) => m.role)).toContain("post_workout");
    const pre = meals.find((m) => m.role === "pre_workout")!;
    const post = meals.find((m) => m.role === "post_workout")!;
    expect(pre.time).toBe("16:00");
    expect(post.time).toBe("19:15");
    expect(post.targets.carbsG).toBeGreaterThan(meals[0]!.targets.carbsG);
    const times = meals.map((m) => m.time);
    expect([...times].sort()).toEqual(times);
  });
  it("handles an early workout", () => {
    const meals = planMeals({ wakeTime: "06:00", sleepTime: "22:00", mealsPerDay: 4, workout: { start: "06:45", minutes: 60 }, targets });
    expect(meals).toHaveLength(4);
    expect(meals[0]!.role).toBe("pre_workout");
    expect(meals[1]!.role).toBe("post_workout");
  });
  it("spreads rest-day meals", () => {
    const meals = planMeals({ wakeTime: "07:00", sleepTime: "23:00", mealsPerDay: 5, workout: null, targets });
    expect(meals).toHaveLength(5);
    expect(meals[0]!.time).toBe("07:45");
    expect(meals[4]!.time).toBe("21:30");
  });
  it("sums close to the daily targets", () => {
    const meals = planMeals({ wakeTime: "07:00", sleepTime: "23:00", mealsPerDay: 4, workout: { start: "12:00", minutes: 60 }, targets });
    const p = meals.reduce((a, m) => a + m.targets.proteinG, 0);
    expect(Math.abs(p - 180)).toBeLessThanOrEqual(10);
  });
});

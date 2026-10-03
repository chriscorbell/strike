import { describe, expect, it } from "vitest";
import { alternatives, fallbackMeso, getExercise, isAvailable, validateMeso } from "../src/index.ts";
import { profile } from "./fixtures.ts";

describe("fallback meso", () => {
  it("builds an upper/lower plan from available equipment", () => {
    const plan = fallbackMeso(profile, 90);
    expect(plan.days).toHaveLength(4);
    for (const day of plan.days) {
      expect(day.exercises.length).toBeGreaterThanOrEqual(4);
      for (const e of day.exercises) expect(isAvailable(getExercise(e.exerciseId)!, profile.equipment[day.location])).toBe(true);
    }
  });
  it("works for a home-only lifter with just dumbbells", () => {
    const home = { ...profile, training: { ...profile.training, defaultLocation: "home" as const, days: [1, 3, 5] }, equipment: { ...profile.equipment, gym: { ...profile.equipment.gym, available: false } } };
    const plan = fallbackMeso(home, 90);
    expect(plan.days).toHaveLength(3);
    expect(plan.days.every((d) => d.location === "home")).toBe(true);
    expect(plan.days.every((d) => d.exercises.length >= 4)).toBe(true);
  });
});

describe("validation", () => {
  it("swaps unavailable exercises and drops unknown ones", () => {
    const plan = fallbackMeso(profile, 90);
    plan.days[0]!.exercises[0] = { exerciseId: "barbell_bench_press", sets: 3, repMin: 6, repMax: 10, startWeight: 135, notes: "" };
    plan.days[0]!.exercises.push({ exerciseId: "made_up", sets: 3, repMin: 8, repMax: 12, startWeight: null, notes: "" });
    const { plan: fixed, issues } = validateMeso(plan, profile, 90);
    expect(fixed.days[0]!.exercises.some((e) => e.exerciseId === "barbell_bench_press")).toBe(false);
    expect(issues.length).toBeGreaterThanOrEqual(2);
  });
  it("finds same-pattern alternatives first", () => {
    const alts = alternatives("db_bench_press", profile.equipment.gym);
    expect(alts[0]!.pattern).toBe("horizontal_push");
  });
});

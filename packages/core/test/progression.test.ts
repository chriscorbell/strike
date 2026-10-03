import { describe, expect, it } from "vitest";
import { e1rm, prescribe, repsAt, rirForWeek, type PrescribeInput } from "../src/index.ts";

const dumbbells = Array.from({ length: 20 }, (_, i) => 5 + i * 2.5); // 5..52.5
const base: Omit<PrescribeInput, "history"> = {
  exercise: { loadType: "dumbbell", repMin: 8, repMax: 12 },
  repMin: 8,
  repMax: 12,
  sets: 3,
  targetRir: 2,
  isDeload: false,
  loads: dumbbells,
  startWeight: 40,
  experience: "intermediate",
  unit: "lb",
};

describe("prescribe", () => {
  it("uses the starting weight the first time", () => {
    const p = prescribe({ ...base, history: [] });
    expect(p.weight).toBe(40);
    expect(p.reps[0]).toBe(10);
  });

  it("goes up when the lifter beats the target", () => {
    const p = prescribe({
      ...base,
      targetRir: 2,
      history: [{ date: "2026-10-01", targetRir: 2, targetReps: 10, weight: 40, sets: [{ weight: 40, reps: 14, rir: 2 }, { weight: 40, reps: 13, rir: 2 }] }],
    });
    expect(p.weight).toBeGreaterThan(40);
    expect(p.reps[0]).toBeGreaterThanOrEqual(8);
    expect(p.note).toMatch(/^Up/);
  });

  it("goes down when the lifter falls well short", () => {
    const p = prescribe({
      ...base,
      history: [{ date: "2026-10-01", targetRir: 2, targetReps: 10, weight: 40, sets: [{ weight: 40, reps: 5, rir: 0 }] }],
    });
    expect(p.weight).toBeLessThan(40);
    expect(p.note).toMatch(/^Down/);
  });

  it("adds a rep at the same weight when the target RIR drops", () => {
    const p = prescribe({
      ...base,
      targetRir: 1,
      history: [{ date: "2026-10-01", targetRir: 2, targetReps: 10, weight: 40, sets: [{ weight: 40, reps: 10, rir: 2 }] }],
    });
    expect(p.weight).toBe(40);
    expect(p.reps[0]).toBe(11);
  });

  it("asks for one more rep when the estimate rounds away a small gain", () => {
    const p = prescribe({
      ...base,
      targetRir: 2,
      history: [{ date: "2026-10-01", targetRir: 2, targetReps: 10, weight: 40, sets: [{ weight: 40, reps: 10, rir: 2 }] }],
    });
    expect(p.weight).toBe(40);
    expect(p.reps[0]).toBe(11);
  });

  it("flags maxed-out dumbbells", () => {
    const p = prescribe({
      ...base,
      history: [{ date: "2026-10-01", targetRir: 2, targetReps: 10, weight: 52.5, sets: [{ weight: 52.5, reps: 18, rir: 2 }] }],
    });
    expect(p.weight).toBe(52.5);
    expect(p.maxedOut).toBe(true);
  });

  it("progresses bodyweight work by reps", () => {
    const p = prescribe({
      ...base,
      exercise: { loadType: "bodyweight", repMin: 5, repMax: 12 },
      repMin: 5,
      repMax: 12,
      loads: [],
      startWeight: null,
      targetRir: 1,
      history: [{ date: "2026-10-01", targetRir: 2, targetReps: 7, weight: null, sets: [{ weight: null, reps: 8, rir: 2 }] }],
    });
    expect(p.weight).toBeNull();
    expect(p.reps[0]).toBe(10);
  });

  it("lightens the deload", () => {
    const p = prescribe({
      ...base,
      isDeload: true,
      targetRir: 4,
      sets: 2,
      history: [{ date: "2026-10-01", targetRir: 0, targetReps: 10, weight: 40, sets: [{ weight: 40, reps: 10, rir: 0 }] }],
    });
    expect(p.weight).toBeLessThan(40);
    expect(p.reps).toHaveLength(2);
  });
});

describe("helpers", () => {
  it("round-trips e1rm and repsAt", () => {
    const one = e1rm(100, 10, 2);
    expect(repsAt(one, 100, 2)).toBe(10);
  });
  it("ramps RIR from 3 to 0 then deloads", () => {
    expect([0, 1, 2, 3, 4].map((w) => rirForWeek(w, 4))).toEqual([3, 2, 1, 0, 4]);
    expect([0, 1, 2, 3, 4].map((w) => rirForWeek(w, 5))).toEqual([3, 2, 2, 1, 0]);
  });
});

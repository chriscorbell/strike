import fs from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CompleteSessionResponse, MesoOverview, OnboardingRequest, Session, StateResponse, TodayResponse, WeightsResponse } from "@strike/core";
import { createApp } from "../src/app.ts";
import { registerCoachHandlers } from "../src/coach/tasks.ts";
import { closeDb, runMigrations } from "../src/db/index.ts";
import { env } from "../src/env.ts";
import { pendingJobs, startWorker, stopWorker } from "../src/services/jobs.ts";

const app = createApp();
const auth = { authorization: "Bearer test-token", "content-type": "application/json" };

async function call<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = auth): Promise<{ status: number; body: T }> {
  const res = await app.request(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: (await res.json()) as T };
}

async function idle() {
  for (let i = 0; i < 100 && pendingJobs().length; i++) await new Promise((r) => setTimeout(r, 20));
}

const onboarding: OnboardingRequest = {
  weightKg: 85,
  measurements: { waistCm: 90, neckCm: 38, hipsCm: null, chestCm: null, armCm: null, thighCm: null, bodyFatPercent: null },
  profile: {
    name: "Test",
    sex: "male",
    birthDate: "1990-01-01",
    heightCm: 178,
    units: "imperial",
    timezone: "America/New_York",
    activityLevel: "light",
    goal: { type: "lose", ratePercentPerWeek: 0.5, targetWeightKg: null },
    training: { experience: "intermediate", days: [0, 1, 2, 3, 4, 5, 6].slice(0, 3), sessionMinutes: 45, workoutTime: "18:00", defaultLocation: "home", focusMuscles: [], limitations: "" },
    equipment: {
      home: { available: true, dumbbells: { kind: "adjustable", min: 5, max: 50, step: 5 }, items: ["bench_flat"], machineStep: 10, notes: "" },
      gym: { available: false, dumbbells: { kind: "none" }, items: [], machineStep: 10, notes: "" },
    },
    schedule: { wakeTime: "06:30", sleepTime: "22:30", checkInDay: 0 },
    nutrition: { mealsPerDay: 4, dietStyle: "omnivore", allergies: [], avoidFoods: "", favoriteFoods: "", cookingTime: "minimal", weeklyBudgetUsd: 70, grabAndGo: ["Chipotle"], kitchen: ["microwave"] },
  },
};

beforeAll(() => {
  runMigrations();
  registerCoachHandlers();
  startWorker();
});

afterAll(() => {
  stopWorker();
  closeDb();
  fs.rmSync(env.dataDir, { recursive: true, force: true });
});

describe("api", () => {
  it("requires the token", async () => {
    expect((await call("GET", "/api/state", undefined, {})).status).toBe(401);
    expect((await call("GET", "/api/health", undefined, {})).status).toBe(200);
  });

  it("onboards and builds a plan", async () => {
    const res = await call<StateResponse>("POST", "/api/onboarding", onboarding);
    expect(res.status).toBe(200);
    expect(res.body.onboarded).toBe(true);
    expect(res.body.targets?.rest.kcal).toBeGreaterThan(1500);
    await idle();
    const meso = await call<MesoOverview>("GET", "/api/meso");
    expect(meso.body.days).toHaveLength(3);
    expect(meso.body.days.every((d) => d.location === "home")).toBe(true);
  });

  it("rejects bad input", async () => {
    const res = await call<{ error: string }>("POST", "/api/weights", { date: "yesterday", weightKg: 80, source: "manual" });
    expect(res.status).toBe(400);
  });

  it("shows a day with meals and options", async () => {
    const { body } = await call<TodayResponse>("POST", `/api/days/${(await call<TodayResponse>("GET", "/api/today")).body.date}/train`);
    expect(body.dayType).toBe("training");
    const meals = body.timeline.filter((i) => i.kind === "meal");
    expect(meals).toHaveLength(4);
    expect(meals.every((m) => m.kind === "meal" && m.options.some((o) => o.kind === "home") && m.options.some((o) => o.kind === "out"))).toBe(true);
    expect(body.timeline.some((i) => i.kind === "workout")).toBe(true);
  });

  it("logs a workout and progresses the next one", async () => {
    const today = (await call<TodayResponse>("GET", "/api/today")).body;
    let s = (await call<Session>("POST", `/api/sessions/${today.nextSession!.id}/start`, {})).body;
    expect(s.status).toBe("in_progress");
    const first = s.exercises[0]!;
    for (const set of first.sets) {
      s = (await call<Session>("POST", `/api/sessions/${s.id}/sets`, { sessionExerciseId: first.id, setIndex: set.index, weight: set.targetWeight, reps: set.targetReps + 3, rir: set.targetRir })).body;
    }
    expect(s.exercises[0]!.sets.every((x) => x.log)).toBe(true);
    const done = await call<CompleteSessionResponse>("POST", `/api/sessions/${s.id}/complete`);
    expect(done.status).toBe(200);
    expect(done.body.summary.setCount).toBe(first.sets.length);
    const history = await call<{ points: unknown[] }>("GET", `/api/exercises/${first.exerciseId}/history`);
    expect(history.body.points).toHaveLength(1);
  });

  it("logs meals against the plan", async () => {
    const today = (await call<TodayResponse>("GET", "/api/today")).body;
    const meal = today.timeline.find((i) => i.kind === "meal")!;
    if (meal.kind !== "meal") throw new Error("expected a meal");
    const log = await call<{ id: number }>("POST", "/api/meals/log", { date: today.date, slotIndex: meal.slotIndex, optionId: meal.options[0]!.id, custom: null, status: "eaten" });
    expect(log.status).toBe(200);
    const after = (await call<TodayResponse>("GET", "/api/today")).body;
    expect(after.consumed.kcal).toBeGreaterThan(0);
  });

  it("keeps manual weigh-ins over Apple Health", async () => {
    await call("POST", "/api/weights", { date: "2026-01-02", weightKg: 84, source: "manual" });
    const batch = await call<{ imported: number }>("POST", "/api/weights/batch", { source: "healthkit", entries: [{ date: "2026-01-02", weightKg: 90 }, { date: "2026-01-03", weightKg: 84.2 }] });
    expect(batch.body.imported).toBe(1);
    const w = await call<WeightsResponse>("GET", "/api/weights?days=3650");
    expect(w.body.points.find((p) => p.date === "2026-01-02")?.weightKg).toBe(84);
  });
});

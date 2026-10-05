// Fill a local development server with a sample profile and a few weeks of history.
// Usage: STRIKE_URL=http://localhost:3090 node scripts/seed.ts   (against a server with an empty database;
// set STRIKE_DATA_DIR to the server's when it isn't the default)
import path from "node:path";
import Database from "better-sqlite3";
import { addDays, todayIn, type OnboardingRequest, type Session, type StateResponse } from "@strike/core";

const base = process.env.STRIKE_URL ?? "http://localhost:3090";
const headers: Record<string, string> = { "content-type": "application/json" };
if (process.env.STRIKE_TOKEN) headers.authorization = `Bearer ${process.env.STRIKE_TOKEN}`;

async function api<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(base + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${url}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

const state = await api<StateResponse>("GET", "/api/state");
if (state.onboarded) {
  console.log("Already onboarded; leaving the data alone.");
  process.exit(0);
}

const tz = "America/New_York";
const today = todayIn(tz);
const onboarding: OnboardingRequest = {
  weightKg: 88,
  measurements: { waistCm: 92, neckCm: 39, hipsCm: null, chestCm: 104, armCm: 37, thighCm: 59, bodyFatPercent: null },
  profile: {
    name: "Chris",
    sex: "male",
    birthDate: "1994-05-10",
    heightCm: 180,
    units: "imperial",
    timezone: tz,
    activityLevel: "light",
    goal: { type: "lose", ratePercentPerWeek: 0.5, targetWeightKg: 82 },
    training: { experience: "intermediate", days: [1, 2, 4, 5], sessionMinutes: 60, workoutTime: "17:30", defaultLocation: "gym", focusMuscles: ["side_delts", "back"], limitations: "" },
    equipment: {
      home: { available: true, dumbbells: { kind: "adjustable", min: 5, max: 52.5, step: 2.5 }, items: ["bench_adjustable"], machineStep: 10, notes: "" },
      gym: {
        available: true,
        dumbbells: { kind: "fixed", weights: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75] },
        items: ["bench_adjustable", "bench_flat", "cable", "lat_pulldown", "seated_row", "leg_press", "leg_extension", "leg_curl", "smith_machine", "pullup_bar"],
        machineStep: 10,
        notes: "Small apartment gym, usually empty after 7pm",
      },
    },
    schedule: { wakeTime: "07:00", sleepTime: "23:00", checkInDay: 0 },
    nutrition: {
      mealsPerDay: 4,
      dietStyle: "omnivore",
      allergies: [],
      avoidFoods: "mushrooms",
      favoriteFoods: "chicken, rice, eggs, Greek yogurt, Mexican food",
      cookingTime: "moderate",
      weeklyBudgetUsd: 90,
      grabAndGo: ["Chipotle", "Publix deli", "Chick-fil-A", "Wawa"],
      kitchen: ["microwave", "stove", "oven", "air_fryer", "rice_cooker"],
    },
  },
};
await api("POST", "/api/onboarding", onboarding);

// Three weeks of morning weigh-ins trending down about 0.4 kg a week, with daily noise.
for (let i = 21; i >= 1; i--) {
  if (i % 6 === 0) continue;
  const noise = Math.sin(i * 1.7) * 0.35;
  await api("POST", "/api/weights", { date: addDays(today, -i), weightKg: Math.round((88.9 - (21 - i) * 0.057 + noise) * 10) / 10, source: "manual" });
}

// Wait for the mock coach to write the first block, then do the first session as "yesterday".
for (let tries = 0; tries < 30; tries++) {
  const t = await api<{ nextSession: { id: number } | null }>("GET", "/api/today");
  if (t.nextSession) {
    let s = await api<Session>("POST", `/api/sessions/${t.nextSession.id}/start`, {});
    for (const ex of s.exercises) {
      for (const set of ex.sets) {
        s = await api<Session>("POST", `/api/sessions/${s.id}/sets`, {
          sessionExerciseId: ex.id,
          setIndex: set.index,
          weight: set.targetWeight,
          reps: set.targetReps + (set.index === 0 ? 1 : 0),
          rir: set.targetRir,
        });
      }
      await api("PUT", `/api/sessions/${s.id}/feedback`, { muscle: ex.muscle, soreness: 1, pump: 1, workload: 1, jointPain: false });
    }
    await api("POST", `/api/sessions/${s.id}/complete`);
    // The server's database, which is only reachable here when this runs beside it.
    const db = new Database(path.join(process.env.STRIKE_DATA_DIR ?? path.resolve(import.meta.dirname, "../data"), "strike.db"));
    db.prepare("update sessions set date = ? where id = ?").run(addDays(today, -1), s.id);
    db.close();
    break;
  }
  await new Promise((r) => setTimeout(r, 500));
}

// A couple of logged meals today.
const day = await api<{ timeline: { kind: string; slotIndex?: number; options?: { id: string }[] }[] }>("GET", "/api/today");
const firstMeal = day.timeline.find((i) => i.kind === "meal" && i.options?.length);
if (firstMeal?.options?.[0]) await api("POST", "/api/meals/log", { date: today, slotIndex: firstMeal.slotIndex, optionId: firstMeal.options[0].id, custom: null, status: "eaten" });
console.log("Seeded.");

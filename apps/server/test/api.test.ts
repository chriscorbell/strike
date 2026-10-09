import fs from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CoachMessage, CoachStreamEvent, CoachThread, CoachThreadSummary, CompleteSessionResponse, ExerciseDetail, MealMenu, MenuResponse, MesoOverview, OnboardingRequest, RecentMeal, Session, StateResponse, TodayResponse, WeightsResponse } from "@strike/core";
import { addDays } from "@strike/core";
import { createApp } from "../src/app.ts";
import { propose } from "../src/coach/actions.ts";
import { registerCoachHandlers } from "../src/coach/tasks.ts";
import { closeDb, runMigrations } from "../src/db/index.ts";
import { env } from "../src/env.ts";
import { recentCoachNotes } from "../src/services/checkins.ts";
import { getJob, pendingJobs, startWorker, stopWorker } from "../src/services/jobs.ts";

const app = createApp();
const auth = { authorization: "Bearer test-token", "content-type": "application/json" };

async function call<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = auth): Promise<{ status: number; body: T }> {
  const res = await app.request(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: (await res.json()) as T };
}

/** Sends an Ask Coach message and reads the whole event stream. */
async function ask(threadId: number | null, text: string): Promise<CoachStreamEvent[]> {
  const res = await app.request("/api/coach/messages", { method: "POST", headers: auth, body: JSON.stringify({ threadId, text }) });
  expect(res.headers.get("content-type")).toContain("text/event-stream");
  return (await res.text())
    .split("\n\n")
    .map((chunk) => chunk.split("\n").find((l) => l.startsWith("data: ")))
    .filter((l): l is string => l != null)
    .map((l) => JSON.parse(l.slice(6)) as CoachStreamEvent);
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

  it("serves each exercise's form guide", async () => {
    const today = (await call<TodayResponse>("GET", "/api/today")).body;
    const s = (await call<Session>("GET", `/api/sessions/${today.nextSession!.id}`)).body;
    const detail = await call<ExerciseDetail>("GET", `/api/exercises/${s.exercises[0]!.exerciseId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.name).toBe(s.exercises[0]!.name);
    expect(detail.body.guide.steps.length).toBeGreaterThan(0);
    expect(detail.body.guide.video.youtubeId).toMatch(/^[\w-]{11}$/);
    expect((await call("GET", "/api/exercises/made_up")).status).toBe(404);
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

  it("lists meals entered by hand to log again", async () => {
    const date = (await call<TodayResponse>("GET", "/api/today")).body.date;
    const extra = (name: string, kcal: number, day = date) =>
      call("POST", "/api/meals/log", { date: day, slotIndex: null, optionId: null, custom: { name, macros: { kcal, proteinG: 30, carbsG: 40, fatG: 10 } }, status: "eaten" });
    await extra("Protein shake", 300, addDays(date, -2));
    await extra("Chipotle bowl", 800, addDays(date, -1));
    await extra("protein shake", 320);
    // The plan option logged earlier isn't listed; the shake is listed once, as last entered.
    const recent = (await call<RecentMeal[]>("GET", "/api/meals/recent")).body;
    expect(recent.map((m) => m.name)).toEqual(["protein shake", "Chipotle bowl"]);
    expect(recent[0]).toMatchObject({ macros: { kcal: 320 }, lastDate: date });
    expect((await call<RecentMeal[]>("GET", "/api/meals/recent?limit=1")).body).toHaveLength(1);
  });

  it("plans each day's meals and totals the groceries", async () => {
    const { body } = await call<MenuResponse>("GET", "/api/menu");
    const menu = body.menu!;
    expect(menu.plan.length).toBeGreaterThan(0);
    const day = menu.plan[0]!;
    expect(day.meals).toHaveLength(4);
    expect(menu.groceryList.length).toBeGreaterThan(0);

    const today = (await call<TodayResponse>("GET", `/api/today?date=${day.date}`)).body;
    const meal = today.timeline.find((i) => i.kind === "meal")!;
    if (meal.kind !== "meal") throw new Error("expected a meal");
    expect(meal.plannedOptionId).toBe(day.meals.find((m) => m.slotIndex === meal.slotIndex)!.optionId);
    expect(meal.options[0]!.id).toBe(meal.plannedOptionId);

    // Swapping every planned meal on that day for grab-and-go shrinks the shopping.
    const cost = (m: MealMenu) => m.groceryList.reduce((a, g) => a + g.costUsd, 0);
    let updated = menu;
    for (const m of day.meals) {
      const slot = menu.slots.find((s) => s.dayType === day.dayType && s.slotIndex === m.slotIndex)!;
      const out = slot.options.find((o) => o.kind === "out")!;
      const res = await call<MealMenu>("PUT", `/api/menu/${menu.id}/plan`, { date: day.date, slotIndex: m.slotIndex, optionId: out.id });
      expect(res.status).toBe(200);
      updated = res.body;
    }
    expect(cost(updated)).toBeLessThanOrEqual(cost(menu));
    expect((await call("GET", "/api/menu?week=next")).status).toBe(200);
    expect((await call("GET", "/api/menu?week=someday")).status).toBe(400);
  });

  it("writes a prep guide from the plan and notices when the plan changes", async () => {
    await call("POST", "/api/menu/regenerate", { week: "current" });
    await idle();
    let menu = (await call<MenuResponse>("GET", "/api/menu")).body.menu!;
    expect(menu.prepGuide).not.toBeNull();
    expect(menu.prepGuideStale).toBe(false);
    const guide = menu.prepGuide!;
    expect(guide.sessions.length).toBeGreaterThan(0);
    const planned = menu.plan.flatMap((d) => d.meals).filter((m) => menu.slots.flatMap((s) => s.options).find((o) => o.id === m.optionId)?.kind === "home");
    expect(guide.sessions.reduce((a, s) => a + s.containers.length, 0)).toBe(planned.length);

    const day = menu.plan[0]!;
    const slot = menu.slots.find((s) => s.dayType === day.dayType && s.slotIndex === day.meals[0]!.slotIndex)!;
    const other = slot.options.find((o) => o.id !== day.meals[0]!.optionId)!;
    menu = (await call<MealMenu>("PUT", `/api/menu/${menu.id}/plan`, { date: day.date, slotIndex: day.meals[0]!.slotIndex, optionId: other.id })).body;
    expect(menu.prepGuideStale).toBe(true);

    expect((await call("POST", `/api/menu/${menu.id}/prep-guide`)).status).toBe(200);
    await idle();
    menu = (await call<MenuResponse>("GET", "/api/menu")).body.menu!;
    expect(menu.prepGuideStale).toBe(false);

    const today = (await call<TodayResponse>("GET", `/api/today?date=${guide.sessions[0]!.date}`)).body;
    expect(today.prep?.sessions.length).toBeGreaterThan(0);
  });

  it("answers in Ask Coach as a stream and keeps the conversation", async () => {
    const events = await ask(null, "I missed my cook day yesterday. What now?");
    expect(events[0]!.type).toBe("start");
    expect(events.some((e) => e.type === "delta")).toBe(true);
    const done = events.at(-1)!;
    if (done.type !== "done") throw new Error("expected done last");
    expect(done.reply.status).toBe("done");
    expect(done.reply.text.length).toBeGreaterThan(0);

    const threads = (await call<CoachThreadSummary[]>("GET", "/api/coach/threads")).body;
    expect(threads[0]!.title).toBe("I missed my cook day yesterday. What now?");
    const thread = (await call<CoachThread>("GET", `/api/coach/threads/${threads[0]!.id}`)).body;
    expect(thread.replying).toBe(false);
    expect(thread.messages.map((m) => m.role)).toEqual(["user", "assistant"]);

    await ask(thread.id, "And tomorrow?");
    expect((await call<CoachThread>("GET", `/api/coach/threads/${thread.id}`)).body.messages).toHaveLength(4);
    expect((await call("POST", "/api/coach/messages", { threadId: 9999, text: "hi" })).status).toBe(404);
    expect((await call("POST", "/api/coach/messages", { threadId: null, text: "   " })).status).toBe(400);
  });

  it("proposes changes that only happen when applied, all together", async () => {
    const done = (await ask(null, "Swap tomorrow's breakfast")).at(-1)!;
    if (done.type !== "done") throw new Error("expected done last");
    const replyId = done.reply.id;
    const menu = (await call<MenuResponse>("GET", "/api/menu")).body.menu!;
    const day = menu.plan.at(-1)!;
    const meal = day.meals[0]!;
    const slot = menu.slots.find((s) => s.dayType === day.dayType && s.slotIndex === meal.slotIndex)!;
    const other = slot.options.find((o) => o.id !== meal.optionId)!;

    // Proposing checks the change but leaves everything as it was.
    const swap = propose(replyId, "swap_meal", { date: day.date, slotIndex: meal.slotIndex, optionId: other.id });
    expect(swap.summary).toContain(other.name);
    expect(() => propose(replyId, "swap_meal", { date: day.date, slotIndex: meal.slotIndex, optionId: "nope" })).toThrow(/isn't on this menu/);
    expect(() => propose(replyId, "set_day_type", { date: "2020-01-01", dayType: "rest" })).toThrow(/already passed/);
    propose(replyId, "set_workout_time", { date: day.date, time: "07:15" });
    propose(replyId, "save_note", { note: "Chicken for this week is in the freezer." });
    propose(replyId, "rewrite_prep_guide", { week: "current", note: "Missed the first cook; chicken is frozen." });
    const before = (await call<MenuResponse>("GET", "/api/menu")).body.menu!;
    expect(before.plan.at(-1)!.meals[0]!.optionId).toBe(meal.optionId);
    expect(recentCoachNotes().some((n) => n.note.includes("freezer"))).toBe(false);

    const applied = await call<CoachMessage>("POST", `/api/coach/messages/${replyId}/apply`);
    expect(applied.status).toBe(200);
    expect(applied.body.actions.map((a) => a.status)).toEqual(["applied", "applied", "applied", "applied"]);
    const after = (await call<MenuResponse>("GET", "/api/menu")).body.menu!;
    expect(after.plan.at(-1)!.meals[0]!.optionId).toBe(other.id);
    expect((await call<TodayResponse>("GET", `/api/today?date=${day.date}`)).body.workoutTimeOverride).toBe("07:15");
    expect(recentCoachNotes().some((n) => n.note.includes("freezer"))).toBe(true);
    const jobId = applied.body.actions.find((a) => a.kind === "rewrite_prep_guide")!.jobId!;
    await idle();
    expect(getJob(jobId).status).toBe("succeeded");
    expect((await call("POST", `/api/coach/messages/${replyId}/apply`)).status).toBe(409);

    // A later reply's proposals replace earlier ones that weren't applied.
    const first = (await ask(null, "Make tomorrow a rest day")).at(-1)!;
    if (first.type !== "done") throw new Error("expected done last");
    propose(first.reply.id, "set_day_type", { date: day.date, dayType: "rest" });
    const next = (await ask(first.reply.threadId, "Actually, the day after")).at(-1)!;
    if (next.type !== "done") throw new Error("expected done last");
    propose(next.reply.id, "set_workout_time", { date: day.date, time: null });
    const replaced = (await call<CoachThread>("GET", `/api/coach/threads/${first.reply.threadId}`)).body.messages;
    expect(replaced.find((m) => m.id === first.reply.id)!.actions[0]!.status).toBe("dismissed");
    expect(replaced.find((m) => m.id === next.reply.id)!.actions[0]!.status).toBe("proposed");

    // Dismissing leaves things alone.
    const second = (await ask(null, "Actually, never mind")).at(-1)!;
    if (second.type !== "done") throw new Error("expected done last");
    propose(second.reply.id, "save_note", { note: "Never saved." });
    const dismissed = await call<CoachMessage>("POST", `/api/coach/messages/${second.reply.id}/dismiss`);
    expect(dismissed.body.actions[0]!.status).toBe("dismissed");
    expect(recentCoachNotes().some((n) => n.note === "Never saved.")).toBe(false);
    expect((await call("DELETE", `/api/coach/threads/${second.reply.threadId}`)).status).toBe(200);
    expect((await call("GET", `/api/coach/threads/${second.reply.threadId}`)).status).toBe(404);
  });

  it("rewrites a prep guide with a note", async () => {
    const menu = (await call<MenuResponse>("GET", "/api/menu")).body.menu!;
    const job = await call<{ id: number; status: string }>("POST", `/api/menu/${menu.id}/prep-guide`, { note: "Cook on Tuesday instead." });
    expect(job.status).toBe(200);
    await idle();
    expect(getJob(job.body.id).status).toBe("succeeded");
  });

  it("keeps manual weigh-ins over Apple Health", async () => {
    await call("POST", "/api/weights", { date: "2026-01-02", weightKg: 84, source: "manual" });
    const batch = await call<{ imported: number }>("POST", "/api/weights/batch", { source: "healthkit", entries: [{ date: "2026-01-02", weightKg: 90 }, { date: "2026-01-03", weightKg: 84.2 }] });
    expect(batch.body.imported).toBe(1);
    const w = await call<WeightsResponse>("GET", "/api/weights?days=3650");
    expect(w.body.points.find((p) => p.date === "2026-01-02")?.weightKg).toBe(84);
  });
});

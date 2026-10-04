import { formatTime, parseTime } from "./dates.ts";
import type { Macros, MealRole } from "./schemas.ts";

export interface MealTimingInput {
  wakeTime: string;
  sleepTime: string;
  mealsPerDay: number;
  /** Null on rest days. */
  workout: { start: string; minutes: number } | null;
  targets: Macros;
}

export interface PlannedMeal {
  slotIndex: number;
  time: string;
  label: string;
  role: MealRole;
  targets: Macros;
}

const STEP = 15;
const BIG = 2000;

/**
 * Meal times for a day, chosen to balance, in order of weight:
 * - no long stretch without food: gaps past four hours cost more the longer they run;
 * - a meal within an hour or so after training;
 * - the last meal before training one to three hours out (never within 45 minutes of it);
 * - breakfast about 45 minutes after waking, and the last meal at least an hour before bed;
 * - otherwise even spacing.
 * With few meals and an evening session this gives breakfast, lunch, and dinner after training rather
 * than a ten-hour gap waiting for a pre-workout meal. Carbohydrate is concentrated in the meals around
 * training.
 */
export function planMeals(input: MealTimingInput): PlannedMeal[] {
  const wake = parseTime(input.wakeTime);
  let sleep = parseTime(input.sleepTime);
  if (sleep <= wake) sleep += 1440;
  const n = input.mealsPerDay;

  let ws: number | null = null;
  let we: number | null = null;
  if (input.workout) {
    ws = parseTime(input.workout.start);
    if (ws < wake - 120) ws += 1440;
    ws = Math.max(ws, wake);
    we = ws + input.workout.minutes;
  }

  const times = candidateTimes(wake, sleep, ws, we, n);
  const chosen = bestSchedule(times, n, { wake, sleep, ws, we });
  return describe(chosen, input, sleep, ws, we);
}

function candidateTimes(wake: number, sleep: number, ws: number | null, we: number | null, n: number): number[] {
  for (const step of [STEP, 5]) {
    const out: number[] = [];
    for (let t = Math.ceil((wake + 15) / step) * step; t <= sleep - 60; t += step) {
      if (ws != null && we != null && t > ws - 45 && t < we + 15) continue;
      out.push(t);
    }
    if (out.length >= n) return out;
  }
  // A very short day: spread across it regardless of the rules.
  const span = Math.max(n * 30, sleep - 60 - (wake + 15));
  return Array.from({ length: n }, (_, i) => wake + 15 + Math.round((span * i) / Math.max(1, n - 1)));
}

interface Day {
  wake: number;
  sleep: number;
  ws: number | null;
  we: number | null;
}

const gapCost = (g: number) => (g > 240 ? (g - 240) ** 2 / 60 : 0) + (g < 150 ? (150 - g) ** 2 / 15 : 0) + g ** 2 / 2000;

function firstCost(t: number, d: Day): number {
  const off = t - (d.wake + 45);
  let cost = off >= 0 ? (off <= 30 ? off * 0.2 : 6 + (off - 30) ** 2 / 2.5) : -off * 1.5;
  // Training before the first meal: fasted, which is fine early in the morning but costs a little,
  // and the first meal then has to be the post-workout one.
  if (d.ws != null && d.we != null && t > d.we) cost += 60 + postCost(t - d.we);
  return cost;
}

const preCost = (minutesBefore: number) => (minutesBefore > 180 ? (minutesBefore - 180) * 0.8 : 0);
const postCost = (minutesAfter: number) => (minutesAfter > 60 ? (minutesAfter - 60) * 2.5 : 0) + (minutesAfter > 90 ? (minutesAfter - 90) * 4 : 0) + (minutesAfter < 30 ? 30 - minutesAfter : 0);

function lastCost(t: number, d: Day): number {
  // Training after the last meal means no post-workout meal.
  let cost = d.ws != null && t < d.ws ? BIG : 0;
  // Going to bed long after the last meal is a gap like any other.
  const toBed = d.sleep - t;
  cost += toBed > 180 ? (toBed - 180) ** 2 / 60 : 0;
  return cost;
}

/** Minimum-cost placement of n meals on the candidate times (dynamic programming over the grid). */
function bestSchedule(times: number[], n: number, d: Day): number[] {
  const G = times.length;
  if (n <= 0) return [];
  let cost = times.map((t) => firstCost(t, d));
  const back: number[][] = [];
  for (let i = 1; i < n; i++) {
    const next = new Array<number>(G).fill(Infinity);
    const from = new Array<number>(G).fill(-1);
    for (let j = 0; j < G; j++) {
      const b = times[j]!;
      for (let k = 0; k < j; k++) {
        const prev = cost[k]!;
        if (prev === Infinity) continue;
        const a = times[k]!;
        let c = prev + gapCost(b - a);
        if (d.ws != null && d.we != null && a < d.ws && b > d.we) c += preCost(d.ws - a) + postCost(b - d.we);
        if (c < next[j]!) {
          next[j] = c;
          from[j] = k;
        }
      }
    }
    back.push(from);
    cost = next;
  }
  let best = -1;
  let bestCost = Infinity;
  for (let j = 0; j < G; j++) {
    const c = cost[j]! + lastCost(times[j]!, d);
    if (c < bestCost) {
      bestCost = c;
      best = j;
    }
  }
  const picks = [best];
  for (let i = back.length - 1; i >= 0; i--) picks.unshift(back[i]![picks[0]!]!);
  return picks.map((j) => times[j]!);
}

function describe(chosen: number[], input: MealTimingInput, sleep: number, ws: number | null, we: number | null): PlannedMeal[] {
  const roles: MealRole[] = chosen.map(() => "regular");
  if (ws != null && we != null) {
    const before = chosen.filter((t) => t < ws).at(-1);
    const after = chosen.find((t) => t > we);
    if (before != null && ws - before <= 240) roles[chosen.indexOf(before)] = "pre_workout";
    if (after != null && after - we <= 150) roles[chosen.indexOf(after)] = "post_workout";
  }
  const lastIndex = chosen.length - 1;
  if (roles[lastIndex] === "regular" && sleep - chosen[lastIndex]! <= 180) roles[lastIndex] = "bedtime";

  const training = input.workout != null;
  const carbs: Record<MealRole, number> = training
    ? { pre_workout: 1.6, post_workout: 1.8, regular: 1, bedtime: 0.6 }
    : { pre_workout: 1, post_workout: 1, regular: 1, bedtime: 0.7 };
  const fats: Record<MealRole, number> = training
    ? { pre_workout: 0.4, post_workout: 0.6, regular: 1, bedtime: 1.2 }
    : { pre_workout: 1, post_workout: 1, regular: 1, bedtime: 1.2 };
  // On a training day without a meal close enough to count as pre-workout, the last meal before the
  // session still gets a little more carbohydrate.
  const shares = chosen.map((t, i) => {
    let c = carbs[roles[i]!];
    if (training && ws != null && roles[i] === "regular" && t < ws && !chosen.some((u) => u > t && u < ws)) c = 1.3;
    return { protein: 1, carbs: c, fat: fats[roles[i]!] };
  });
  const total = (k: "protein" | "carbs" | "fat") => shares.reduce((s, x) => s + x[k], 0);
  const tp = total("protein");
  const tc = total("carbs");
  const tf = total("fat");

  const labels = labelMeals(chosen, roles);
  return chosen.map((t, i) => {
    const s = shares[i]!;
    const proteinG = Math.round((input.targets.proteinG * s.protein) / tp / 5) * 5;
    const carbsG = Math.round((input.targets.carbsG * s.carbs) / tc / 5) * 5;
    const fatG = Math.round((input.targets.fatG * s.fat) / tf);
    return {
      slotIndex: i,
      time: formatTime(t),
      label: labels[i]!,
      role: roles[i]!,
      targets: { kcal: proteinG * 4 + carbsG * 4 + fatG * 9, proteinG, carbsG, fatG },
    };
  });
}

/**
 * Names that read like a normal day: workout meals by their role; then the first meal before 11:00 is
 * breakfast, the meal nearest 12:30 between 11:00 and 15:00 is lunch, the one nearest 18:30 between
 * 17:00 and 21:30 is dinner (wider windows on days of four meals or fewer); anything else is a snack
 * named for its part of the day.
 */
function labelMeals(times: number[], roles: MealRole[]): string[] {
  const clock = times.map((t) => t % 1440);
  const labels: (string | null)[] = roles.map((r) => (r === "pre_workout" ? "Pre-workout" : r === "post_workout" ? "Post-workout" : null));
  const claim = (name: string, from: number, to: number, ideal: number) => {
    let best = -1;
    for (let i = 0; i < times.length; i++) {
      if (labels[i] != null || clock[i]! < from || clock[i]! >= to) continue;
      if (best < 0 || Math.abs(clock[i]! - ideal) < Math.abs(clock[best]! - ideal)) best = i;
    }
    if (best >= 0) labels[best] = name;
  };
  const firstFree = labels.findIndex((l) => l == null);
  if (firstFree >= 0 && clock[firstFree]! < 11 * 60) labels[firstFree] = "Breakfast";
  // With few meals, every main meal gets a meal name even when it lands a little off the usual hour.
  const few = times.length <= 4;
  claim("Lunch", 11 * 60, few ? 17 * 60 : 15 * 60, 12 * 60 + 30);
  claim("Dinner", 17 * 60, few ? 24 * 60 : 21 * 60 + 30, 18 * 60 + 30);
  const used = new Map<string, number>();
  return labels.map((l, i) => {
    if (l) return l;
    const c = clock[i]!;
    const base = roles[i] === "bedtime" ? "Evening snack" : c < 11 * 60 + 30 ? "Morning snack" : c < 17 * 60 ? "Afternoon snack" : "Evening snack";
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    return n > 1 ? `${base} ${n}` : base;
  });
}

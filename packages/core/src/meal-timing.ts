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

interface Anchor {
  t: number;
  role: MealRole;
}

const MIN_GAP = 120;

/**
 * Meal times for a day. The first meal comes 45 minutes after waking and the last 90 minutes before
 * bed. On a training day a meal lands about 90 minutes before the session and another 45 minutes
 * after it, with carbohydrate concentrated in those two; the rest fill the largest gaps.
 */
export function planMeals(input: MealTimingInput): PlannedMeal[] {
  const wake = parseTime(input.wakeTime);
  let sleep = parseTime(input.sleepTime);
  if (sleep <= wake) sleep += 1440;
  const n = input.mealsPerDay;
  const first = wake + 45;
  const last = Math.max(first + MIN_GAP, sleep - 90);

  let anchors: Anchor[] = [];
  let workoutWindow: [number, number] | null = null;

  if (input.workout) {
    let ws = parseTime(input.workout.start);
    if (ws < wake) ws += 1440;
    const we = ws + input.workout.minutes;
    workoutWindow = [ws, we];
    const pre = Math.max(wake + 15, ws - 90);
    const post = we + 45;
    anchors.push({ t: pre, role: "pre_workout" }, { t: post, role: "post_workout" });
    if (pre - first >= MIN_GAP) anchors.unshift({ t: first, role: "regular" });
    if (last - post >= MIN_GAP) anchors.push({ t: last, role: "bedtime" });
  } else {
    anchors = [
      { t: first, role: "regular" },
      { t: last, role: "bedtime" },
    ];
  }

  // Too many anchors for the meal count: drop the ordinary ones first, latest first.
  while (anchors.length > n) {
    const idx = anchors.map((a) => a.role).lastIndexOf("bedtime");
    const drop = idx >= 0 ? idx : anchors.findIndex((a) => a.role === "regular");
    anchors.splice(drop >= 0 ? drop : anchors.length - 1, 1);
  }

  // Too few: split the widest gap that doesn't contain the workout.
  while (anchors.length < n) {
    let best = -1;
    let bestGap = -1;
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i]!.t;
      const b = anchors[i + 1]!.t;
      if (workoutWindow && a <= workoutWindow[0] && b >= workoutWindow[1]) continue;
      if (b - a > bestGap) {
        bestGap = b - a;
        best = i;
      }
    }
    const lastT = anchors[anchors.length - 1]!.t;
    const tailRoom = Math.max(0, last - lastT);
    const headRoom = Math.max(0, anchors[0]!.t - first);
    if (tailRoom >= MIN_GAP && tailRoom >= bestGap) {
      anchors.push({ t: last, role: "regular" });
    } else if (headRoom >= MIN_GAP && headRoom >= bestGap) {
      anchors.unshift({ t: first, role: "regular" });
    } else if (best >= 0) {
      const mid = Math.round((anchors[best]!.t + anchors[best + 1]!.t) / 2 / 15) * 15;
      anchors.splice(best + 1, 0, { t: mid, role: "regular" });
    } else {
      // Nowhere sensible left; append after the last meal.
      anchors.push({ t: lastT + MIN_GAP, role: "regular" });
    }
  }

  anchors.sort((a, b) => a.t - b.t);
  const lastAnchor = anchors[anchors.length - 1]!;
  if (lastAnchor.role === "regular" && sleep - lastAnchor.t <= 150) lastAnchor.role = "bedtime";

  const training = input.workout != null;
  const share = (role: MealRole) => ({
    protein: 1,
    carbs: training ? { pre_workout: 1.6, post_workout: 1.8, regular: 1, bedtime: 0.6 }[role] : { pre_workout: 1, post_workout: 1, regular: 1, bedtime: 0.7 }[role],
    fat: training ? { pre_workout: 0.4, post_workout: 0.6, regular: 1, bedtime: 1.2 }[role] : { pre_workout: 1, post_workout: 1, regular: 1, bedtime: 1.2 }[role],
  });
  const shares = anchors.map((a) => share(a.role));
  const total = (k: "protein" | "carbs" | "fat") => shares.reduce((s, x) => s + x[k], 0);
  const tp = total("protein");
  const tc = total("carbs");
  const tf = total("fat");

  const used = new Set<string>();
  return anchors.map((a, i) => {
    const s = shares[i]!;
    const proteinG = Math.round(((input.targets.proteinG * s.protein) / tp) / 5) * 5;
    const carbsG = Math.round(((input.targets.carbsG * s.carbs) / tc) / 5) * 5;
    const fatG = Math.round((input.targets.fatG * s.fat) / tf);
    let label = labelFor(a.t % 1440, a.role);
    if (used.has(label)) label = "Snack";
    used.add(label);
    return {
      slotIndex: i,
      time: formatTime(Math.round(a.t / 5) * 5),
      label,
      role: a.role,
      targets: { kcal: proteinG * 4 + carbsG * 4 + fatG * 9, proteinG, carbsG, fatG },
    };
  });
}

function labelFor(minutes: number, role: MealRole): string {
  if (role === "pre_workout") return "Pre-workout";
  if (role === "post_workout") return "Post-workout";
  if (minutes < 10 * 60 + 30) return "Breakfast";
  if (minutes < 14 * 60 + 30) return "Lunch";
  if (minutes < 17 * 60) return "Afternoon meal";
  if (minutes < 20 * 60 + 30) return "Dinner";
  return "Evening meal";
}

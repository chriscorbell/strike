// Load prescription. Every logged set gives an estimated one-rep max (Epley, counting the reps left in
// reserve as reps you could have done). The next session picks the heaviest load you own that still
// leaves at least the bottom of the rep range at the week's target RIR. Beating a target raises the
// estimate and so the load or the reps; missing it lowers them. Big dumbbell jumps turn into extra
// reps at the same weight until the next jump fits, which is double progression falling out of the math.
import type { Exercise } from "./exercises.ts";
import type { Profile } from "./schemas.ts";
import { snapDown } from "./equipment.ts";
import { kgToLb, round } from "./units.ts";

export interface PerformedSet {
  weight: number | null;
  reps: number;
  rir: number | null;
}

export interface HistoryEntry {
  date: string;
  targetRir: number;
  /** The first set's target reps that session. */
  targetReps: number;
  weight: number | null;
  sets: PerformedSet[];
}

export interface Prescription {
  weight: number | null;
  reps: number[];
  note: string;
  maxedOut: boolean;
}

export interface PrescribeInput {
  exercise: Pick<Exercise, "loadType" | "repMin" | "repMax">;
  repMin: number;
  repMax: number;
  sets: number;
  targetRir: number;
  isDeload: boolean;
  /** Ascending loads available; empty for bodyweight. */
  loads: number[];
  /** Oldest first. */
  history: HistoryEntry[];
  startWeight: number | null;
  experience: Profile["training"]["experience"];
  unit: "lb" | "kg";
}

export const e1rm = (weight: number, reps: number, rir: number) => weight * (1 + (reps + rir) / 30);

/** Reps you can do at `weight` while leaving `rir` in reserve. */
export const repsAt = (oneRm: number, weight: number, rir: number) => Math.round(30 * (oneRm / weight - 1) - rir);

const WEEKLY_GAIN: Record<Profile["training"]["experience"], number> = {
  beginner: 0.02,
  intermediate: 0.01,
  advanced: 0.005,
};

function perSetReps(first: number, sets: number, targetRir: number): number[] {
  const drop = targetRir <= 1 ? 1 : 0.5;
  return Array.from({ length: sets }, (_, i) => Math.max(1, first - Math.floor(i * drop)));
}

const fmt = (w: number, unit: string) => `${round(w, 1)} ${unit}`;

export function prescribe(p: PrescribeInput): Prescription {
  const last = p.history[p.history.length - 1];
  const mid = Math.round((p.repMin + p.repMax) / 2);

  if (p.exercise.loadType === "bodyweight") return prescribeBodyweight(p, last);

  if (!last || !last.sets.some((s) => s.weight != null && s.weight > 0 && s.reps > 0)) {
    const w = p.startWeight != null ? snapDown(p.startWeight, p.loads) : (p.loads[0] ?? null);
    const reps = p.isDeload ? p.repMin : mid;
    return {
      weight: w,
      reps: perSetReps(reps, p.sets, p.targetRir),
      note: "First time: a starting guess. If it's clearly too light or heavy, change the weight and log what you used.",
      maxedOut: false,
    };
  }

  const lastWeight = last.weight ?? last.sets[0]?.weight ?? null;

  if (p.isDeload) {
    const w = lastWeight != null ? snapDown(lastWeight * 0.85, p.loads) : (p.loads[0] ?? null);
    return {
      weight: w,
      reps: perSetReps(p.repMin, p.sets, 4),
      note: "Deload: lighter and easy. Stop well short of failure and let your body recover.",
      maxedOut: false,
    };
  }

  const best = Math.max(
    ...last.sets.filter((s) => s.weight != null && s.weight > 0).map((s) => e1rm(s.weight!, s.reps, s.rir ?? last.targetRir)),
  );
  const first = last.sets[0];
  const metTarget = first != null && first.reps + (first.rir ?? last.targetRir) >= last.targetReps + last.targetRir;
  const estimate = metTarget ? best * (1 + WEEKLY_GAIN[p.experience]) : best;

  const loads = p.loads.length ? p.loads : [lastWeight ?? 0];
  const at = (w: number) => repsAt(estimate, w, p.targetRir);
  // Double progression: stay at the last load while the reps fit the range, step up once they pass
  // the top, step down once they fall under the bottom.
  let i = loads.indexOf(lastWeight != null ? snapDown(lastWeight, loads) : loads[0]!);
  if (i < 0) i = 0;
  if (at(loads[i]!) > p.repMax) {
    while (i + 1 < loads.length && at(loads[i]!) > p.repMax) {
      // A big jump can land far below the range; stay put and do extra reps instead.
      if (at(loads[i + 1]!) < p.repMin - 2) break;
      i += 1;
    }
  } else {
    while (i > 0 && at(loads[i]!) < p.repMin) i -= 1;
  }
  const weight = loads[i]!;
  let reps = Math.max(1, at(weight));

  // The estimate rounds away small gains; at the same load and effort, still ask for one more rep.
  const lastFirst = first?.reps ?? 0;
  const lastRir = first?.rir ?? last.targetRir;
  if (lastWeight != null && weight === lastWeight && metTarget && p.targetRir >= lastRir && reps <= lastFirst) {
    reps = lastFirst + 1;
  }

  const maxedOut = weight === loads[loads.length - 1] && reps > p.repMax + 2;
  reps = Math.min(reps, p.repMax + 8);

  let note: string;
  if (lastWeight == null || weight === lastWeight) {
    const diff = reps - lastFirst;
    note =
      diff > 0
        ? `Same weight, aim for ${diff} more rep${diff === 1 ? "" : "s"} than last time.`
        : diff < 0
          ? "Same weight, fewer reps: last session was harder than planned, so this keeps you on track."
          : "Same weight and reps as last time.";
  } else if (weight > lastWeight) {
    note = `Up ${fmt(weight - lastWeight, p.unit)}: you beat last time's target.`;
  } else {
    note = `Down ${fmt(lastWeight - weight, p.unit)}: last time fell short, so this resets you into the rep range.`;
  }
  if (maxedOut) note += " This is your heaviest option. Slow the lowering phase down, or swap for a harder variation.";
  if (p.targetRir === 0) note += " Take every set to failure this week.";

  return { weight, reps: perSetReps(reps, p.sets, p.targetRir), note, maxedOut };
}

function prescribeBodyweight(p: PrescribeInput, last: HistoryEntry | undefined): Prescription {
  if (!last || last.sets.length === 0) {
    const reps = Math.min(p.repMax, p.repMin + 2);
    return {
      weight: null,
      reps: perSetReps(reps, p.sets, p.targetRir),
      note: "First time: aim for the target, and log what you actually get.",
      maxedOut: false,
    };
  }
  const first = last.sets[0]!;
  const capacity = first.reps + (first.rir ?? last.targetRir);
  if (p.isDeload) {
    return {
      weight: null,
      reps: perSetReps(Math.max(1, Math.round(capacity * 0.5)), p.sets, 4),
      note: "Deload: about half your usual reps. Keep it easy.",
      maxedOut: false,
    };
  }
  const metTarget = capacity >= last.targetReps + last.targetRir;
  const reps = Math.max(1, capacity + (metTarget ? 1 : 0) - p.targetRir);
  const maxedOut = reps > p.repMax + 5;
  const diff = reps - first.reps;
  let note =
    diff > 0 ? `Aim for ${diff} more rep${diff === 1 ? "" : "s"} than last time.` : diff < 0 ? "A few reps fewer to match this week's effort target." : "Match last time.";
  if (maxedOut) note += " Getting easy: hold a dumbbell or wear a loaded backpack, or swap for a harder variation.";
  return { weight: null, reps: perSetReps(reps, p.sets, p.targetRir), note, maxedOut };
}

const LOWER_BODY = new Set(["quads", "hamstrings", "glutes", "calves"]);

/** A conservative first-session load from body weight, sex and experience. */
export function startingWeight(
  exercise: Pick<Exercise, "ratio" | "loadType" | "primary">,
  opts: { bodyWeightKg: number; sex: "male" | "female"; experience: Profile["training"]["experience"]; unit: "lb" | "kg" },
): number | null {
  if (exercise.loadType === "bodyweight" || exercise.ratio === 0) return null;
  const exp = { beginner: 0.55, intermediate: 0.8, advanced: 0.95 }[opts.experience];
  const sex = opts.sex === "male" ? 1 : LOWER_BODY.has(exercise.primary) ? 0.7 : 0.55;
  const kg = exercise.ratio * opts.bodyWeightKg * exp * sex;
  return opts.unit === "lb" ? kgToLb(kg) : kg;
}

/** RIR targets across the hard weeks of a mesocycle: three in reserve down to failure. */
export function rirForWeek(week: number, hardWeeks: number): number {
  if (week >= hardWeeks) return 4;
  if (hardWeeks <= 1) return 0;
  return Math.round(3 * (1 - week / (hardWeeks - 1)));
}

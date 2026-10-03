// The deterministic mesocycle planner, used when the coach (Claude) is unavailable, and the validator
// every coach-written plan passes through before it is stored.
import type { Exercise, Pattern } from "./exercises.ts";
import { EXERCISES, getExercise, isIsolation } from "./exercises.ts";
import { availableExercises, isAvailable, loadOptions, snapDown } from "./equipment.ts";
import { startingWeight } from "./progression.ts";
import type { Location, LocationEquipment, MesoDayPlan, MesoExercisePlan, MesoPlan, Muscle, Profile } from "./schemas.ts";
import { loadUnit } from "./units.ts";
import { maxSetsForMinutes } from "./volume.ts";

interface Slot {
  muscle: Muscle;
  patterns?: Pattern[];
}

interface DayTemplate {
  label: string;
  focus: string;
  slots: Slot[];
}

const s = (muscle: Muscle, ...patterns: Pattern[]): Slot => ({ muscle, patterns: patterns.length ? patterns : undefined });

const FULL_A: DayTemplate = {
  label: "Full Body A",
  focus: "Squat, press and row",
  slots: [s("quads", "squat"), s("chest", "horizontal_push"), s("back", "horizontal_pull"), s("hamstrings", "knee_flexion", "hinge"), s("side_delts"), s("triceps")],
};
const FULL_B: DayTemplate = {
  label: "Full Body B",
  focus: "Hinge, pull-down and incline press",
  slots: [s("hamstrings", "hinge"), s("back", "vertical_pull"), s("chest", "incline_push"), s("quads", "lunge"), s("rear_delts"), s("biceps")],
};
const FULL_C: DayTemplate = {
  label: "Full Body C",
  focus: "Single-leg work, glutes and arms",
  slots: [s("quads", "lunge", "squat"), s("chest", "fly", "horizontal_push"), s("back", "pullover", "vertical_pull"), s("glutes", "hip_thrust"), s("side_delts"), s("calves")],
};
const UPPER_A: DayTemplate = {
  label: "Upper A",
  focus: "Chest and lats",
  slots: [s("chest", "horizontal_push"), s("back", "vertical_pull"), s("chest", "incline_push", "fly"), s("back", "horizontal_pull"), s("side_delts"), s("biceps"), s("triceps")],
};
const LOWER_A: DayTemplate = {
  label: "Lower A",
  focus: "Quads first",
  slots: [s("quads", "squat"), s("hamstrings", "hinge"), s("quads", "knee_extension", "lunge"), s("hamstrings", "knee_flexion"), s("calves"), s("abs")],
};
const UPPER_B: DayTemplate = {
  label: "Upper B",
  focus: "Shoulders and upper back",
  slots: [s("chest", "incline_push"), s("back", "horizontal_pull"), s("front_delts", "vertical_push"), s("back", "pullover", "vertical_pull"), s("side_delts"), s("triceps"), s("biceps")],
};
const LOWER_B: DayTemplate = {
  label: "Lower B",
  focus: "Hamstrings and glutes first",
  slots: [s("hamstrings", "hinge"), s("quads", "lunge"), s("glutes", "hip_thrust"), s("quads", "knee_extension", "squat"), s("calves"), s("abs")],
};
const PUSH: DayTemplate = {
  label: "Push",
  focus: "Chest, shoulders and triceps",
  slots: [s("chest", "horizontal_push"), s("chest", "incline_push"), s("front_delts", "vertical_push"), s("side_delts"), s("triceps"), s("chest", "fly")],
};
const PULL: DayTemplate = {
  label: "Pull",
  focus: "Back, rear delts and biceps",
  slots: [s("back", "vertical_pull"), s("back", "horizontal_pull"), s("rear_delts"), s("back", "pullover"), s("biceps"), s("traps")],
};
const LEGS: DayTemplate = {
  label: "Legs",
  focus: "Quads, hamstrings and calves",
  slots: [s("quads", "squat"), s("hamstrings", "hinge"), s("quads", "lunge", "knee_extension"), s("hamstrings", "knee_flexion"), s("glutes", "hip_thrust"), s("calves")],
};
const PUSH_B: DayTemplate = { ...PUSH, label: "Push B", slots: [s("chest", "incline_push"), s("front_delts", "vertical_push"), s("chest", "horizontal_push", "dip"), s("side_delts"), s("triceps"), s("side_delts")] };
const PULL_B: DayTemplate = { ...PULL, label: "Pull B", slots: [s("back", "horizontal_pull"), s("back", "vertical_pull"), s("rear_delts"), s("biceps"), s("biceps"), s("abs")] };
const LEGS_B: DayTemplate = { ...LEGS, label: "Legs B", slots: [s("hamstrings", "hinge"), s("quads", "squat"), s("glutes", "hip_thrust"), s("hamstrings", "knee_flexion"), s("quads", "knee_extension", "lunge"), s("calves")] };

const SPLITS: Record<number, { name: string; days: DayTemplate[] }> = {
  2: { name: "Full body, 2 days", days: [FULL_A, FULL_B] },
  3: { name: "Full body, 3 days", days: [FULL_A, FULL_B, FULL_C] },
  4: { name: "Upper/lower, 4 days", days: [UPPER_A, LOWER_A, UPPER_B, LOWER_B] },
  5: { name: "Upper/lower + push/pull/legs, 5 days", days: [UPPER_A, LOWER_A, PUSH, PULL, LEGS] },
  6: { name: "Push/pull/legs, 6 days", days: [PUSH, PULL, LEGS, PUSH_B, PULL_B, LEGS_B] },
};


function pick(slot: Slot, pool: Exercise[], usedToday: Set<string>, usedThisMeso: Set<string>): Exercise | undefined {
  const byMuscle = pool.filter((e) => e.primary === slot.muscle && !usedToday.has(e.id));
  const withPattern = slot.patterns ? byMuscle.filter((e) => slot.patterns!.includes(e.pattern)) : byMuscle;
  const candidates = withPattern.length ? withPattern : byMuscle;
  if (slot.patterns) candidates.sort((a, b) => slot.patterns!.indexOf(a.pattern) - slot.patterns!.indexOf(b.pattern) || 0);
  return candidates.find((e) => !usedThisMeso.has(e.id)) ?? candidates[0];
}

export function chooseLocation(profile: Profile): Location {
  const preferred = profile.training.defaultLocation;
  if (profile.equipment[preferred].available) return preferred;
  return preferred === "home" ? "gym" : "home";
}

/** A rule-based plan: a split for the day count, exercises chosen by equipment, conservative starting loads. */
export function fallbackMeso(profile: Profile, bodyWeightKg: number, avoid: string[] = []): MesoPlan {
  const count = Math.min(6, Math.max(2, profile.training.days.length));
  const split = SPLITS[count]!;
  const location = chooseLocation(profile);
  const loc = profile.equipment[location];
  const pool = availableExercises(loc, avoid);
  const usedThisMeso = new Set<string>();
  const unit = loadUnit(profile.units);
  const cap = maxSetsForMinutes(profile.training.sessionMinutes);

  const days: MesoDayPlan[] = split.days.map((t) => {
    const usedToday = new Set<string>();
    const exercises: MesoExercisePlan[] = [];
    for (const slot of t.slots) {
      const e = pick(slot, pool, usedToday, usedThisMeso);
      if (!e) continue;
      usedToday.add(e.id);
      usedThisMeso.add(e.id);
      const isolation = isIsolation(e);
      const focus = profile.training.focusMuscles.includes(e.primary);
      const sets = Math.min(4, (isolation ? 2 : 3) + (focus ? 1 : 0));
      exercises.push({
        exerciseId: e.id,
        sets,
        repMin: e.repMin,
        repMax: e.repMax,
        startWeight: suggestedStart(e, loc, unit, profile, bodyWeightKg),
        notes: "",
      });
    }
    trimToCap(exercises, cap);
    return { label: t.label, location, focus: t.focus, exercises };
  });

  return {
    name: `${split.name}`,
    split: split.name,
    weeks: profile.training.experience === "beginner" ? 4 : 5,
    rationale: "Built from the standard template for your training days and equipment while the coach was unavailable.",
    days,
  };
}

function suggestedStart(e: Exercise, loc: LocationEquipment, unit: "lb" | "kg", profile: Profile, bodyWeightKg: number): number | null {
  const raw = startingWeight(e, { bodyWeightKg, sex: profile.sex, experience: profile.training.experience, unit });
  if (raw == null) return null;
  return snapDown(raw, loadOptions(e, loc, unit));
}

function trimToCap(exercises: MesoExercisePlan[], cap: number) {
  let total = exercises.reduce((a, e) => a + e.sets, 0);
  for (let i = exercises.length - 1; total > cap && i >= 0; i--) {
    while (total > cap && exercises[i]!.sets > 2) {
      exercises[i]!.sets -= 1;
      total -= 1;
    }
  }
  while (total > cap && exercises.length > 2) {
    total -= exercises.pop()!.sets;
  }
}

/**
 * Other exercises for the same muscle available at `loc`: same movement pattern first, then the rest of
 * the muscle's exercises in library order.
 */
export function alternatives(exerciseId: string, loc: LocationEquipment, avoid: string[] = []): Exercise[] {
  const original = getExercise(exerciseId);
  if (!original) return [];
  const pool = EXERCISES.filter((e) => e.id !== exerciseId && e.primary === original.primary && isAvailable(e, loc) && !avoid.includes(e.id));
  return [...pool.filter((e) => e.pattern === original.pattern), ...pool.filter((e) => e.pattern !== original.pattern)];
}

export interface ValidationResult {
  plan: MesoPlan;
  issues: string[];
}

/**
 * Make a plan safe to store: known exercises only, each available where its day happens (swapped for
 * the closest alternative otherwise), sane rep ranges, loads that exist, and one day per training day.
 */
export function validateMeso(plan: MesoPlan, profile: Profile, bodyWeightKg: number): ValidationResult {
  const issues: string[] = [];
  const unit = loadUnit(profile.units);
  const wanted = profile.training.days.length;
  let days = plan.days;
  if (days.length > wanted) {
    issues.push(`Plan had ${days.length} days for ${wanted} training days; extra days dropped.`);
    days = days.slice(0, wanted);
  }
  if (days.length < wanted) throw new Error(`Plan has ${days.length} days but you train ${wanted} days a week.`);

  const cap = maxSetsForMinutes(profile.training.sessionMinutes);
  const fixedDays = days.map((day) => {
    let location = day.location;
    if (!profile.equipment[location].available) {
      location = location === "home" ? "gym" : "home";
      issues.push(`${day.label}: moved to ${location}, since the other location isn't available.`);
    }
    const loc = profile.equipment[location];
    const seen = new Set<string>();
    const exercises: MesoExercisePlan[] = [];
    for (const item of day.exercises) {
      let e = getExercise(item.exerciseId);
      if (!e) {
        issues.push(`${day.label}: unknown exercise ${item.exerciseId} dropped.`);
        continue;
      }
      if (!isAvailable(e, loc)) {
        const alt = alternatives(e.id, loc).find((a) => !seen.has(a.id));
        if (!alt) {
          issues.push(`${day.label}: ${e.name} isn't possible at ${location}; dropped.`);
          continue;
        }
        issues.push(`${day.label}: ${e.name} swapped for ${alt.name} (equipment).`);
        e = alt;
      }
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      const repMin = Math.max(3, Math.min(item.repMin, 30));
      const repMax = Math.max(repMin + 2, Math.min(item.repMax, 35));
      const loads = loadOptions(e, loc, unit);
      const start =
        e.loadType === "bodyweight"
          ? null
          : item.startWeight != null && item.startWeight > 0 && e.id === item.exerciseId
            ? snapDown(item.startWeight, loads)
            : suggestedStart(e, loc, unit, profile, bodyWeightKg);
      exercises.push({ exerciseId: e.id, sets: Math.max(1, Math.min(5, item.sets)), repMin, repMax, startWeight: start, notes: item.notes });
    }
    if (exercises.length < 2) throw new Error(`${day.label} has fewer than two usable exercises.`);
    trimToCap(exercises, cap);
    return { ...day, location, exercises };
  });

  return { plan: { ...plan, weeks: Math.max(3, Math.min(6, plan.weeks)), days: fixedDays }, issues };
}

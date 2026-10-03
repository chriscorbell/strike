import type { Macros, NutritionTargets, Profile, Units } from "./schemas.ts";
import { kgToLb, round, roundTo } from "./units.ts";

/** A weekly rate in the person's units, e.g. "1.0 lb/week". */
export function formatRate(kgPerWeek: number, units: Units = "metric"): string {
  return units === "imperial" ? `${round(kgToLb(kgPerWeek), 1).toFixed(1)} lb/week` : `${round(kgPerWeek, 2)} kg/week`;
}

export interface BodyStats {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: "male" | "female";
  bodyFatPercent: number | null;
}

/** Calories in a kilogram of body-weight change, the usual working figure. */
export const KCAL_PER_KG = 7700;

/** Non-exercise activity multipliers. Lifting is added separately on training days. */
const ACTIVITY: Record<Profile["activityLevel"], number> = {
  sedentary: 1.2,
  light: 1.35,
  moderate: 1.5,
  active: 1.65,
  very_active: 1.8,
};

/** Katch-McArdle when body fat is known, Mifflin-St Jeor otherwise. */
export function bmr(s: BodyStats): number {
  if (s.bodyFatPercent != null) {
    const leanKg = s.weightKg * (1 - s.bodyFatPercent / 100);
    return 370 + 21.6 * leanKg;
  }
  return 10 * s.weightKg + 6.25 * s.heightCm - 5 * s.age + (s.sex === "male" ? 5 : -161);
}

/** Net energy of a hypertrophy session: about 3.5 METs above rest across work and rest periods. */
export function sessionKcal(weightKg: number, minutes: number): number {
  return (3.5 * 3.5 * weightKg * minutes) / 200;
}

export function maintenance(s: BodyStats, activity: Profile["activityLevel"], sessionMinutes: number) {
  const rest = bmr(s) * ACTIVITY[activity];
  return { rest, training: rest + sessionKcal(s.weightKg, sessionMinutes) };
}

/** Navy tape-measure estimate. Needs waist and neck, plus hips for women. Inputs in cm. */
export function navyBodyFat(sex: "male" | "female", heightCm: number, waistCm: number, neckCm: number, hipsCm: number | null): number | null {
  if (sex === "male") {
    if (waistCm <= neckCm) return null;
    return round(495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) - 450, 1);
  }
  if (hipsCm == null || waistCm + hipsCm <= neckCm) return null;
  return round(495 / (1.29579 - 0.35004 * Math.log10(waistCm + hipsCm - neckCm) + 0.221 * Math.log10(heightCm)) - 450, 1);
}

/** Target weekly change in kg, negative when losing. */
export function targetRateKgPerWeek(goal: Profile["goal"], weightKg: number): number {
  if (goal.type === "maintain") return 0;
  const magnitude = (goal.ratePercentPerWeek / 100) * weightKg;
  return goal.type === "lose" ? -magnitude : magnitude;
}

/** The weight protein and fat are scaled by, so a heavier person isn't told to eat 300 g of protein. */
function referenceWeightKg(weightKg: number, heightCm: number): number {
  const h = heightCm / 100;
  return Math.min(weightKg, 27 * h * h);
}

function calorieFloor(s: BodyStats): number {
  return Math.max(s.sex === "male" ? 1500 : 1200, Math.round(bmr(s)));
}

function buildMacros(kcal: number, proteinG: number, fatG: number, fatFloorG: number): Macros {
  let fat = fatG;
  let carbs = (kcal - proteinG * 4 - fat * 9) / 4;
  if (carbs < 50) {
    // Fat gives way to keep a usable amount of carbohydrate, but never below its floor.
    const shortfall = (50 - carbs) * 4;
    fat = Math.max(fatFloorG, fat - shortfall / 9);
    carbs = Math.max(50, (kcal - proteinG * 4 - fat * 9) / 4);
  }
  const p = roundTo(proteinG, 5);
  const f = roundTo(fat, 5);
  const c = roundTo(carbs, 5);
  return { kcal: p * 4 + c * 4 + f * 9, proteinG: p, carbsG: c, fatG: f };
}

export interface TargetInputs {
  stats: BodyStats;
  profile: Pick<Profile, "goal" | "activityLevel" | "training"> & { units?: Units };
  effectiveDate: string;
}

/** Starting targets from body stats and goal. Training days get the session's energy as carbohydrate. */
export function initialTargets({ stats, profile, effectiveDate }: TargetInputs): NutritionTargets {
  const m = maintenance(stats, profile.activityLevel, profile.training.sessionMinutes);
  const rate = targetRateKgPerWeek(profile.goal, stats.weightKg);
  let delta = (rate * KCAL_PER_KG) / 7;
  // Keep a deficit under a quarter of maintenance and a surplus under 15%.
  delta = Math.max(-0.25 * m.rest, Math.min(0.15 * m.rest, delta));

  const ref = referenceWeightKg(stats.weightKg, stats.heightCm);
  const proteinG = Math.min(260, ref * (profile.goal.type === "lose" ? 2.2 : 2.0));
  const fatG = ref * (profile.goal.type === "lose" ? 0.7 : 0.8);
  const fatFloorG = ref * 0.5;
  const floor = calorieFloor(stats);

  const restKcal = Math.max(floor, m.rest + delta);
  const trainingKcal = Math.max(floor, m.training + delta);
  const direction = profile.goal.type === "maintain" ? "maintain" : profile.goal.type === "lose" ? "lose" : "gain";
  const reason =
    direction === "maintain"
      ? "Starting at estimated maintenance."
      : `Starting ${Math.abs(Math.round(delta))} kcal/day ${direction === "lose" ? "below" : "above"} estimated maintenance to ${direction} about ${formatRate(Math.abs(rate), profile.units)}.`;

  return {
    effectiveDate,
    training: buildMacros(trainingKcal, proteinG, fatG, fatFloorG),
    rest: buildMacros(restKcal, proteinG, fatG, fatFloorG),
    maintenanceKcal: { training: Math.round(m.training), rest: Math.round(m.rest) },
    reason,
  };
}

export interface AdjustmentInputs {
  current: NutritionTargets;
  stats: BodyStats;
  /** Measured weekly change of the trend weight, negative when losing. */
  rateKgPerWeek: number | null;
  targetRateKgPerWeek: number;
  /** Days between the first weigh-in and now. */
  daysOfData: number;
  /** Weigh-ins over the past seven days. */
  recentWeighIns: number;
  units?: Units;
}

export interface Adjustment {
  deltaKcal: number;
  reason: string;
}

/**
 * The weekly calorie correction: compare the trend's rate with the target rate and close half the
 * gap, at most 250 kcal/day in a week, ignoring differences inside the noise band.
 */
export function weeklyAdjustment(a: AdjustmentInputs): Adjustment {
  if (a.daysOfData < 14) return { deltaKcal: 0, reason: "Holding steady: two weeks of weigh-ins are needed before adjusting." };
  if (a.recentWeighIns < 4 || a.rateKgPerWeek == null) {
    return { deltaKcal: 0, reason: "Holding steady: weigh in at least four mornings a week so the trend is reliable." };
  }
  const error = a.rateKgPerWeek - a.targetRateKgPerWeek;
  const band = a.targetRateKgPerWeek === 0 ? 0.15 : 0.1;
  if (Math.abs(error) < band) return { deltaKcal: 0, reason: "On pace, so calories stay the same." };

  const raw = (-error * KCAL_PER_KG) / 7 / 2;
  const deltaKcal = Math.max(-250, Math.min(250, roundTo(raw, 25)));
  if (deltaKcal === 0) return { deltaKcal: 0, reason: "Close to pace, so calories stay the same." };
  const rateText = `${formatRate(a.rateKgPerWeek, a.units)} against a target of ${formatRate(a.targetRateKgPerWeek, a.units)}`;
  return {
    deltaKcal,
    reason: `${deltaKcal > 0 ? "Adding" : "Cutting"} ${Math.abs(deltaKcal)} kcal/day: trend is ${rateText}.`,
  };
}

/** Apply a calorie change through carbohydrate first, then fat, holding protein. */
export function applyAdjustment(current: NutritionTargets, deltaKcal: number, stats: BodyStats, effectiveDate: string, reason: string): NutritionTargets {
  const ref = referenceWeightKg(stats.weightKg, stats.heightCm);
  const floor = calorieFloor(stats);
  const shift = (m: Macros): Macros => {
    const kcal = Math.max(floor, m.kcal + deltaKcal);
    return buildMacros(kcal, m.proteinG, m.fatG, ref * 0.5);
  };
  return {
    effectiveDate,
    training: shift(current.training),
    rest: shift(current.rest),
    maintenanceKcal: current.maintenanceKcal,
    reason,
  };
}

export const sumMacros = (items: Macros[]): Macros =>
  items.reduce(
    (acc, m) => ({ kcal: acc.kcal + m.kcal, proteinG: acc.proteinG + m.proteinG, carbsG: acc.carbsG + m.carbsG, fatG: acc.fatG + m.fatG }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

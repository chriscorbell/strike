import { daysBetween, initialTargets, minutesNowIn, navyBodyFat, targetPlanWeek, type Measurements, type OnboardingRequest, type Profile, type StateResponse } from "@strike/core";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.ts";
import { coachEnabled } from "../coach/claude.ts";
import { saveStarterMenu } from "../coach/tasks.ts";
import { enqueue } from "./jobs.ts";
import { planWeekStart } from "./meals.ts";
import { bodyStats, getProfile, saveProfile, saveTargets, targetsOn, today } from "./profile.ts";
import { currentWeightKg, upsertWeight } from "./weights.ts";

export function state(): StateResponse {
  const profile = getProfile();
  const now = today(profile);
  return { onboarded: profile != null, profile, targets: profile ? targetsOn(now) : null, coachAvailable: coachEnabled(), today: now };
}

export function addMeasurements(profile: Profile, date: string, m: Measurements) {
  let bodyFatPercent = m.bodyFatPercent;
  if (bodyFatPercent == null && m.waistCm != null && m.neckCm != null) {
    bodyFatPercent = navyBodyFat(profile.sex, profile.heightCm, m.waistCm, m.neckCm, m.hipsCm);
  }
  // One entry per date: measuring again the same day replaces it.
  db.delete(schema.measurements).where(eq(schema.measurements.date, date)).run();
  return db.insert(schema.measurements).values({ date, data: { ...m, bodyFatPercent } }).returning().get();
}

export function onboard(req: OnboardingRequest): StateResponse {
  const { profile } = req;
  saveProfile(profile, true);
  const date = today(profile);
  upsertWeight(date, req.weightKg, "manual");
  if (req.measurements && Object.values(req.measurements).some((v) => v != null)) addMeasurements(profile, date, req.measurements);
  saveTargets(initialTargets({ stats: bodyStats(profile, req.weightKg, date), profile, effectiveDate: date }));
  enqueue("mesocycle", { reason: "Onboarding" });
  // Meals for today straight away; the coach then plans this week, or next week when this one is
  // nearly over or next week's prep evening has already come.
  const current = planWeekStart(profile, date);
  saveStarterMenu(profile, current);
  const target = targetPlanWeek(profile, date, minutesNowIn(profile.timezone));
  const daysLeft = 7 - daysBetween(current, date);
  if (target !== current) enqueue("meal_menu", { weekStart: target, reason: "Onboarding" });
  else if (daysLeft > 2) enqueue("meal_menu", { weekStart: current, reason: "Onboarding" });
  return state();
}

const changed = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);

export function updateProfile(next: Profile): StateResponse {
  const prev = getProfile();
  if (!prev) throw new Error("Not onboarded");
  saveProfile(next, false);
  const date = today(next);
  const energyInputs = (p: Profile) => [p.goal, p.activityLevel, p.training.sessionMinutes, p.sex, p.heightCm, p.birthDate];
  if (changed(energyInputs(prev), energyInputs(next))) {
    const weight = currentWeightKg(date);
    if (weight != null) {
      const t = initialTargets({ stats: bodyStats(next, weight, date), profile: next, effectiveDate: date });
      saveTargets({ ...t, reason: `Recalculated after a profile change. ${t.reason}` });
    }
  }
  if (prev.training.days.length !== next.training.days.length || changed(prev.equipment, next.equipment) || prev.training.experience !== next.training.experience) {
    enqueue("mesocycle", { reason: "Training setup changed" });
  }
  const foodInputs = (p: Profile) => [p.nutrition, p.schedule.wakeTime, p.schedule.sleepTime, p.training.workoutTime, p.training.days];
  if (changed(foodInputs(prev), foodInputs(next))) enqueue("meal_menu", { weekStart: planWeekStart(next, date), reason: "Food preferences changed" });
  return state();
}

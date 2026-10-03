// Plan weeks start on the profile's week-start day. Groceries are bought on the shopping day before it,
// and the check-in and the week's meal plan are prepared the evening before that.
import { addDays, parseTime, weekStartOn, weekdayOf } from "./dates.ts";
import type { Profile } from "./schemas.ts";

/** Local time on the eve of shopping day when next week's plan is prepared. */
export const PLAN_PREP_TIME = "18:00";

export const shoppingDayOf = (profile: Pick<Profile, "schedule">) => profile.schedule.shoppingDay ?? (profile.schedule.checkInDay + 6) % 7;

export const planWeekStart = (profile: Pick<Profile, "schedule">, date: string) => weekStartOn(date, profile.schedule.checkInDay);

/** The shopping date for the plan week starting `weekStart`: the last shopping day before it. */
export function shoppingDateFor(profile: Pick<Profile, "schedule">, weekStart: string): string {
  const back = (weekdayOf(weekStart) - shoppingDayOf(profile) + 7) % 7 || 7;
  return addDays(weekStart, -back);
}

/** When the week's check-in and plan are prepared: the evening before shopping day, as a local date and time. */
export function prepMomentFor(profile: Pick<Profile, "schedule">, weekStart: string): { date: string; time: string } {
  return { date: addDays(shoppingDateFor(profile, weekStart), -1), time: PLAN_PREP_TIME };
}

/** Whether a local date and minutes-since-midnight are at or past the prep moment for `weekStart`. */
export function isPastPrep(profile: Pick<Profile, "schedule">, weekStart: string, date: string, minutes: number): boolean {
  const prep = prepMomentFor(profile, weekStart);
  return date > prep.date || (date === prep.date && minutes >= parseTime(prep.time));
}

/**
 * The plan week being prepared for: next week once its prep moment has passed, otherwise the current
 * week.
 */
export function targetPlanWeek(profile: Pick<Profile, "schedule">, date: string, minutes: number): string {
  const current = planWeekStart(profile, date);
  const next = addDays(current, 7);
  return isPastPrep(profile, next, date, minutes) ? next : current;
}

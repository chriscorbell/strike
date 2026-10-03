// Plan-week schedule: the week starts on `checkInDay`; groceries are bought on `shoppingDay` (default the
// day before), and next week's plan and grocery list are prepared the evening before grocery day.
import type { Profile } from "@strike/core";

type Schedule = Profile["schedule"];
type Day = number;

const mod7 = (n: number) => ((n % 7) + 7) % 7;

export const defaultShoppingDay = (weekStart: Day) => mod7(weekStart - 1);

export const shoppingDayOf = (s: Schedule) => s.shoppingDay ?? defaultShoppingDay(s.checkInDay);

/** Grocery days you can pick: the six days before the week starts, in calendar order. */
export const shoppingDayChoices = (weekStart: Day) => [6, 5, 4, 3, 2, 1].map((back) => mod7(weekStart - back));

/** The day next week's plan is ready (in the evening). */
export const planReadyDay = (s: Schedule) => mod7(shoppingDayOf(s) - 1);

/**
 * Normalize a grocery-day choice: store nothing when it's the default (so it follows the week start),
 * and drop a choice that would fall on the start day.
 */
export function withShoppingDay(s: Schedule, shoppingDay: Day | undefined): Schedule {
  const rest: Schedule = { ...s };
  delete rest.shoppingDay;
  if (shoppingDay === undefined || shoppingDay === s.checkInDay || shoppingDay === defaultShoppingDay(s.checkInDay)) return rest;
  return { ...rest, shoppingDay };
}

/** Change the week start, keeping a custom grocery day only when it still makes sense. */
export const withWeekStart = (s: Schedule, weekStart: Day): Schedule => withShoppingDay({ ...s, checkInDay: weekStart }, s.shoppingDay);

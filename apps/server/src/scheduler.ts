import { minutesNowIn, targetPlanWeek } from "@strike/core";
import { checkInDue, runCheckIn } from "./services/checkins.ts";
import { enqueue, pendingJobs } from "./services/jobs.ts";
import { menuRowForWeek } from "./services/meals.ts";
import { getProfile, targetsOn, today } from "./services/profile.ts";
import { activeMeso } from "./services/training.ts";

/**
 * Keep the plan stocked: a training block always, and from the evening before shopping day, the weekly
 * check-in and next week's meal plan, so the grocery list is ready before the trip.
 */
export function tick() {
  const profile = getProfile();
  if (!profile) return;
  const now = today(profile);
  if (!targetsOn(now)) return;
  if (!activeMeso() && pendingJobs("mesocycle").length === 0) enqueue("mesocycle", { reason: "No active block" });
  if (checkInDue()) {
    // The check-in sets the new week's calories, then queues its meal plan.
    runCheckIn(null);
    return;
  }
  const week = targetPlanWeek(profile, now, minutesNowIn(profile.timezone));
  if (!menuRowForWeek(week) && pendingJobs("meal_menu").length === 0) enqueue("meal_menu", { weekStart: week, reason: "Plan week" });
}
export function startScheduler() {
  const run = () => {
    try {
      tick();
    } catch (err) {
      console.error("[scheduler]", err);
    }
  };
  run();
  return setInterval(run, 10 * 60_000);
}

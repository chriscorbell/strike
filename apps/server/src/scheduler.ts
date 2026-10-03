import { addDays } from "@strike/core";
import { checkInDue, runCheckIn } from "./services/checkins.ts";
import { enqueue, pendingJobs } from "./services/jobs.ts";
import { hasMenuForWeek, planWeekStart } from "./services/meals.ts";
import { getProfile, targetsOn, today } from "./services/profile.ts";
import { activeMeso } from "./services/training.ts";

/**
 * Keep the plan stocked: a mesocycle, this week's menu, and the weekly check-in once it's a day
 * overdue (normally Chris runs it from the app on check-in day).
 */
export function tick() {
  const profile = getProfile();
  if (!profile) return;
  const now = today(profile);
  if (!targetsOn(now)) return;
  if (!activeMeso() && pendingJobs("mesocycle").length === 0) enqueue("mesocycle", { reason: "No active block" });
  const weekStart = planWeekStart(profile, now);
  if (checkInDue(now)) {
    if (now >= addDays(weekStart, 1)) runCheckIn(null);
    return;
  }
  if (!hasMenuForWeek(profile, now) && pendingJobs("meal_menu").length === 0) enqueue("meal_menu", { weekStart, reason: "New week" });
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

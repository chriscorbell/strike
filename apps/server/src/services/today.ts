import { addDays, formatTime, isPastPrep, minutesNowIn, parseTime, planWeekStart, shoppingDateFor, type MealOption, type Profile, type TimelineItem, type TodayResponse } from "@strike/core";
import { checkInDue, latestCheckIn } from "./checkins.ts";
import { pendingJobs } from "./jobs.ts";
import { consumedOn, dayOverride, dayTypeOn, logsOn, menuRowFor, menuRowForWeek, optionsFor, plannedMeals, plannedOptionFor, toMenu, workoutTimeOn } from "./meals.ts";
import { requireProfile, targetsOn, today } from "./profile.ts";
import { activeMeso, ensureNextSession, sessionOnDate, sessionSetCount } from "./training.ts";
import { trendThrough, weightOn } from "./weights.ts";
import { HttpError } from "../http.ts";

export function dayView(date?: string): TodayResponse {
  const profile = requireProfile();
  const now = today(profile);
  const d = date ?? now;
  const targets = targetsOn(d);
  if (!targets) throw new HttpError(409, "No nutrition targets yet.");

  const dayType = dayTypeOn(profile, d);
  const dated = sessionOnDate(d);
  const next = ensureNextSession();
  // Today and later show the next session on training days; past days show only what happened.
  const session = dated && dated.status !== "skipped" ? dated : dayType === "training" && d >= now ? next : null;

  const workoutTime = workoutTimeOn(profile, d);
  const meals = plannedMeals(profile, d, dayType);
  const menuRow = menuRowFor(d);
  const menu = menuRow ? toMenu(menuRow) : null;
  const logs = logsOn(d);

  const timeline: TimelineItem[] = meals.map((m) => {
    const planned = plannedOptionFor(menu, d, m.slotIndex);
    const others = optionsFor(menu, dayType, m.slotIndex, d).filter((o) => o.id !== planned?.id);
    // With a plan, the planned dish leads and home dishes keep their order (no daily rotation).
    const options: MealOption[] = planned ? [planned, ...(menu?.slots.find((s) => s.dayType === dayType && s.slotIndex === m.slotIndex)?.options ?? others).filter((o) => o.id !== planned.id)] : others;
    return {
      kind: "meal",
      time: m.time,
      slotIndex: m.slotIndex,
      label: m.label,
      role: m.role,
      targets: m.targets,
      options,
      plannedOptionId: planned?.id ?? null,
      log: logs.find((l) => l.slotIndex === m.slotIndex) ?? null,
    };
  });
  if (session) {
    const counts = sessionSetCount(session.id);
    timeline.push({
      kind: "workout",
      time: workoutTime,
      endTime: formatTime(parseTime(workoutTime) + profile.training.sessionMinutes),
      sessionId: session.id,
      label: session.label,
      location: session.location,
      status: session.status,
      exerciseCount: counts.exercises,
      setCount: counts.sets,
    });
  }
  // Sort by clock time, treating times before waking as after midnight.
  const wake = parseTime(profile.schedule.wakeTime);
  const key = (t: string) => (parseTime(t) < wake ? parseTime(t) + 1440 : parseTime(t));
  timeline.sort((a, b) => key(a.time) - key(b.time));

  const meso = activeMeso();
  const sessionForMeso = session ?? next;
  const { series } = trendThrough(d);
  const point = series.find((p) => p.date === d);
  const override = dayOverride(d);

  return {
    date: d,
    dayType,
    workoutTimeOverride: override?.workoutTime ?? null,
    weight: { loggedKg: weightOn(d), trendKg: point?.trendKg ?? null },
    targets: targets[dayType],
    consumed: consumedOn(d),
    timeline,
    extraMeals: logs.filter((l) => l.slotIndex == null || l.slotIndex >= meals.length),
    meso:
      meso && sessionForMeso
        ? { id: meso.id, name: meso.plan.name, week: sessionForMeso.week, hardWeeks: meso.plan.weeks, isDeload: sessionForMeso.isDeload, targetRir: sessionForMeso.targetRir }
        : null,
    nextSession: next ? { id: next.id, label: next.label, location: next.location, week: next.week, dayIndex: next.dayIndex } : null,
    checkIn: { due: checkInDue(), latest: latestCheckIn() },
    pendingJobs: pendingJobs(),
    menuReady: menu != null,
    upcomingWeek: upcomingWeek(profile, now),
    prep: prepFor(d),
  };
}

/** Cooking sessions and reminders from the prep guides that cover this date. */
function prepFor(date: string): TodayResponse["prep"] {
  const rows = [menuRowFor(date), menuRowFor(addDays(date, 7))].filter((r, i, a): r is NonNullable<typeof r> => r != null && a.findIndex((x) => x?.id === r.id) === i);
  for (const row of rows) {
    const guide = row.data.prepGuide;
    if (!guide) continue;
    const sessions = guide.sessions
      .map((s, index) => ({ index, title: s.title, covers: s.covers, activeMinutes: s.activeMinutes, totalMinutes: s.totalMinutes, date: s.date }))
      .filter((s) => s.date === date)
      .map(({ date: _date, ...s }) => s);
    const reminders = guide.reminders.filter((r) => r.date === date).map((r) => ({ time: r.time, text: r.text }));
    if (sessions.length || reminders.length) return { menuId: row.id, sessions, reminders };
  }
  return null;
}

/** From the evening before shopping day until the week starts: whether next week's plan is ready. */
function upcomingWeek(profile: Profile, now: string): TodayResponse["upcomingWeek"] {
  const next = addDays(planWeekStart(profile, now), 7);
  if (!isPastPrep(profile, next, now, minutesNowIn(profile.timezone))) return null;
  const row = menuRowForWeek(next);
  const groceries = row ? toMenu(row, profile).groceryList.filter((g) => !g.staple) : [];
  return {
    weekStart: next,
    shoppingDate: shoppingDateFor(profile, next),
    ready: row != null,
    menuId: row?.id ?? null,
    itemCount: groceries.length,
    costUsd: Math.round(groceries.reduce((a, g) => a + g.costUsd, 0) * 100) / 100,
  };
}

export const tomorrow = (date: string) => addDays(date, 1);

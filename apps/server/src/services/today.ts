import { addDays, formatTime, parseTime, type TimelineItem, type TodayResponse } from "@strike/core";
import { checkInDue, latestCheckIn } from "./checkins.ts";
import { pendingJobs } from "./jobs.ts";
import { consumedOn, dayOverride, dayTypeOn, logsOn, menuRowFor, optionsFor, plannedMeals, toMenu, workoutTimeOn } from "./meals.ts";
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

  const timeline: TimelineItem[] = meals.map((m) => ({
    kind: "meal",
    time: m.time,
    slotIndex: m.slotIndex,
    label: m.label,
    role: m.role,
    targets: m.targets,
    options: optionsFor(menu, dayType, m.slotIndex, d),
    log: logs.find((l) => l.slotIndex === m.slotIndex) ?? null,
  }));
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
    checkIn: { due: checkInDue(now), latest: latestCheckIn() },
    pendingJobs: pendingJobs(),
    menuReady: menu != null,
  };
}

export const tomorrow = (date: string) => addDays(date, 1);

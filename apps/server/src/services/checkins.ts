import { desc, eq } from "drizzle-orm";
import { addDays, applyAdjustment, daysBetween, targetRateKgPerWeek, weekdayOf, weeklyAdjustment, type CheckIn } from "@strike/core";
import { db, schema } from "../db/index.ts";
import { enqueue } from "./jobs.ts";
import { mealAdherence, planWeekStart } from "./meals.ts";
import { bodyStats, onboardedAt, requireProfile, saveTargets, targetsOn, today } from "./profile.ts";
import { sessionsInRange } from "./training.ts";
import { trendThrough } from "./weights.ts";

type Row = typeof schema.checkins.$inferSelect;

export const toCheckIn = (r: Row): CheckIn => ({
  id: r.id,
  weekStart: r.weekStart,
  createdAt: r.createdAt,
  trendKg: r.trendKg,
  rateKgPerWeek: r.rateKgPerWeek,
  targetRateKgPerWeek: r.targetRateKgPerWeek,
  weighIns: r.weighIns,
  adjustmentKcal: r.adjustmentKcal,
  adjustmentReason: r.adjustmentReason,
  sessionsCompleted: r.sessionsCompleted,
  sessionsPlanned: r.sessionsPlanned,
  mealAdherence: r.mealAdherence,
  coachNote: r.coachNote,
  userNote: r.userNote,
});

export function listCheckIns(): CheckIn[] {
  return db.select().from(schema.checkins).orderBy(desc(schema.checkins.weekStart)).all().map(toCheckIn);
}

export function latestCheckIn(): CheckIn | null {
  const r = db.select().from(schema.checkins).orderBy(desc(schema.checkins.weekStart)).get();
  return r ? toCheckIn(r) : null;
}

/** Due once a plan week starts, if onboarding happened before that week began. */
export function checkInDue(date = today()): boolean {
  const profile = requireProfile();
  const start = planWeekStart(profile, date);
  const onboarded = onboardedAt();
  if (!onboarded || onboarded.slice(0, 10) >= start) return false;
  return db.select().from(schema.checkins).where(eq(schema.checkins.weekStart, start)).get() == null;
}

/**
 * The weekly check-in: measure last week's trend against the goal, change calories if needed, count
 * training and meal adherence, then ask the coach for a note and a fresh menu with the new targets.
 */
export function runCheckIn(userNote: string | null): CheckIn {
  const profile = requireProfile();
  const now = today(profile);
  const weekStart = planWeekStart(profile, now);
  const existing = db.select().from(schema.checkins).where(eq(schema.checkins.weekStart, weekStart)).get();
  if (existing) {
    if (userNote) db.update(schema.checkins).set({ userNote }).where(eq(schema.checkins.id, existing.id)).run();
    return toCheckIn({ ...existing, userNote: userNote ?? existing.userNote });
  }

  const prevStart = addDays(weekStart, -7);
  const prevEnd = addDays(weekStart, -1);
  const { entries, latest, rate } = trendThrough(now);
  const recent = entries.filter((e) => e.date > addDays(now, -7)).length;
  const daysOfData = entries.length ? daysBetween(entries[0]!.date, now) : 0;
  const weightKg = latest ?? entries.at(-1)?.weightKg ?? 0;
  const targetRate = targetRateKgPerWeek(profile.goal, weightKg);
  const current = targetsOn(now);

  let adjustmentKcal = 0;
  let adjustmentReason = "No targets yet.";
  if (current && weightKg > 0) {
    const stats = bodyStats(profile, weightKg, now);
    const adj = weeklyAdjustment({ current, stats, rateKgPerWeek: rate, targetRateKgPerWeek: targetRate, daysOfData, recentWeighIns: recent, units: profile.units });
    adjustmentKcal = adj.deltaKcal;
    adjustmentReason = adj.reason;
    if (adj.deltaKcal !== 0) saveTargets(applyAdjustment(current, adj.deltaKcal, stats, weekStart, adj.reason));
  }

  const done = sessionsInRange(prevStart, prevEnd).filter((s) => s.status === "completed").length;
  let planned = 0;
  for (let d = prevStart; d <= prevEnd; d = addDays(d, 1)) if (profile.training.days.includes(weekdayOf(d))) planned++;

  const row = db
    .insert(schema.checkins)
    .values({
      weekStart,
      trendKg: latest,
      rateKgPerWeek: rate,
      targetRateKgPerWeek: targetRate,
      weighIns: recent,
      adjustmentKcal,
      adjustmentReason,
      sessionsCompleted: done,
      sessionsPlanned: planned,
      mealAdherence: mealAdherence(profile, prevStart, prevEnd),
      userNote,
    })
    .returning()
    .get();

  enqueue("check_in_note", { checkInId: row.id });
  enqueue("meal_menu", { weekStart, reason: "Weekly check-in" });
  return toCheckIn(row);
}

export function setCheckInCoachNote(id: number, note: string) {
  db.update(schema.checkins).set({ coachNote: note }).where(eq(schema.checkins.id, id)).run();
}

export function checkInById(id: number): CheckIn | null {
  const r = db.select().from(schema.checkins).where(eq(schema.checkins.id, id)).get();
  return r ? toCheckIn(r) : null;
}

export function addCoachNote(note: string) {
  db.insert(schema.coachNotes).values({ note }).run();
}

export function recentCoachNotes(limit = 5): { note: string; createdAt: string }[] {
  return db.select().from(schema.coachNotes).orderBy(desc(schema.coachNotes.id)).limit(limit).all().reverse();
}

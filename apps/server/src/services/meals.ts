import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import {
  addDays,
  daysBetween,
  planMeals,
  sumMacros,
  weekStartOn,
  weekdayOf,
  type DayType,
  type MealHistoryDay,
  type MealLog,
  type MealLogRequest,
  type MealMenu,
  type MealOption,
  type MenuSlot,
  type PlannedMeal,
  type Profile,
} from "@strike/core";
import { db, schema } from "../db/index.ts";
import { HttpError, notFound } from "../http.ts";
import { requireProfile, targetsOn, today } from "./profile.ts";
import { sessionOnDate } from "./training.ts";

type MenuRow = typeof schema.menus.$inferSelect;

export const planWeekStart = (profile: Profile, date: string) => weekStartOn(date, profile.schedule.checkInDay);

export function toMenu(row: MenuRow): MealMenu {
  return { id: row.id, weekStart: row.weekStart, createdAt: row.createdAt, source: row.source, ...row.data };
}

/** The menu for the plan week holding `date`, or the most recent earlier one while a new one is built. */
export function menuRowFor(date: string): MenuRow | undefined {
  const profile = requireProfile();
  const start = planWeekStart(profile, date);
  return (
    db.select().from(schema.menus).where(eq(schema.menus.weekStart, start)).orderBy(desc(schema.menus.id)).get() ??
    db.select().from(schema.menus).where(lte(schema.menus.weekStart, start)).orderBy(desc(schema.menus.weekStart), desc(schema.menus.id)).get()
  );
}

export function hasMenuForWeek(profile: Profile, date: string): boolean {
  return db.select().from(schema.menus).where(eq(schema.menus.weekStart, planWeekStart(profile, date))).get() != null;
}

export function saveMenu(weekStart: string, source: "coach" | "fallback", data: MenuRow["data"]): MenuRow {
  return db.insert(schema.menus).values({ weekStart, source, data }).returning().get();
}

export function updateMenuData(id: number, data: MenuRow["data"]) {
  db.update(schema.menus).set({ data }).where(eq(schema.menus.id, id)).run();
}

export function dayOverride(date: string) {
  return db.select().from(schema.dayOverrides).where(eq(schema.dayOverrides.date, date)).get();
}

export function setDayOverride(date: string, patch: { workoutTime?: string | null; dayType?: DayType | null }) {
  const existing = dayOverride(date);
  const next = { workoutTime: existing?.workoutTime ?? null, dayType: existing?.dayType ?? null, ...patch };
  db.insert(schema.dayOverrides)
    .values({ date, ...next })
    .onConflictDoUpdate({ target: schema.dayOverrides.date, set: next })
    .run();
}

/** Training or rest: a session done that day decides; then a manual override; then the weekly schedule. */
export function dayTypeOn(profile: Profile, date: string): DayType {
  const s = sessionOnDate(date);
  if (s && (s.status === "completed" || s.status === "in_progress")) return "training";
  const o = dayOverride(date);
  if (o?.dayType) return o.dayType;
  return profile.training.days.includes(weekdayOf(date)) ? "training" : "rest";
}

export function workoutTimeOn(profile: Profile, date: string): string {
  return dayOverride(date)?.workoutTime ?? profile.training.workoutTime;
}

export function plannedMeals(profile: Profile, date: string, dayType: DayType): PlannedMeal[] {
  const targets = targetsOn(date);
  if (!targets) return [];
  return planMeals({
    wakeTime: profile.schedule.wakeTime,
    sleepTime: profile.schedule.sleepTime,
    mealsPerDay: profile.nutrition.mealsPerDay,
    workout: dayType === "training" ? { start: workoutTimeOn(profile, date), minutes: profile.training.sessionMinutes } : null,
    targets: targets[dayType],
  });
}

/** The default-day slots a menu is written for: the usual workout time on training days. */
export function menuSlotsTemplate(profile: Profile, date: string): Omit<MenuSlot, "options">[] {
  const targets = targetsOn(date);
  if (!targets) return [];
  const out: Omit<MenuSlot, "options">[] = [];
  for (const dayType of ["training", "rest"] as const) {
    const meals = planMeals({
      wakeTime: profile.schedule.wakeTime,
      sleepTime: profile.schedule.sleepTime,
      mealsPerDay: profile.nutrition.mealsPerDay,
      workout: dayType === "training" ? { start: profile.training.workoutTime, minutes: profile.training.sessionMinutes } : null,
      targets: targets[dayType],
    });
    for (const meal of meals) out.push({ dayType, slotIndex: meal.slotIndex, label: meal.label, role: meal.role, targets: meal.targets });
  }
  return out;
}

/** Rotate a slot's options by date so the featured choice changes through the week. */
export function optionsFor(menu: MealMenu | null, dayType: DayType, slotIndex: number, date: string): MealOption[] {
  const slot = menu?.slots.find((s) => s.dayType === dayType && s.slotIndex === slotIndex);
  if (!slot) return [];
  const k = Math.abs(daysBetween("2026-01-04", date));
  const rotate = (xs: MealOption[]) => (xs.length ? xs.map((_, i) => xs[(i + k) % xs.length]!) : xs);
  return [...rotate(slot.options.filter((o) => o.kind === "home")), ...rotate(slot.options.filter((o) => o.kind === "out"))];
}

function findOption(optionId: string): MealOption | null {
  const rows = db.select().from(schema.menus).orderBy(desc(schema.menus.id)).limit(8).all();
  for (const row of rows) {
    for (const slot of row.data.slots) {
      const found = slot.options.find((o) => o.id === optionId);
      if (found) return found;
    }
  }
  return null;
}

const toLog = (r: typeof schema.mealLogs.$inferSelect): MealLog => ({
  id: r.id,
  date: r.date,
  slotIndex: r.slotIndex,
  optionId: r.optionId,
  name: r.name,
  macros: r.macros,
  status: r.status,
  loggedAt: r.loggedAt,
});

export function logsOn(date: string): MealLog[] {
  return db.select().from(schema.mealLogs).where(eq(schema.mealLogs.date, date)).orderBy(asc(schema.mealLogs.loggedAt)).all().map(toLog);
}

export function logMeal(req: MealLogRequest): MealLog {
  let name: string;
  let macros = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  if (req.status === "skipped") {
    name = "Skipped";
  } else if (req.optionId) {
    const option = findOption(req.optionId);
    if (!option) throw new HttpError(400, "That meal option no longer exists.");
    name = option.name;
    macros = option.macros;
  } else if (req.custom) {
    name = req.custom.name;
    macros = req.custom.macros;
  } else {
    throw new HttpError(400, "Pick an option, describe what you ate, or mark the meal skipped.");
  }
  return db.transaction((tx) => {
    if (req.slotIndex != null) {
      tx.delete(schema.mealLogs).where(and(eq(schema.mealLogs.date, req.date), eq(schema.mealLogs.slotIndex, req.slotIndex))).run();
    }
    const row = tx
      .insert(schema.mealLogs)
      .values({ date: req.date, slotIndex: req.slotIndex, optionId: req.optionId, name, macros, status: req.status, loggedAt: new Date().toISOString() })
      .returning()
      .get();
    return toLog(row);
  });
}

export function deleteMealLog(id: number) {
  const row = db.select().from(schema.mealLogs).where(eq(schema.mealLogs.id, id)).get();
  if (!row) throw notFound("Meal log");
  db.delete(schema.mealLogs).where(eq(schema.mealLogs.id, id)).run();
}

export function consumedOn(date: string) {
  return sumMacros(logsOn(date).filter((l) => l.status === "eaten").map((l) => l.macros));
}

export function mealHistory(days: number): MealHistoryDay[] {
  const profile = requireProfile();
  const end = today(profile);
  const start = addDays(end, -days + 1);
  const rows = db.select().from(schema.mealLogs).where(and(gte(schema.mealLogs.date, start), lte(schema.mealLogs.date, end))).all().map(toLog);
  const out: MealHistoryDay[] = [];
  for (let d = end; d >= start; d = addDays(d, -1)) {
    const logs = rows.filter((r) => r.date === d);
    const dayType = dayTypeOn(profile, d);
    const targets = targetsOn(d);
    if (!targets) continue;
    out.push({ date: d, dayType, targets: targets[dayType], consumed: sumMacros(logs.filter((l) => l.status === "eaten").map((l) => l.macros)), logs });
  }
  return out;
}

/** Recent eating, for the coach: which options got picked and what was eaten off-plan. */
export function mealDigest(days = 14) {
  const end = today();
  const start = addDays(end, -days);
  return db
    .select()
    .from(schema.mealLogs)
    .where(and(gte(schema.mealLogs.date, start), lte(schema.mealLogs.date, end)))
    .orderBy(asc(schema.mealLogs.date))
    .all()
    .map((r) => `${r.date} slot ${r.slotIndex ?? "extra"}: ${r.status === "skipped" ? "skipped" : `${r.name} (${Math.round(r.macros.kcal)} kcal, ${Math.round(r.macros.proteinG)}P)`}`);
}

/** Share of planned meal slots logged as eaten over a date range, or null when nothing was logged. */
export function mealAdherence(profile: Profile, from: string, to: string): number | null {
  const rows = db.select().from(schema.mealLogs).where(and(gte(schema.mealLogs.date, from), lte(schema.mealLogs.date, to))).all();
  if (rows.length === 0) return null;
  const days = daysBetween(from, to) + 1;
  const eaten = rows.filter((r) => r.status === "eaten" && r.slotIndex != null).length;
  return Math.min(1, eaten / (days * profile.nutrition.mealsPerDay));
}

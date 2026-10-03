import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { DayType, GroceryCatalogItem, Location, Macros, MealMenu, MesoPlan, Muscle, NutritionTargets, Profile, Measurements, SessionStatus, JobKind } from "@strike/core";

const now = () => new Date().toISOString();

/**
 * A stored menu. `plan` and `catalog` arrived with day-by-day planning; older rows lack them and keep
 * the coach's own `groceryList`.
 */
export interface MenuData {
  slots: MealMenu["slots"];
  plan?: MealMenu["plan"];
  catalog?: GroceryCatalogItem[];
  groceryList?: { item: string; quantity: string; section: string; costUsd: number }[];
  prepTips: string[];
  coachNote: string;
}

/** A single row: Strike has one user. */
export const profile = sqliteTable("profile", {
  id: integer("id").primaryKey(),
  data: text("data", { mode: "json" }).$type<Profile>().notNull(),
  onboardedAt: text("onboarded_at").notNull(),
  updatedAt: text("updated_at").notNull().$defaultFn(now),
});

export const targets = sqliteTable("targets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  effectiveDate: text("effective_date").notNull(),
  data: text("data", { mode: "json" }).$type<NutritionTargets>().notNull(),
  createdAt: text("created_at").notNull().$defaultFn(now),
});

export const weights = sqliteTable("weights", {
  date: text("date").primaryKey(),
  weightKg: real("weight_kg").notNull(),
  source: text("source", { enum: ["manual", "healthkit"] }).notNull(),
  updatedAt: text("updated_at").notNull().$defaultFn(now),
});

export const measurements = sqliteTable("measurements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  data: text("data", { mode: "json" }).$type<Measurements>().notNull(),
  createdAt: text("created_at").notNull().$defaultFn(now),
});

export const mesocycles = sqliteTable("mesocycles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  plan: text("plan", { mode: "json" }).$type<MesoPlan>().notNull(),
  source: text("source", { enum: ["coach", "fallback"] }).notNull(),
  startDate: text("start_date").notNull(),
  status: text("status", { enum: ["active", "completed"] }).notNull(),
  createdAt: text("created_at").notNull().$defaultFn(now),
  completedAt: text("completed_at"),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mesoId: integer("meso_id").notNull().references(() => mesocycles.id),
    week: integer("week").notNull(),
    dayIndex: integer("day_index").notNull(),
    label: text("label").notNull(),
    location: text("location").$type<Location>().notNull(),
    status: text("status").$type<SessionStatus>().notNull(),
    date: text("date"),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    targetRir: integer("target_rir").notNull(),
    isDeload: integer("is_deload", { mode: "boolean" }).notNull(),
    createdAt: text("created_at").notNull().$defaultFn(now),
  },
  (t) => [uniqueIndex("sessions_slot").on(t.mesoId, t.week, t.dayIndex), index("sessions_date").on(t.date)],
);

export const sessionExercises = sqliteTable(
  "session_exercises",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: integer("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id").notNull(),
    order: integer("order").notNull(),
    repMin: integer("rep_min").notNull(),
    repMax: integer("rep_max").notNull(),
    targetWeight: real("target_weight"),
    /** Target reps per set; its length is the planned set count. */
    targetReps: text("target_reps", { mode: "json" }).$type<number[]>().notNull(),
    /** Sets planned before the session; sets past this were added during it. */
    plannedSets: integer("planned_sets"),
    targetRir: integer("target_rir").notNull(),
    notes: text("notes").notNull().default(""),
    prescriptionNote: text("prescription_note").notNull().default(""),
    maxedOut: integer("maxed_out", { mode: "boolean" }).notNull().default(false),
    substitutedFrom: text("substituted_from"),
    /** The plan's first-session load for this exercise, kept for re-prescribing. */
    startWeight: real("start_weight"),
  },
  (t) => [index("session_exercises_session").on(t.sessionId), index("session_exercises_exercise").on(t.exerciseId)],
);

export const setLogs = sqliteTable(
  "set_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionExerciseId: integer("session_exercise_id")
      .notNull()
      .references(() => sessionExercises.id, { onDelete: "cascade" }),
    setIndex: integer("set_index").notNull(),
    weight: real("weight"),
    reps: integer("reps").notNull(),
    rir: integer("rir"),
    loggedAt: text("logged_at").notNull().$defaultFn(now),
  },
  (t) => [uniqueIndex("set_logs_slot").on(t.sessionExerciseId, t.setIndex)],
);

export const feedback = sqliteTable(
  "feedback",
  {
    sessionId: integer("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    muscle: text("muscle").$type<Muscle>().notNull(),
    soreness: integer("soreness"),
    pump: integer("pump"),
    workload: integer("workload"),
    jointPain: integer("joint_pain", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.muscle] })],
);

export const menus = sqliteTable("menus", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  weekStart: text("week_start").notNull(),
  source: text("source", { enum: ["coach", "fallback"] }).notNull(),
  data: text("data", { mode: "json" }).$type<MenuData>().notNull(),
  createdAt: text("created_at").notNull().$defaultFn(now),
});

export const mealLogs = sqliteTable(
  "meal_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    slotIndex: integer("slot_index"),
    optionId: text("option_id"),
    name: text("name").notNull(),
    macros: text("macros", { mode: "json" }).$type<Macros>().notNull(),
    status: text("status", { enum: ["eaten", "skipped"] }).notNull(),
    loggedAt: text("logged_at").notNull().$defaultFn(now),
  },
  (t) => [index("meal_logs_date").on(t.date)],
);

export const dayOverrides = sqliteTable("day_overrides", {
  date: text("date").primaryKey(),
  workoutTime: text("workout_time"),
  dayType: text("day_type").$type<DayType>(),
});

export const checkins = sqliteTable("checkins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  weekStart: text("week_start").notNull().unique(),
  trendKg: real("trend_kg"),
  rateKgPerWeek: real("rate_kg_per_week"),
  targetRateKgPerWeek: real("target_rate_kg_per_week").notNull(),
  weighIns: integer("weigh_ins").notNull(),
  adjustmentKcal: integer("adjustment_kcal").notNull(),
  adjustmentReason: text("adjustment_reason").notNull(),
  sessionsCompleted: integer("sessions_completed").notNull(),
  sessionsPlanned: integer("sessions_planned").notNull(),
  mealAdherence: real("meal_adherence"),
  coachNote: text("coach_note"),
  userNote: text("user_note"),
  createdAt: text("created_at").notNull().$defaultFn(now),
});

export const coachNotes = sqliteTable("coach_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  note: text("note").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(now),
});

export const jobs = sqliteTable(
  "jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind").$type<JobKind>().notNull(),
    status: text("status", { enum: ["queued", "running", "succeeded", "failed"] }).notNull(),
    input: text("input", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    result: text("result", { mode: "json" }).$type<unknown>(),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: text("created_at").notNull().$defaultFn(now),
    updatedAt: text("updated_at").notNull().$defaultFn(now),
  },
  (t) => [index("jobs_status").on(t.status)],
);

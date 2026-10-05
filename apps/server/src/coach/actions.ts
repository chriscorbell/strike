// Changes Ask Coach can propose. Each wraps something the app already does. Proposing one checks it by
// applying it inside a transaction that is rolled back, so the coach hears about a bad id or a finished
// session straight away; Chris's Apply runs every proposed change of a reply together, for real.
import { z } from "zod";
import { addDays, DayType, getExercise, LocalDate, Location, Macros, TimeOfDay, weekdayOf, type CoachActionKind, type MealLog } from "@strike/core";
import { sqlite } from "../db/index.ts";
import type { StoredCoachAction } from "../db/schema.ts";
import { HttpError } from "../http.ts";
import { addCoachNote } from "../services/checkins.ts";
import { addAction, dismissEarlierProposals, messageRow, toMessage, updateMessage } from "../services/coach-chat.ts";
import { enqueue } from "../services/jobs.ts";
import { dayTypeOn, logMeal, menuRowFor, menuRowForWeek, plannedMeals, planWeekStart, setDayOverride, setPlannedOption } from "../services/meals.ts";
import { requireProfile, today } from "../services/profile.ts";
import * as training from "../services/training.ts";

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Tue Oct 7" */
export const dayLabel = (date: string) => `${DAY[weekdayOf(date)]} ${MONTH[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`;

/** "7:30 PM" */
export function clockLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

const Week = z.enum(["current", "next"]).describe("current is the plan week holding today; next is the coming one");
type Week = z.infer<typeof Week>;
const weekStartFor = (week: Week) => {
  const current = planWeekStart(requireProfile(), today());
  return week === "next" ? addDays(current, 7) : current;
};
const weekName = (week: Week) => (week === "next" ? "next week" : "this week");
const lines = (...parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" ") || null;

function slotLabel(date: string, slotIndex: number): string {
  const profile = requireProfile();
  return plannedMeals(profile, date, dayTypeOn(profile, date)).find((m) => m.slotIndex === slotIndex)?.label ?? `Meal ${slotIndex + 1}`;
}

function notPast(date: string) {
  if (date < today()) throw new HttpError(400, `${dayLabel(date)} has already passed.`);
}

interface ActionDef<S extends z.ZodRawShape, R> {
  /** For the coach: when to use it and what happens. */
  description: string;
  input: S;
  /** Does it. Returns what describe needs, and `jobId` when it starts coach work. */
  apply(input: z.infer<z.ZodObject<S>>): R;
  /** What applying it does, for Chris, from the input and a rolled-back trial run. */
  describe(input: z.infer<z.ZodObject<S>>, preview: R): { summary: string; detail: string | null };
}

const define = <S extends z.ZodRawShape, R>(def: ActionDef<S, R>) => def;

export const ACTIONS = {
  swap_meal: define({
    description:
      "Plan a different option for one meal: any option on that week's menu, home-cooked or grab-and-go (get_meal_plan lists them with ids). The grocery list follows the plan, so after shopping day pick options whose groceries were bought, or grab-and-go.",
    input: { date: LocalDate, slotIndex: z.number().int().min(0), optionId: z.string() },
    apply({ date, slotIndex, optionId }) {
      const row = menuRowFor(date);
      if (!row) throw new HttpError(400, `There's no meal plan for ${dayLabel(date)}.`);
      const menu = setPlannedOption(row.id, date, slotIndex, optionId);
      return menu.slots.flatMap((s) => s.options).find((o) => o.id === optionId)!;
    },
    describe({ date, slotIndex }, option) {
      return {
        summary: `${dayLabel(date)} · ${slotLabel(date, slotIndex)} → ${option.name}`,
        detail: option.kind === "out" ? lines(option.place && `${option.place}:`, option.order) : null,
      };
    },
  }),

  log_meal: define({
    description:
      "Log what Chris ate (or skipped) for a meal, today or earlier. Use a menu option id when that's what he ate; otherwise give a name and your honest macro estimate.",
    input: {
      date: LocalDate,
      slotIndex: z.number().int().min(0).nullable().describe("The meal slot; null for food outside the day's planned meals"),
      status: z.enum(["eaten", "skipped"]),
      optionId: z.string().nullable().describe("A menu option, when that's what was eaten"),
      custom: z.object({ name: z.string().min(1), macros: Macros }).nullable().describe("What was eaten when it isn't a menu option"),
    },
    apply(input): MealLog {
      if (input.date > today()) throw new HttpError(400, "Meals can only be logged for today or earlier.");
      return logMeal(input);
    },
    describe({ date, slotIndex }, log) {
      const meal = slotIndex == null ? "extra food" : slotLabel(date, slotIndex);
      if (log.status === "skipped") return { summary: `Log ${dayLabel(date)} · ${meal} as skipped`, detail: null };
      return { summary: `Log ${dayLabel(date)} · ${meal}: ${log.name}`, detail: `${Math.round(log.macros.kcal)} kcal, ${Math.round(log.macros.proteinG)} g protein` };
    },
  }),

  replan_meals: define({
    description:
      "Have the coach rewrite a week's meal plan in the background: about 20 minutes, then a fresh prep guide in about 8 more. keepGroceries plans the rest of the week only from what was already bought for it (after shopping day: missed cooking, changed plans, leftovers). Without it the plan comes with a new grocery list (before shopping).",
    input: {
      week: Week,
      keepGroceries: z.boolean(),
      note: z.string().max(2000).describe("What the coach writing the plan should know, e.g. 'Missed Sunday's cook; the chicken is frozen, so the first cook is Tuesday'"),
    },
    apply({ week, keepGroceries, note }) {
      const weekStart = weekStartFor(week);
      if (keepGroceries && !menuRowForWeek(weekStart)?.data.catalog) throw new HttpError(400, `${weekName(week)} has no grocery list to plan from.`);
      return { jobId: enqueue("meal_menu", { weekStart, note: note || null, keepGroceries, reason: "Ask Coach" }).id };
    },
    describe({ week, keepGroceries, note }) {
      return {
        summary: keepGroceries ? `Re-plan ${weekName(week)}'s meals from the groceries you bought` : `Rewrite ${weekName(week)}'s meal plan`,
        detail: lines(note, "Takes the coach about 20 minutes, then a new prep guide."),
      };
    },
  }),

  rewrite_prep_guide: define({
    description:
      "Have the coach rewrite a week's prep guide from today on (about 8 minutes): cooking days, containers, thaw reminders. Use when cooking didn't happen as planned. The note carries what it needs: what's frozen or already cooked, and when Chris can cook.",
    input: { week: Week, note: z.string().max(2000) },
    apply({ week, note }) {
      const row = week === "next" ? menuRowForWeek(weekStartFor("next")) : menuRowFor(today());
      if (!row || !(row.data.plan ?? []).length) throw new HttpError(400, `${weekName(week)} has no meal plan to prep from.`);
      return { jobId: enqueue("prep_guide", { menuId: row.id, note: note || null }).id };
    },
    describe({ week, note }) {
      return { summary: `Rewrite ${weekName(week)}'s prep guide from today`, detail: lines(note, "Takes the coach about 8 minutes.") };
    },
  }),

  set_day_type: define({
    description:
      "Make a date a training day or a rest day. Sessions run in order, so a rest day pushes the next session to the next training day. Moving a workout to another day is a rest day plus a training day. Meal targets follow the day type.",
    input: { date: LocalDate, dayType: DayType },
    apply({ date, dayType }) {
      notPast(date);
      setDayOverride(date, { dayType });
    },
    describe({ date, dayType }) {
      return { summary: `Make ${dayLabel(date)} a ${dayType} day`, detail: null };
    },
  }),

  set_workout_time: define({
    description: "Move the workout on a date to another time; that day's meal times shift around it.",
    input: { date: LocalDate, time: TimeOfDay.nullable().describe("HH:MM, 24-hour; null goes back to the usual time") },
    apply({ date, time }) {
      notPast(date);
      setDayOverride(date, { workoutTime: time });
    },
    describe({ date, time }) {
      return { summary: time ? `Move ${dayLabel(date)}'s workout to ${clockLabel(time)}` : `Put ${dayLabel(date)}'s workout back at the usual time`, detail: "Meal times shift to fit around it." };
    },
  }),

  swap_exercise: define({
    description:
      "Replace one exercise in a session before any of its sets are logged, with one from get_exercise_options. permanent changes it for the rest of the block too. Its loads then come from its own history or a starting estimate.",
    input: { sessionId: z.number().int().positive(), sessionExerciseId: z.number().int().positive(), exerciseId: z.string(), permanent: z.boolean() },
    apply({ sessionId, sessionExerciseId, exerciseId, permanent }) {
      const before = training.sessionView(sessionId).exercises.find((e) => e.id === sessionExerciseId);
      const session = training.swapExercise(sessionId, sessionExerciseId, exerciseId, permanent);
      return { label: session.label, from: before?.name ?? "exercise" };
    },
    describe({ exerciseId, permanent }, { label, from }) {
      return { summary: `${label}: ${from} → ${getExercise(exerciseId)?.name ?? exerciseId}`, detail: permanent ? "For the rest of the block." : "This session only." };
    },
  }),

  set_session_location: define({
    description: "Do a session at home or at the gym. Exercises that location can't support are swapped and loads re-set; logged ones stay.",
    input: { sessionId: z.number().int().positive(), location: Location },
    apply({ sessionId, location }) {
      return training.setLocation(sessionId, location);
    },
    describe({ location }, session) {
      return { summary: `Do ${session.label} at ${location === "gym" ? "the gym" : "home"}`, detail: "Exercises it can't support are swapped." };
    },
  }),

  skip_session: define({
    description:
      "Skip a session that isn't finished: the block moves on and it isn't made up. Usually leave a missed session alone instead; it waits for the next training day.",
    input: { sessionId: z.number().int().positive() },
    apply({ sessionId }) {
      return training.skipSession(sessionId);
    },
    describe(_input, session) {
      return { summary: `Skip ${session.label} (week ${session.week + 1})`, detail: "The block moves on to the next session." };
    },
  }),

  new_block: define({
    description: "Have the coach write a new training block (about 2 minutes). It replaces the current block from the next session on; the note says what to change and why.",
    input: { note: z.string().min(1).max(2000) },
    apply({ note }) {
      return { jobId: enqueue("mesocycle", { note, reason: "Ask Coach" }).id };
    },
    describe({ note }) {
      return { summary: "Write a new training block", detail: lines(note, "Takes the coach about 2 minutes and starts with your next session.") };
    },
  }),

  save_note: define({
    description: "Save a lasting note that every plan the coach writes later will read: an injury, travel, a food change. For facts that should outlive this conversation.",
    input: { note: z.string().min(1).max(2000) },
    apply({ note }) {
      addCoachNote(note);
    },
    describe({ note }) {
      return { summary: `Remember: ${note}`, detail: "Future training blocks and meal plans take it into account." };
    },
  }),
} satisfies Record<CoachActionKind, ActionDef<any, any>>;

const ROLLBACK = Symbol("rollback");

/** Runs `fn` inside a transaction and undoes everything it wrote. */
function dryRun<T>(fn: () => T): T {
  let out: T | undefined;
  try {
    sqlite.transaction(() => {
      out = fn();
      throw ROLLBACK;
    })();
  } catch (err) {
    if (err !== ROLLBACK) throw err;
  }
  return out as T;
}

let counter = 0;

/**
 * Records a change the coach proposed on a reply, after checking that it would apply now. A reply's
 * first proposal replaces any earlier ones in the conversation that weren't applied.
 */
export function propose(messageId: number, kind: CoachActionKind, raw: unknown): StoredCoachAction {
  const def = ACTIONS[kind] as ActionDef<z.ZodRawShape, unknown>;
  const input = z.object(def.input).parse(raw);
  const preview = dryRun(() => def.apply(input));
  const { summary, detail } = def.describe(input, preview);
  const action: StoredCoachAction = { id: `a${Date.now().toString(36)}${(counter++).toString(36)}`, kind, summary, detail, status: "proposed", jobId: null, input };
  const row = messageRow(messageId);
  if (!row.actions.length) dismissEarlierProposals(row.threadId, messageId);
  addAction(messageId, action);
  return action;
}

/** Applies every change still proposed on a reply, all or none. */
export function applyActions(messageId: number) {
  const row = messageRow(messageId);
  if (row.status === "pending") throw new HttpError(409, "The coach is still writing this reply.");
  if (!row.actions.some((a) => a.status === "proposed")) throw new HttpError(409, "There's nothing left to apply on this reply.");
  sqlite.transaction(() => {
    const actions = row.actions.map((a) => {
      if (a.status !== "proposed") return a;
      const def = ACTIONS[a.kind] as ActionDef<z.ZodRawShape, unknown>;
      let result: unknown;
      try {
        result = def.apply(z.object(def.input).parse(a.input));
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new HttpError(409, `Couldn't apply "${a.summary}": ${reason}`);
      }
      const jobId = typeof result === "object" && result && "jobId" in result && typeof result.jobId === "number" ? result.jobId : null;
      return { ...a, status: "applied" as const, jobId };
    });
    updateMessage(messageId, { actions });
  })();
  return toMessage(messageRow(messageId));
}

export function dismissActions(messageId: number) {
  const row = messageRow(messageId);
  updateMessage(messageId, { actions: row.actions.map((a) => (a.status === "proposed" ? { ...a, status: "dismissed" as const } : a)) });
  return toMessage(messageRow(messageId));
}

// Job handlers for coach work. Each tries Claude (when enabled) and falls back to the rule-based
// generators, so the app always has a plan, a menu and a note even when the coach is out of reach.
import { z } from "zod";
import {
  addDays,
  EXERCISE_IDS,
  DayType,
  fallbackMeso,
  loadUnit,
  Location,
  Macros,
  shoppingDateFor,
  validateMeso,
  weekdayOf,
  type MealOption,
  type MenuSlot,
  type MesoPlan,
  type PlanDay,
  type Profile,
} from "@strike/core";
import { env } from "../env.ts";
import { checkInById, setCheckInCoachNote } from "../services/checkins.ts";
import { registerHandler } from "../services/jobs.ts";
import { dayTypeOn, menuRowFor, menuSlotsTemplate, plannedMeals, planWeekStart, saveMenu, toMenu, updateMenuData } from "../services/meals.ts";
import type { MenuData } from "../db/index.ts";
import { requireProfile, today } from "../services/profile.ts";
import { activeMeso, createMeso, ensureNextSession } from "../services/training.ts";
import { currentWeightKg } from "../services/weights.ts";
import { askClaude, coachEnabled } from "./claude.ts";
import { exerciseCatalog, mealHistoryContext, personContext, SYSTEM, trainingHistoryContext } from "./context.ts";
import { fallbackCatalog, fallbackOptions } from "./fallback-meals.ts";

async function withFallback<T>(label: string, viaCoach: () => Promise<T>, fallback: () => T): Promise<{ value: T; source: "coach" | "fallback"; reason?: string }> {
  if (!coachEnabled()) return { value: fallback(), source: "fallback", reason: `Coach mode is ${env.coach}.` };
  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return { value: await viaCoach(), source: "coach" };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[coach] ${label} attempt ${attempt} failed: ${lastError}`);
    }
  }
  return { value: fallback(), source: "fallback", reason: lastError };
}

// ---------- Mesocycle ----------

const MesoOut = z.object({
  name: z.string().describe("Short name for the block, e.g. 'Block 2: Upper/Lower Hypertrophy'"),
  split: z.string(),
  weeks: z.number().int().min(3).max(6).describe("Hard weeks before the deload week"),
  rationale: z.string().describe("Two or three sentences on why this plan fits"),
  days: z.array(
    z.object({
      label: z.string(),
      location: Location,
      focus: z.string(),
      exercises: z.array(
        z.object({
          exerciseId: z.enum(EXERCISE_IDS),
          sets: z.number().int().min(1).max(5),
          repMin: z.number().int().min(4).max(30),
          repMax: z.number().int().min(6).max(35),
          startWeight: z.number().nullable().describe("First-session load in the load unit (per dumbbell), aiming for ~3 reps in reserve at the middle of the rep range; null for bodyweight"),
          notes: z.string().describe("Optional short setup or technique note; empty string if none"),
        }),
      ),
    }),
  ),
});

async function mesoHandler(input: Record<string, unknown>) {
  const profile = requireProfile();
  const bw = currentWeightKg(today(profile)) ?? 80;
  const previous = activeMeso();
  const days = profile.training.days.length;
  const note = typeof input.note === "string" && input.note ? input.note : null;
  const result = await withFallback(
    "mesocycle",
    async () => {
      const prompt = [
        personContext(profile),
        trainingHistoryContext(),
        previous ? `## Current block\n${JSON.stringify({ name: previous.plan.name, split: previous.plan.split, days: previous.plan.days.map((d) => ({ label: d.label, location: d.location, exercises: d.exercises.map((e) => `${e.exerciseId} ${e.sets}x${e.repMin}-${e.repMax}`) })) })}` : "## Current block\nNone. This is the first block.",
        exerciseCatalog(profile),
        "## Task",
        `Write the next mesocycle. It needs exactly ${days} training days, in weekly order, one per lifting day. Label days by content (e.g. "Upper A"), never by weekday: a missed session slides to the next lifting day.`,
        `- Pick each day's location (home or gym) and only use exercises available there. Prefer ${profile.training.defaultLocation} unless the other location clearly serves the day better.`,
        `- Fit each session in about ${profile.training.sessionMinutes} minutes: roughly 2.5 minutes per working set including rest, so no more than ${Math.floor(profile.training.sessionMinutes / 2.5)} sets per day.`,
        "- Week-one volume near minimum effective volume: about 2-3 sets per exercise, roughly 8-12 weekly sets for big muscles and 6-8 for smaller ones; the app adds sets from feedback as the block goes on. Give focus muscles a little more.",
        "- Hit every major muscle at least twice a week when the day count allows. Order compound movements before isolation work.",
        "- Starting loads: conservative estimates for this person's size, sex and experience; when recent training shows the exercise, use those numbers.",
        previous ? "- Keep exercises that are progressing well; rotate stalled ones or ones with joint pain, about a third of the plan." : "",
        note ? `- ${profile.name} asked: ${note}` : "",
        `- Loads in ${loadUnit(profile.units)}.`,
      ]
        .filter(Boolean)
        .join("\n");
      const out = await askClaude({ label: "mesocycle", system: SYSTEM, prompt, schema: MesoOut });
      return validateMeso(out as MesoPlan, profile, bw).plan;
    },
    () => fallbackMeso(profile, bw),
  );
  const meso = createMeso(result.value, result.source, today(profile));
  ensureNextSession();
  return { mesoId: meso.id, source: result.source, reason: result.reason ?? null };
}

// ---------- Weekly meal plan ----------

const IngredientOut = z.object({
  item: z.string(),
  amount: z.string().describe("As a cook reads it, e.g. '5 oz cooked (about 6.5 oz raw)'"),
  groceryId: z.string().describe("The catalog id this is bought as"),
  quantity: z.number().describe("Amount in that catalog item's unit as purchased: raw weight for meat, dry weight for rice and pasta"),
});

const OptionOut = z.object({
  kind: z.enum(["home", "out"]),
  name: z.string(),
  summary: z.string().describe("One short line"),
  place: z.string().nullable().describe("For grab-and-go: where to buy it. Null for home."),
  order: z.string().nullable().describe("For grab-and-go: exactly what to order, with customizations. Null for home."),
  ingredients: z.array(IngredientOut).describe("Home options: every ingredient. Empty for grab-and-go."),
  steps: z.array(z.string()).describe("Home options: at most four short steps. Empty for grab-and-go."),
  prepMinutes: z.number().int(),
  costUsd: z.number().describe("Approximate cost of this one meal in USD"),
  macros: Macros,
});

const CatalogOut = z.object({
  id: z.string().describe("Short slug, e.g. 'chicken_breast'"),
  name: z.string(),
  section: z.string().describe("Store section: Produce, Meat, Seafood, Dairy & eggs, Frozen, Bakery, Pantry"),
  unit: z.enum(["g", "ml", "piece"]),
  pieceName: z.string().describe("For piece items, the plural noun for one unit (slices, cans, eggs); empty string otherwise"),
  packageSize: z.number().positive().describe("Size of the package you'd buy, in unit"),
  packageLabel: z.string().describe("Short: size and container only, e.g. '15 oz can', '32 oz tub', '3 lb family pack', 'dozen'. No notes or conversions."),
  packagePrice: z.number().describe("Typical US grocery price for one package, USD"),
  staple: z.boolean().describe("A pantry item most kitchens keep on hand: oil, spices, condiments, bulk rice or oats"),
});

const MenuOut = z.object({
  catalog: z.array(CatalogOut),
  slots: z.array(z.object({ dayType: DayType, slotIndex: z.number().int(), options: z.array(OptionOut).min(2).max(6) })),
  plan: z.array(
    z.object({
      date: z.string(),
      meals: z.array(z.object({ slotIndex: z.number().int(), option: z.number().int().describe("Index into that day type's slot options; must be a home option") })),
    }),
  ),
  prepTips: z.array(z.string()),
  coachNote: z.string(),
});

interface PlanDate {
  date: string;
  dayType: DayType;
}

/** The days a week's plan covers: all seven, or the rest of the week when it has already started. */
export function planDates(profile: Profile, weekStart: string): PlanDate[] {
  const now = today(profile);
  const out: PlanDate[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    if (date >= now) out.push({ date, dayType: dayTypeOn(profile, date) });
  }
  return out;
}

/** Batch-friendly default: each meal's first home option early in the week, its second later. */
function defaultPlan(slots: MenuSlot[], dates: PlanDate[]): PlanDay[] {
  const half = Math.ceil(dates.length / 2);
  return dates.map((d, i) => ({
    date: d.date,
    dayType: d.dayType,
    meals: slots
      .filter((s) => s.dayType === d.dayType)
      .map((s) => {
        const homes = s.options.filter((o) => o.kind === "home");
        const pick = homes[i < half ? 0 : Math.min(1, homes.length - 1)] ?? s.options[0]!;
        return { slotIndex: s.slotIndex, optionId: pick.id };
      }),
  }));
}

function fallbackMenu(profile: Profile, template: Omit<MenuSlot, "options">[], weekStart: string, dates: PlanDate[]): MenuData {
  const slots: MenuSlot[] = template.map((s, i) => ({ ...s, options: fallbackOptions(profile, s.role, s.targets, `f${weekStart.replaceAll("-", "")}-${s.dayType[0]}${s.slotIndex}`, i, s.label) }));
  return {
    slots,
    plan: defaultPlan(slots, dates),
    catalog: fallbackCatalog(),
    prepTips: ["Cook the week's protein and rice in two batches: on the first day of the week and midweek.", "Keep a couple of ready-to-drink protein shakes on hand for rushed days."],
    coachNote: "A simple rule-based plan while the coach is unavailable. Portions are sized to your targets.",
  };
}

/** A rule-based plan saved immediately, so the first days have meals while the coach writes the real one. */
export function saveStarterMenu(profile: Profile, weekStart: string) {
  const dates = planDates(profile, weekStart);
  const template = menuSlotsTemplate(profile, dates[0]?.date ?? weekStart);
  if (template.length && dates.length) saveMenu(weekStart, "fallback", fallbackMenu(profile, template, weekStart, dates));
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function menuHandler(input: Record<string, unknown>) {
  const profile = requireProfile();
  const now = today(profile);
  const weekStart = typeof input.weekStart === "string" ? input.weekStart : planWeekStart(profile, now);
  const dates = planDates(profile, weekStart);
  if (dates.length === 0) return { skipped: "That week is over." };
  const template = menuSlotsTemplate(profile, dates[0]!.date);
  if (template.length === 0) throw new Error("No nutrition targets yet.");
  const note = typeof input.note === "string" && input.note ? input.note : null;
  const shopping = shoppingDateFor(profile, weekStart);
  const result = await withFallback<MenuData>(
    "meal plan",
    async () => {
      const slotText = template
        .map((s) => `- ${s.dayType} day, slot ${s.slotIndex}: ${s.label} (${s.role.replace("_", "-")}) target ${Math.round(s.targets.kcal)} kcal, ${s.targets.proteinG} P / ${s.targets.carbsG} C / ${s.targets.fatG} F`)
        .join("\n");
      const dayText = dates.map((d) => `- ${DAY_NAMES[weekdayOf(d.date)]} ${d.date}: ${d.dayType} day`).join("\n");
      const prompt = [
        personContext(profile),
        mealHistoryContext(),
        "## Meal slots",
        slotText,
        "## Days to plan",
        dayText,
        "## Task",
        `Write ${profile.name}'s meal plan for ${dates.length === 7 ? "the week" : "the rest of the week"} starting ${dates[0]!.date}. ${dates[0]!.date > now ? `They shop once, on ${shopping}, for the whole week.` : "They shop today for these days."}`,
        "- slots: for every slot above, 2 home options and 2 grab-and-go options, each within about 10% of the slot's targets (protein matters most).",
        "- Home options are the dishes the plan uses. Build the week from 3 to 5 distinct dishes that batch-cook well, reused across slots and days; when a dish serves two slots, it appears as an option in each with portions sized to that slot.",
        "- plan: for every date listed, one home option (by its index in that day type's slot) for every slot of its day type. Repeat dishes across days. Cooked food keeps about four days, so plan two cooking sessions (the first day and midweek); one grocery trip must cover the week, so favor food that keeps: frozen vegetables and fruit, sturdy produce, eggs, dairy, canned goods.",
        "- catalog: every ingredient the home options use, listed once, with how a typical US grocery store sells it and the price. Mark pantry staples.",
        "- Every home-option ingredient names its catalog groceryId and quantity in that item's unit, as purchased.",
        `- Keep the week's groceries, not counting staples, within about $${profile.nutrition.weeklyBudgetUsd}. Respect the cooking time and kitchen.`,
        `- Grab-and-go options: specific orders at ${profile.nutrition.grabAndGo.join(", ") || "common chains"}, or any grocery or convenience store, with realistic nutrition and price. They're the backup for busy days and need no groceries.`,
        "- Pre-workout meals light and carb-forward; post-workout meals carb- and protein-rich; bedtime meals protein-rich.",
        "- Lean on what was actually eaten recently, and drop dishes that were skipped.",
        "- prepTips: the batch-cooking schedule, what to cook on which day, at most four short tips. coachNote: one or two sentences.",
        note ? `- ${profile.name} asked: ${note}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const out = await askClaude({ label: "meal plan", system: SYSTEM, prompt, schema: MenuOut, timeoutMs: 45 * 60_000 });
      const stamp = Date.now().toString(36);
      const slots: MenuSlot[] = template.map((s) => {
        const match = out.slots.find((o) => o.dayType === s.dayType && o.slotIndex === s.slotIndex);
        const options = (match?.options ?? []).map((o, i) => ({ ...o, id: `c${weekStart.replaceAll("-", "")}-${s.dayType[0]}${s.slotIndex}-${i}-${stamp}` }));
        return { ...s, options: options.length ? options : fallbackOptions(profile, s.role, s.targets, `f-${s.dayType[0]}${s.slotIndex}-${stamp}`, 0, s.label) };
      });
      const fallback = defaultPlan(slots, dates);
      const plan: PlanDay[] = fallback.map((day) => {
        const written = out.plan.find((p) => p.date === day.date);
        return {
          ...day,
          meals: day.meals.map((meal) => {
            const index = written?.meals.find((m) => m.slotIndex === meal.slotIndex)?.option;
            const option = index != null ? slots.find((s) => s.dayType === day.dayType && s.slotIndex === meal.slotIndex)?.options[index] : undefined;
            return option?.kind === "home" ? { slotIndex: meal.slotIndex, optionId: option.id } : meal;
          }),
        };
      });
      return { slots, plan, catalog: out.catalog, prepTips: out.prepTips.slice(0, 6), coachNote: out.coachNote } satisfies MenuData;
    },
    () => fallbackMenu(profile, template, weekStart, dates),
  );
  const row = saveMenu(weekStart, result.source, result.value);
  return { menuId: row.id, source: result.source, reason: result.reason ?? null };
}

// ---------- More options for one slot ----------

async function moreOptionsHandler(input: Record<string, unknown>) {
  const profile = requireProfile();
  const date = String(input.date);
  const slotIndex = Number(input.slotIndex);
  const dayType = dayTypeOn(profile, date);
  const meal = plannedMeals(profile, date, dayType).find((m) => m.slotIndex === slotIndex);
  if (!meal) throw new Error("That meal slot doesn't exist.");
  const row = menuRowFor(date);
  if (!row) throw new Error("There's no menu yet.");
  const menu = toMenu(row);
  const slot = menu.slots.find((s) => s.dayType === dayType && s.slotIndex === slotIndex);
  const existing = slot?.options.map((o) => o.name) ?? [];
  const catalog = row.data.catalog ?? [];
  const stamp = Date.now().toString(36);
  const result = await withFallback(
    "more options",
    async () => {
      const prompt = [
        personContext(profile),
        mealHistoryContext(),
        catalog.length ? `## This week's grocery catalog\n${catalog.map((c) => `- ${c.id}: ${c.name} (${c.unit}, sold as ${c.packageLabel})`).join("\n")}` : "",
        "## Task",
        `Suggest 3 new options for ${meal.label} (${meal.role.replace("_", "-")}) on a ${dayType} day: target ${Math.round(meal.targets.kcal)} kcal, ${meal.targets.proteinG} g protein, ${meal.targets.carbsG} g carbs, ${meal.targets.fatG} g fat.`,
        `Different from: ${existing.join("; ") || "nothing yet"}. Mix home and grab-and-go. Keep them cheap and simple; home options should use what's already in the catalog where they can.`,
        "Home ingredients name a catalog groceryId and quantity as purchased; add any new grocery items to `catalog`.",
      ]
        .filter(Boolean)
        .join("\n");
      const out = await askClaude({
        label: "more options",
        system: SYSTEM,
        prompt,
        schema: z.object({ options: z.array(OptionOut).min(1).max(4), catalog: z.array(CatalogOut) }),
      });
      return { options: out.options.map((o, i) => ({ ...o, id: `x${row.id}-${dayType[0]}${slotIndex}-${stamp}-${i}` })), catalog: out.catalog };
    },
    () => ({ options: fallbackOptions(profile, meal.role, meal.targets, `x${row.id}-${dayType[0]}${slotIndex}-${stamp}`, existing.length + 1, meal.label), catalog: fallbackCatalog() }),
  );
  const options: MealOption[] = result.value.options;
  const data = structuredClone(row.data);
  const target = data.slots.find((s) => s.dayType === dayType && s.slotIndex === slotIndex);
  if (target) {
    target.options.push(...options);
    if (data.catalog) {
      const known = new Set(data.catalog.map((c) => c.id));
      data.catalog.push(...result.value.catalog.filter((c) => !known.has(c.id)));
    }
    updateMenuData(row.id, data);
  }
  return options;
}

// ---------- Estimate what was eaten ----------

const EstimateOut = z.object({ name: z.string().describe("A short name for the meal"), macros: Macros });

async function estimateHandler(input: Record<string, unknown>) {
  const description = String(input.description ?? "").slice(0, 1000);
  if (env.coach === "mock") return { name: description.slice(0, 60), macros: { kcal: 600, proteinG: 35, carbsG: 60, fatG: 22 } };
  if (!coachEnabled()) throw new Error("The coach isn't available; enter the macros yourself.");
  return askClaude({
    label: "estimate meal",
    system: SYSTEM,
    prompt: `Estimate the nutrition of this meal as eaten. Use known nutrition facts for chain restaurant items and typical portions otherwise.\n\nMeal: ${description}`,
    schema: EstimateOut,
    timeoutMs: 10 * 60_000,
  });
}

// ---------- Check-in note ----------

async function checkInNoteHandler(input: Record<string, unknown>) {
  const profile = requireProfile();
  const checkIn = checkInById(Number(input.checkInId));
  if (!checkIn) throw new Error("Check-in not found.");
  const result = await withFallback(
    "check-in note",
    async () => {
      const prompt = [
        personContext(profile),
        trainingHistoryContext(),
        mealHistoryContext(),
        "## This week's check-in",
        JSON.stringify(checkIn),
        "## Task",
        `Write ${profile.name}'s weekly check-in note: 3 to 6 sentences. Say how the week went (weight trend vs goal, training, eating), what the app is changing and why, and one or two concrete focus points for this week. Address them directly. Use ${profile.units === "imperial" ? "lb" : "kg"}.`,
        checkIn.userNote ? `They wrote: "${checkIn.userNote}" — respond to it.` : "",
      ].join("\n");
      const out = await askClaude({ label: "check-in note", system: SYSTEM, prompt, schema: z.object({ note: z.string() }) });
      return out.note;
    },
    () => {
      const parts = [checkIn.adjustmentReason];
      parts.push(`You finished ${checkIn.sessionsCompleted} of ${checkIn.sessionsPlanned} planned sessions.`);
      if (checkIn.weighIns < 4) parts.push("Weigh in most mornings this week so the trend has enough data.");
      return parts.join(" ");
    },
  );
  setCheckInCoachNote(checkIn.id, result.value);
  return { note: result.value, source: result.source };
}

export function registerCoachHandlers() {
  registerHandler("mesocycle", mesoHandler);
  registerHandler("meal_menu", menuHandler);
  registerHandler("more_options", moreOptionsHandler);
  registerHandler("estimate_meal", estimateHandler);
  registerHandler("check_in_note", checkInNoteHandler);
}


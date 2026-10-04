// The week's meal-prep guide: written by the coach from a finished plan, with the exact portions the
// plan calls for, so Chris can open it on prep day and follow it start to finish.
import { z } from "zod";
import { addDays, daysBetween, LocalDate, TimeOfDay, weekdayOf, type MealOption, type PrepGuide, type Profile } from "@strike/core";
import type { MenuData } from "../db/index.ts";
import { menuRowById, planFingerprint, updateMenuData, type MenuRow } from "../services/meals.ts";
import { requireProfile, today } from "../services/profile.ts";
import { askClaude, coachEnabled } from "./claude.ts";
import { personContext, SYSTEM } from "./context.ts";

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Every planned home-cooked meal, in eating order, with its dish and portion. */
interface Occurrence {
  date: string;
  slotLabel: string;
  option: MealOption;
}

function occurrences(data: MenuData, fromDate: string): Occurrence[] {
  const options = new Map(data.slots.flatMap((s) => s.options.map((o) => [o.id, { option: o, label: s.label }] as const)));
  const labelFor = (dayType: string, slotIndex: number) => data.slots.find((s) => s.dayType === dayType && s.slotIndex === slotIndex)?.label ?? `Meal ${slotIndex + 1}`;
  const out: Occurrence[] = [];
  for (const day of data.plan ?? []) {
    if (day.date < fromDate) continue;
    for (const meal of [...day.meals].sort((a, b) => a.slotIndex - b.slotIndex)) {
      const found = options.get(meal.optionId);
      if (found && found.option.kind === "home") out.push({ date: day.date, slotLabel: labelFor(day.dayType, meal.slotIndex), option: found.option });
    }
  }
  return out;
}

const dayName = (date: string) => `${DAY[weekdayOf(date)]} ${date}`;

export function prepGuidePrompt(profile: Profile, row: MenuRow, fromDate: string): string {
  const occ = occurrences(row.data, fromDate);
  const dishes = new Map<string, MealOption[]>();
  for (const o of occ) dishes.set(o.option.name, [...(dishes.get(o.option.name) ?? []), o.option]);
  const imperial = profile.units === "imperial";
  const dishText = [...dishes.entries()]
    .map(([name, opts]) => {
      const first = opts[0]!;
      return [`### ${name} (${opts.length} planned portion${opts.length === 1 ? "" : "s"})`, `Method as written: ${first.steps.join(" ") || "(none)"}`].join("\n");
    })
    .join("\n\n");
  const mealText = occ.map((o) => `- ${dayName(o.date)} · ${o.slotLabel}: ${o.option.name}: ${o.option.ingredients.map((i) => `${i.amount} ${i.item}`).join(", ")}`).join("\n");
  const notes = row.data.prepTips.length ? `## The plan's prep notes\n${row.data.prepTips.map((t) => `- ${t}`).join("\n")}` : "";
  return [
    personContext(profile),
    `## Dishes this week\n${dishText}`,
    `## Every planned home-cooked meal, with its exact portion\n${mealText}`,
    notes,
    "## Task",
    `Write ${profile.name}'s meal-prep guide for these meals. Today is ${dayName(today(profile))}; the first planned meal is on ${occ[0] ? dayName(occ[0].date) : "the first day"}. They will open this on prep day and follow it step by step, so make it complete enough to cook from without looking anything up.`,
    "- sessions: usually two cooking sessions, the first on or before the first planned day and one midweek, because cooked food keeps about four days in the fridge. Assign each meal to the session that cooks it. A day's breakfast can be cooked fresh in the morning if that's simpler; say so in a short session for it rather than leaving it out.",
    "- For each session: covers (which meals it produces), realistic active and total minutes, equipment (pans, sheet pans, air fryer, rice cooker, mixing bowls, containers with counts and sizes), and ingredients: everything to take out before starting, with exact totals for that session.",
    `- steps: in the order to actually do them, using every appliance in parallel and saying what to do while something cooks. Each step specific: quantities, cut sizes, pan and heat level, oven or air-fryer temperature in ${imperial ? "°F" : "°C"}, times, how to tell it's done (internal temperature for meat), cooling before packing. Put a waiting time in timerMinutes when a timer helps. Use tip for doneness checks and small tricks.`,
    "- The last steps of a session portion everything into containers. containers: one per planned meal it covers, labeled like 'Mon · Lunch', with contents and amounts exactly as planned (cooked weights where that's how they're portioned), fridge or freezer, and the date it's eaten (eatBy). Anything eaten more than four days after cooking goes in the freezer.",
    "- reminders: prep tasks on other days only, with a date and time: moving frozen portions or raw meat to the fridge to thaw, assembling something the night before, a quick fresh component. Not the meals themselves; the app already reminds them. Null time if any time that day works.",
    `- reheating: for each dish, how to reheat it well (microwave time and power, or skillet / air fryer), and what to add fresh after reheating. Use ${imperial ? "°F" : "°C"}.`,
    "- foodSafety: three or four short rules relevant to this week's food.",
    "- overview: two or three sentences: how the week's prep is organized and roughly how long it takes in total.",
    "- Use the amounts given; don't change dishes or portions. Plain, direct instructions.",
  ]
    .filter(Boolean)
    .join("\n");
}

const GuideOut = z.object({
  overview: z.string(),
  reminders: z.array(z.object({ date: LocalDate, time: TimeOfDay.nullable(), text: z.string() })),
  sessions: z.array(
    z.object({
      date: LocalDate,
      title: z.string().describe("e.g. 'Sunday cook'"),
      covers: z.string(),
      activeMinutes: z.number().int(),
      totalMinutes: z.number().int(),
      equipment: z.array(z.string()),
      ingredients: z.array(z.object({ item: z.string(), amount: z.string() })),
      steps: z.array(z.object({ text: z.string(), timerMinutes: z.number().int().min(0), tip: z.string().describe("Empty string when none") })),
      containers: z.array(z.object({ label: z.string(), contents: z.string(), storage: z.enum(["fridge", "freezer"]), eatBy: LocalDate })),
    }),
  ),
  reheating: z.array(z.object({ dish: z.string(), instructions: z.string() })),
  foodSafety: z.array(z.string()),
});

/** Session ingredient totals: each ingredient's recipe amounts added up when they share a unit. */
function totals(meals: Occurrence[]): { item: string; amount: string }[] {
  const byItem = new Map<string, { item: string; sums: Map<string, number>; other: string[] }>();
  for (const { option } of meals) {
    for (const ing of option.ingredients) {
      const key = ing.item.toLowerCase();
      const entry = byItem.get(key) ?? { item: ing.item, sums: new Map<string, number>(), other: [] };
      const m = /^(\d+(?:\.\d+)?)\s*(.*)$/.exec(ing.amount.trim());
      // "tbsp" and "tbsps" are the same unit; pluralized again on the way out.
      const unit = m ? m[2]!.replace(/^(tbsp|scoop|slice)s$/, "$1") : "";
      if (m) entry.sums.set(unit, (entry.sums.get(unit) ?? 0) + Number(m[1]));
      else entry.other.push(ing.amount);
      byItem.set(key, entry);
    }
  }
  return [...byItem.values()].map((e) => ({
    item: e.item.charAt(0).toUpperCase() + e.item.slice(1),
    amount:
      [
        ...[...e.sums.entries()].map(([unit, n]) => {
          const plural = /^(tbsp|scoop|slice)$/.test(unit) && n !== 1 ? `${unit}s` : unit;
          return `${Math.round(n * 10) / 10}${plural ? ` ${plural}` : ""}`;
        }),
        ...e.other,
      ].join(" + ") || "as needed",
  }));
}

/** A plain guide built from the plan when the coach can't write one. */
export function fallbackPrepGuide(row: MenuRow, fromDate: string): Omit<PrepGuide, "createdAt" | "source"> {
  const occ = occurrences(row.data, fromDate);
  const dates = [...new Set(occ.map((o) => o.date))];
  const split = dates.length > 4 ? Math.ceil(dates.length / 2) : dates.length;
  const groups = [dates.slice(0, split), dates.slice(split)].filter((g) => g.length);
  const sessions = groups.map((group, i) => {
    const mine = occ.filter((o) => group.includes(o.date));
    const byDish = new Map<string, Occurrence[]>();
    for (const o of mine) byDish.set(o.option.name, [...(byDish.get(o.option.name) ?? []), o]);
    const first = group[0]!;
    const last = group[group.length - 1]!;
    return {
      date: first,
      title: `${DAY[weekdayOf(first)]} cook`,
      covers: `Meals ${DAY[weekdayOf(first)]}–${DAY[weekdayOf(last)]}`,
      activeMinutes: 20 + 10 * byDish.size,
      totalMinutes: 30 + 15 * byDish.size,
      equipment: ["Sheet pan or air fryer", "Large skillet", "Pot or rice cooker", `${mine.length} meal-prep containers`],
      ingredients: totals(mine),
      steps: [
        { text: "Clear the counter, get out every ingredient and container, and preheat the oven or air fryer to 400°F.", timerMinutes: 0, tip: "" },
        ...[...byDish.entries()].map(([dish, list]) => {
          const text = list[0]!.option.ingredients.map((i) => i.item.toLowerCase()).join(" ");
          const meat = /chicken|turkey|beef|pork|salmon|fish/.test(text);
          return {
            text: `Make ${list.length} portion${list.length === 1 ? "" : "s"} of ${dish}: ${list[0]!.option.steps.join(" ")}`,
            timerMinutes: 0,
            tip: meat ? "Cook poultry to 165°F, ground meat to 160°F and fish to 145°F." : "",
          };
        }),
        { text: "Let everything cool for 20–30 minutes, then portion into the labeled containers below and refrigerate within two hours of cooking.", timerMinutes: 25, tip: "" },
      ],
      containers: mine.map((o) => ({
        label: `${DAY[weekdayOf(o.date)]} · ${o.slotLabel}`,
        contents: `${o.option.name}: ${o.option.ingredients.map((x) => `${x.amount} ${x.item}`).join(", ")}`,
        storage: daysBetween(first, o.date) > 3 ? ("freezer" as const) : ("fridge" as const),
        eatBy: o.date,
      })),
    };
  });
  const reminders = sessions.flatMap((s) =>
    s.containers.filter((c) => c.storage === "freezer").map((c) => ({ date: addDays(c.eatBy, -1), time: "20:00", text: `Move ${c.label} from the freezer to the fridge to thaw.` })),
  );
  const dishNames = [...new Set(occ.map((o) => o.option.name))];
  return {
    overview: `${sessions.length === 2 ? "Two cooking sessions" : "One cooking session"} cover the week's home-cooked meals; grab-and-go meals need no prep.`,
    reminders,
    sessions,
    reheating: dishNames.map((dish) => ({ dish, instructions: "Microwave covered for 2–3 minutes, stirring halfway, until steaming hot all the way through." })),
    foodSafety: [
      "Refrigerate cooked food within two hours of cooking.",
      "Eat refrigerated meals within four days; freeze anything for later in the week.",
      "Thaw frozen meals in the fridge overnight, not on the counter.",
      "Reheat until steaming hot throughout (165°F).",
    ],
  };
}

export async function prepGuideHandler(input: Record<string, unknown>) {
  const profile = requireProfile();
  const row = menuRowById(Number(input.menuId));
  const fromDate = today(profile) > row.weekStart ? today(profile) : row.weekStart;
  if (!(row.data.plan ?? []).length) throw new Error("This menu has no day-by-day plan to prep from.");
  let source: "coach" | "fallback" = "fallback";
  let guide: Omit<PrepGuide, "createdAt" | "source"> | null = null;
  let reason: string | null = null;
  if (coachEnabled()) {
    for (let attempt = 1; attempt <= 2 && !guide; attempt++) {
      try {
        guide = await askClaude({ label: "prep guide", system: SYSTEM, prompt: prepGuidePrompt(profile, row, fromDate), schema: GuideOut, timeoutMs: 30 * 60_000 });
        source = "coach";
      } catch (err) {
        reason = err instanceof Error ? err.message : String(err);
        console.warn(`[coach] prep guide attempt ${attempt} failed: ${reason}`);
      }
    }
  }
  guide ??= fallbackPrepGuide(row, fromDate);
  // Re-read: the plan may have been swapped while the guide was being written.
  const fresh = menuRowById(row.id);
  const data: MenuData = { ...fresh.data, prepGuide: { ...guide, createdAt: new Date().toISOString(), source, planHash: planFingerprint(row.data.plan ?? []) } };
  updateMenuData(row.id, data);
  return { menuId: row.id, source, reason };
}

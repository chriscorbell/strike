// What Ask Coach can read, rendered as compact Markdown: the same data the app's screens show, with the
// ids the change tools need.
import {
  addDays,
  displayBodyWeight,
  getExercise,
  minutesNowIn,
  planWeekStart,
  prepMomentFor,
  shoppingDateFor,
  formatTime,
  type Macros,
  type MealOption,
} from "@strike/core";
import { checkInDue, listCheckIns } from "../services/checkins.ts";
import { pendingJobRows, pendingJobs } from "../services/jobs.ts";
import { mealHistory, menuRowFor, menuRowForWeek, toMenu, type MenuRow } from "../services/meals.ts";
import { requireProfile, targetsOn, today } from "../services/profile.ts";
import { dayView } from "../services/today.ts";
import * as training from "../services/training.ts";
import { weightsView } from "../services/weights.ts";
import { clockLabel, dayLabel } from "./actions.ts";

export type Week = "current" | "next";

const macros = (m: Macros) => `${Math.round(m.kcal)} kcal, ${Math.round(m.proteinG)} P / ${Math.round(m.carbsG)} C / ${Math.round(m.fatG)} F`;

function bodyWeight(kg: number) {
  const units = requireProfile().units;
  return `${displayBodyWeight(kg, units)} ${units === "imperial" ? "lb" : "kg"}`;
}

const optionLine = (o: MealOption) => `[${o.id}] ${o.name} (${o.kind === "home" ? "home-cooked" : `grab-and-go at ${o.place ?? "a store"}`}): ${macros(o.macros)}, about $${o.costUsd.toFixed(2)}`;

function weekRow(week: Week): { row: MenuRow | undefined; weekStart: string } {
  const now = today();
  const current = planWeekStart(requireProfile(), now);
  if (week === "next") {
    const weekStart = addDays(current, 7);
    return { row: menuRowForWeek(weekStart), weekStart };
  }
  return { row: menuRowFor(now), weekStart: current };
}

function noMenu(week: Week, weekStart: string): string {
  if (week === "current") return "There's no meal plan for this week yet.";
  const prep = prepMomentFor(requireProfile(), weekStart);
  const pending = pendingJobRows("meal_menu").some((j) => j.input.weekStart === weekStart);
  return pending ? "Next week's meal plan is being written right now." : `Next week's meal plan isn't written yet; it's prepared ${dayLabel(prep.date)} at ${clockLabel(prep.time)}.`;
}

export function dayText(date: string): string {
  const v = dayView(date);
  const out = [`## ${dayLabel(date)} (${date}): ${v.dayType} day`, `- Targets ${macros(v.targets)}; logged so far ${macros(v.consumed)}`];
  if (v.weight.loggedKg != null) out.push(`- Weighed in at ${bodyWeight(v.weight.loggedKg)}`);
  if (v.workoutTimeOverride) out.push(`- Workout moved to ${clockLabel(v.workoutTimeOverride)} for this day`);
  for (const item of v.timeline) {
    if (item.kind === "workout") {
      out.push(`- ${clockLabel(item.time)}–${clockLabel(item.endTime)} workout: ${item.label} at ${item.location}, ${item.status.replace("_", " ")} [session ${item.sessionId}], ${item.exerciseCount} exercises, ${item.setCount} sets`);
      continue;
    }
    const planned = item.options.find((o) => o.id === item.plannedOptionId);
    const log = item.log ? (item.log.status === "skipped" ? "logged as skipped" : `logged: ${item.log.name} (${Math.round(item.log.macros.kcal)} kcal)`) : "not logged";
    out.push(`- ${clockLabel(item.time)} ${item.label} (slot ${item.slotIndex}, ${item.role.replace("_", "-")}, target ${macros(item.targets)}): planned ${planned ? optionLine(planned) : "nothing"}; ${log}`);
  }
  for (const extra of v.extraMeals) out.push(`- Also logged: ${extra.name} (${Math.round(extra.macros.kcal)} kcal)`);
  if (v.prep) {
    for (const s of v.prep.sessions) out.push(`- Cooking session from the prep guide: ${s.title}, ${s.covers}; about ${s.activeMinutes} min active, ${s.totalMinutes} total`);
    for (const r of v.prep.reminders) out.push(`- Prep reminder${r.time ? ` at ${clockLabel(r.time)}` : ""}: ${r.text}`);
  }
  return out.join("\n");
}

/** Where this week stands: dates, shopping, prep sessions, the next plan, and coach work in progress. */
export function weekOverviewText(): string {
  const profile = requireProfile();
  const now = today();
  const weekStart = planWeekStart(profile, now);
  const shopping = shoppingDateFor(profile, weekStart);
  const next = addDays(weekStart, 7);
  const prep = prepMomentFor(profile, next);
  const row = menuRowFor(now);
  const out = [
    "## This week",
    `- Plan week ${dayLabel(weekStart)} to ${dayLabel(addDays(weekStart, 6))}; its groceries ${shopping <= now ? "were bought" : "are bought"} on ${dayLabel(shopping)}`,
    `- Next week's check-in and meal plan: ${dayLabel(prep.date)} at ${clockLabel(prep.time)}, for shopping on ${dayLabel(shoppingDateFor(profile, next))}`,
  ];
  const guide = row?.data.prepGuide;
  if (guide) out.push(`- This week's prep guide cooks on: ${guide.sessions.map((s) => `${dayLabel(s.date)} (${s.title})`).join(", ") || "no sessions"}`);
  const jobs = pendingJobs();
  if (jobs.length) out.push(`- Coach work in progress: ${jobs.map((j) => `${j.kind.replace("_", " ")} (${j.status})`).join(", ")}`);
  return out.join("\n");
}

export function mealPlanText(week: Week): string {
  const { row, weekStart } = weekRow(week);
  if (!row) return noMenu(week, weekStart);
  const menu = toMenu(row);
  const shopping = shoppingDateFor(requireProfile(), row.weekStart);
  const options = new Map(menu.slots.flatMap((s) => s.options.map((o) => [o.id, o] as const)));
  const out = [
    `## Meal plan, week of ${dayLabel(row.weekStart)} (menu ${row.id}, written by ${row.source === "coach" ? "the coach" : "the rule-based fallback"})`,
    `- Shopping day ${dayLabel(shopping)}: ${today() >= shopping ? "groceries already bought" : "not yet"}`,
    "### Planned meals",
  ];
  for (const day of menu.plan) {
    const meals = [...day.meals]
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .map((m) => {
        const label = menu.slots.find((s) => s.dayType === day.dayType && s.slotIndex === m.slotIndex)?.label ?? `Meal ${m.slotIndex + 1}`;
        return `${label} (slot ${m.slotIndex}): ${options.get(m.optionId)?.name ?? "unknown"} [${m.optionId}]`;
      });
    out.push(`- ${dayLabel(day.date)} (${day.dayType} day): ${meals.join("; ")}`);
  }
  out.push("### Options for each meal");
  for (const s of menu.slots) {
    out.push(`- ${s.dayType} day, slot ${s.slotIndex}: ${s.label} (${s.role.replace("_", "-")}), target ${macros(s.targets)}`);
    for (const o of s.options) out.push(`  - ${optionLine(o)}`);
  }
  if (menu.prepTips.length) out.push("### Prep tips", ...menu.prepTips.map((t) => `- ${t}`));
  if (menu.coachNote) out.push(`### Coach's note\n${menu.coachNote}`);
  if (pendingJobRows("meal_menu").some((j) => (j.input.weekStart ?? weekStart) === row.weekStart)) out.push("A new plan for this week is being written right now.");
  return out.join("\n");
}

export function mealOptionText(week: Week, optionId: string): string {
  const { row, weekStart } = weekRow(week);
  if (!row) return noMenu(week, weekStart);
  const o = row.data.slots.flatMap((s) => s.options).find((x) => x.id === optionId);
  if (!o) return `No option ${optionId} on that week's menu.`;
  return [
    `## ${o.name}`,
    optionLine(o),
    o.summary,
    o.kind === "out" ? `Order: ${o.order ?? "(none)"}` : "",
    o.ingredients.length ? `Ingredients: ${o.ingredients.map((i) => `${i.amount} ${i.item}`).join(", ")}` : "",
    o.steps.length ? `Steps: ${o.steps.join(" ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function groceriesText(week: Week): string {
  const { row, weekStart } = weekRow(week);
  if (!row) return noMenu(week, weekStart);
  const list = toMenu(row).groceryList;
  if (!list.length) return "That week's plan has no groceries (every planned meal is grab-and-go).";
  const sections = [...new Set(list.map((g) => g.section))];
  const out = [`## Grocery list, week of ${dayLabel(row.weekStart)}`, "Totaled from the planned home-cooked meals and rounded to store packages."];
  for (const section of sections) {
    out.push(`### ${section}`);
    for (const g of list.filter((x) => x.section === section)) {
      out.push(`- ${g.item}: ${g.staple ? "pantry staple, check" : `buy ${g.quantity}`}${g.needed ? ` (plan uses ${g.needed})` : ""}, about $${g.costUsd.toFixed(2)}`);
    }
  }
  return out.join("\n");
}

export function prepGuideText(week: Week, includeSteps: boolean): string {
  const { row, weekStart } = weekRow(week);
  if (!row) return noMenu(week, weekStart);
  const menu = toMenu(row);
  const guide = menu.prepGuide;
  if (!guide) return menu.prepGuidePending ? "The prep guide is being written right now." : "This week has no prep guide yet.";
  const out = [`## Prep guide, week of ${dayLabel(row.weekStart)} (written ${dayLabel(guide.createdAt.slice(0, 10))})`, guide.overview];
  if (menu.prepGuideStale) out.push("Meals were swapped after it was written, so some amounts are out of date.");
  if (menu.prepGuidePending) out.push("A new version is being written right now.");
  for (const s of guide.sessions) {
    out.push(`### ${dayLabel(s.date)}: ${s.title} (${s.covers}; about ${s.activeMinutes} min active, ${s.totalMinutes} total)`);
    if (includeSteps) {
      out.push(`Equipment: ${s.equipment.join(", ")}`, `Ingredients: ${s.ingredients.map((i) => `${i.amount} ${i.item}`).join(", ")}`);
      s.steps.forEach((step, i) => out.push(`${i + 1}. ${step.text}${step.timerMinutes ? ` (${step.timerMinutes} min timer)` : ""}${step.tip ? ` Tip: ${step.tip}` : ""}`));
    }
    out.push("Containers:", ...s.containers.map((c) => `- ${c.label}: ${c.contents} (${c.storage}, eat by ${dayLabel(c.eatBy)})`));
  }
  if (guide.reminders.length) out.push("### Reminders", ...guide.reminders.map((r) => `- ${dayLabel(r.date)}${r.time ? ` ${clockLabel(r.time)}` : ""}: ${r.text}`));
  if (includeSteps) {
    out.push("### Reheating", ...guide.reheating.map((r) => `- ${r.dish}: ${r.instructions}`));
    out.push("### Food safety", ...guide.foodSafety.map((f) => `- ${f}`));
  }
  return out.join("\n");
}

export function trainingText(): string {
  const o = training.mesoOverview();
  if (!o) return "There's no training block yet; the coach is writing the first one.";
  const profile = requireProfile();
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const out = [
    `## ${o.name} (${o.split}): ${o.hardWeeks} hard weeks and a deload, started ${dayLabel(o.startDate)}, ${o.status}`,
    o.rationale,
    `Lifting days: ${profile.training.days.map((d) => DAYS[d]).join(", ")} at ${clockLabel(profile.training.workoutTime)}. Loads in ${profile.units === "imperial" ? "lb" : "kg"}.`,
    "### Days",
    ...o.days.map((d, i) => `- Day ${i + 1}, ${d.label} at ${d.location} (${d.focus}): ${d.exercises.map((e) => `${e.name} ${e.sets}x${e.repMin}-${e.repMax}`).join(", ")}`),
    "### Sessions by week",
  ];
  o.grid.forEach((week, w) => {
    const cells = week.map((cell, d) => `${o.days[d]?.label}: ${cell ? `${cell.status.replace("_", " ")}${cell.date ? ` ${dayLabel(cell.date)}` : ""} [session ${cell.sessionId}]` : "not created yet"}`);
    out.push(`- Week ${w + 1}${w === o.hardWeeks ? " (deload)" : ""}: ${cells.join("; ")}`);
  });
  const next = training.ensureNextSession();
  if (next) out.push(`Next session: ${next.label}, week ${next.week + 1} [session ${next.id}] at ${next.location}.`);
  return out.join("\n");
}

export function sessionText(sessionId: number): string {
  const s = training.sessionView(sessionId);
  const out = [
    `## ${s.label}, week ${s.week + 1}${s.isDeload ? " (deload)" : ""} [session ${s.id}]: ${s.status.replace("_", " ")}${s.date ? ` on ${dayLabel(s.date)}` : ""}, at ${s.location}, target ${s.targetRir} reps in reserve`,
  ];
  for (const e of s.exercises) {
    const target = e.sets[0];
    const logged = e.sets.filter((x) => x.log).map((x) => `${x.log!.weight ?? "BW"}x${x.log!.reps}${x.log!.rir != null ? `@${x.log!.rir}` : ""}`);
    out.push(
      `- [exercise ${e.id}] ${e.name} (${e.muscle}${e.substitutedFrom ? `, in place of ${getExercise(e.substitutedFrom)?.name ?? e.substitutedFrom}` : ""}): ${e.sets.length} sets, target ${target?.targetWeight ?? "bodyweight"}${target?.targetWeight != null ? ` ${s.loadUnit}` : ""} x ${e.sets.map((x) => x.targetReps).join("/")}; logged ${logged.join(", ") || "nothing"}. ${e.prescriptionNote}`,
    );
  }
  const fb = s.feedback.filter((f) => f.soreness != null || f.pump != null || f.workload != null || f.jointPain);
  if (fb.length) out.push(`Feedback: ${fb.map((f) => `${f.muscle} soreness ${f.soreness ?? "?"}/3, pump ${f.pump ?? "?"}/2, workload ${f.workload ?? "?"}/3${f.jointPain ? ", joint pain" : ""}`).join("; ")}`);
  return out.join("\n");
}

export function exerciseOptionsText(sessionId: number, sessionExerciseId: number): string {
  const options = training.alternativesFor(sessionId, sessionExerciseId);
  if (!options.length) return "No other exercise for that muscle fits this location's equipment.";
  return ["## Exercises that can replace it here", ...options.map((e) => `- ${e.id}: ${e.name} (${e.primary}; ${e.loadType}; usual ${e.repMin}-${e.repMax} reps)`)].join("\n");
}

export function bodyText(): string {
  const profile = requireProfile();
  const now = today();
  const w = weightsView(profile, now, 28);
  const rate = (kg: number) => `${bodyWeight(Math.abs(kg))}/week ${kg < 0 ? "down" : "up"}`;
  const out = [
    "## Body weight",
    `- Trend ${w.latestTrendKg != null ? bodyWeight(w.latestTrendKg) : "unknown"}; changing ${w.rateKgPerWeek != null ? rate(w.rateKgPerWeek) : "unknown"}; goal ${w.targetRateKgPerWeek === 0 ? "maintain" : rate(w.targetRateKgPerWeek)}`,
    `- Weigh-ins, last 4 weeks: ${w.points.filter((p) => p.weightKg != null).map((p) => `${p.date.slice(5)} ${bodyWeight(p.weightKg!)}`).join(", ") || "none"}`,
  ];
  const targets = targetsOn(now);
  if (targets) out.push(`- Targets since ${dayLabel(targets.effectiveDate)}: training days ${macros(targets.training)}; rest days ${macros(targets.rest)}. ${targets.reason}`);
  out.push(`- This week's check-in ${checkInDue() ? "is due now" : "isn't due"}.`);
  const checkIns = listCheckIns().slice(0, 4);
  if (checkIns.length) {
    out.push("### Recent check-ins");
    for (const c of checkIns) {
      out.push(
        `- Week of ${dayLabel(c.weekStart)}: ${c.adjustmentKcal === 0 ? "no change" : `${c.adjustmentKcal > 0 ? "+" : ""}${c.adjustmentKcal} kcal/day`} (${c.adjustmentReason}); ${c.weighIns} weigh-ins; ${c.sessionsCompleted}/${c.sessionsPlanned} sessions${c.mealAdherence != null ? `; ${Math.round(c.mealAdherence * 100)}% of meals logged` : ""}`,
      );
    }
  }
  return out.join("\n");
}

export function mealLogText(days: number): string {
  const out = [`## Meals logged, last ${days} days`];
  for (const d of mealHistory(days)) {
    const logs = d.logs.map((l) => `${l.slotIndex != null ? `slot ${l.slotIndex}` : "extra"} ${l.status === "skipped" ? "skipped" : `${l.name} (${Math.round(l.macros.kcal)} kcal)`}`);
    out.push(`- ${dayLabel(d.date)} (${d.dayType}): ${Math.round(d.consumed.kcal)}/${Math.round(d.targets.kcal)} kcal, ${Math.round(d.consumed.proteinG)}/${Math.round(d.targets.proteinG)} g protein; ${logs.join("; ") || "nothing logged"}`);
  }
  return out.join("\n");
}

/** "Mon Oct 5, 9:14 AM" in the profile's time zone. */
export function momentLabel(iso: string): string {
  const tz = requireProfile().timezone;
  const at = new Date(iso);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  return `${dayLabel(date)}, ${clockLabel(formatTime(minutesNowIn(tz, at)))}`;
}

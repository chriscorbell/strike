// What the coach knows about Chris, rendered as compact Markdown for prompts.
import { ageOn, displayBodyWeight, EXERCISES, isAvailable, kgToLb, loadUnit, type DumbbellSet, type LocationEquipment, type Profile } from "@strike/core";
import { recentCoachNotes } from "../services/checkins.ts";
import { mealDigest } from "../services/meals.ts";
import { targetsOn, today } from "../services/profile.ts";
import { trainingDigest } from "../services/training.ts";
import { trendThrough } from "../services/weights.ts";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const ITEM_NAMES: Record<string, string> = {
  bench_flat: "flat bench",
  bench_adjustable: "adjustable (incline) bench",
  pullup_bar: "pull-up bar",
  dip_station: "dip station",
  cable: "adjustable cable station",
  lat_pulldown: "lat pulldown",
  seated_row: "seated cable row",
  leg_press: "leg press",
  leg_extension: "leg extension",
  leg_curl: "leg curl",
  smith_machine: "Smith machine",
  barbell: "barbell, rack and plates",
  chest_press_machine: "chest press machine",
  shoulder_press_machine: "shoulder press machine",
  pec_deck: "pec deck / rear delt machine",
};

function dumbbells(d: DumbbellSet, unit: string) {
  if (d.kind === "none") return "no dumbbells";
  if (d.kind === "adjustable") return `adjustable dumbbells ${d.min}–${d.max} ${unit} in ${d.step} ${unit} steps`;
  return `dumbbell pairs: ${d.weights.join(", ")} ${unit}`;
}

function equipmentLine(name: string, loc: LocationEquipment, unit: string) {
  if (!loc.available) return `- ${name}: not available`;
  const items = loc.items.map((i) => ITEM_NAMES[i] ?? i).join(", ") || "nothing else";
  return `- ${name}: ${dumbbells(loc.dumbbells, unit)}; ${items}; machine stacks in ${loc.machineStep} ${unit} steps${loc.notes ? `; notes: ${loc.notes}` : ""}`;
}

export function personContext(profile: Profile): string {
  const now = today(profile);
  const unit = loadUnit(profile.units);
  const bwUnit = profile.units === "imperial" ? "lb" : "kg";
  const { latest, rate, entries } = trendThrough(now);
  const w = (kg: number) => `${displayBodyWeight(kg, profile.units)} ${bwUnit}`;
  const targets = targetsOn(now);
  const height = profile.units === "imperial" ? `${Math.floor(profile.heightCm / 2.54 / 12)}'${Math.round((profile.heightCm / 2.54) % 12)}"` : `${profile.heightCm} cm`;
  const goal =
    profile.goal.type === "maintain"
      ? "maintain weight while building muscle"
      : `${profile.goal.type} about ${profile.goal.ratePercentPerWeek}% of body weight per week${profile.goal.targetWeightKg ? ` toward ${w(profile.goal.targetWeightKg)}` : ""}`;

  const lines = [
    "## Person",
    `- ${profile.name}, ${profile.sex}, ${ageOn(profile.birthDate, now)} years old, ${height}`,
    `- Weight trend: ${latest != null ? w(latest) : "unknown"}${rate != null ? `, changing ${profile.units === "imperial" ? `${(kgToLb(rate)).toFixed(2)} lb` : `${rate.toFixed(2)} kg`}/week` : ""} (${entries.length} weigh-ins logged)`,
    `- Goal: ${goal}`,
    `- Activity outside lifting: ${profile.activityLevel.replace("_", " ")}`,
    `- Wakes ${profile.schedule.wakeTime}, sleeps ${profile.schedule.sleepTime}`,
    `- Today is ${now} (${DAYS[new Date(`${now}T00:00:00Z`).getUTCDay()]})`,
    "",
    "## Training",
    `- Experience: ${profile.training.experience}`,
    `- Lifts on ${profile.training.days.map((d) => DAYS[d]).join(", ")} at about ${profile.training.workoutTime}, ${profile.training.sessionMinutes} minutes per session`,
    `- Usually trains at: ${profile.training.defaultLocation}`,
    `- Focus muscles: ${profile.training.focusMuscles.join(", ") || "none in particular"}`,
    `- Injuries or limitations: ${profile.training.limitations || "none"}`,
    `- Loads are in ${unit}; dumbbell loads are per dumbbell`,
    "",
    "## Equipment",
    equipmentLine("Home", profile.equipment.home, unit),
    equipmentLine("Apartment gym", profile.equipment.gym, unit),
    "",
    "## Food",
    `- Diet: ${profile.nutrition.dietStyle}; allergies: ${profile.nutrition.allergies.join(", ") || "none"}`,
    `- Avoids: ${profile.nutrition.avoidFoods || "nothing in particular"}; likes: ${profile.nutrition.favoriteFoods || "no stated favorites"}`,
    `- Cooking: ${{ minimal: "minimal, 10 minutes or less", moderate: "willing to spend up to about 30 minutes, likes batch cooking", enjoys: "enjoys cooking" }[profile.nutrition.cookingTime]}; kitchen: ${profile.nutrition.kitchen.join(", ") || "basic"}`,
    `- Grocery budget: about $${profile.nutrition.weeklyBudgetUsd}/week`,
    `- Grab-and-go places nearby: ${profile.nutrition.grabAndGo.join(", ") || "general convenience stores and grocery delis"}`,
    `- ${profile.nutrition.mealsPerDay} meals a day`,
  ];
  if (targets) {
    const t = (m: { kcal: number; proteinG: number; carbsG: number; fatG: number }) => `${Math.round(m.kcal)} kcal, ${m.proteinG} g protein, ${m.carbsG} g carbs, ${m.fatG} g fat`;
    lines.push("", "## Current daily targets", `- Training days: ${t(targets.training)}`, `- Rest days: ${t(targets.rest)}`);
  }
  const notes = recentCoachNotes();
  if (notes.length) {
    lines.push("", `## Notes from ${profile.name}`, ...notes.map((n) => `- (${n.createdAt.slice(0, 10)}) ${n.note}`));
  }
  return lines.join("\n");
}

export function trainingHistoryContext(): string {
  const digest = trainingDigest(16);
  if (digest.length === 0) return "## Recent training\nNo sessions logged yet.";
  const lines = ["## Recent training (oldest first; weight x reps @ reps in reserve)"];
  for (const s of digest) {
    lines.push(`- ${s.date} ${s.label} (week ${s.week}, target RIR ${s.targetRir})`);
    for (const e of s.exercises) if (e.done) lines.push(`  - ${e.exercise}: target ${e.target}; did ${e.done}`);
    const fb = s.feedback.filter((f) => f.workload != null || f.soreness != null || f.jointPain);
    if (fb.length) lines.push(`  - feedback: ${fb.map((f) => `${f.muscle} soreness ${f.soreness ?? "?"}/3, pump ${f.pump ?? "?"}/2, workload ${f.workload ?? "?"}/3${f.jointPain ? ", joint pain" : ""}`).join("; ")}`);
  }
  return lines.join("\n");
}

export function mealHistoryContext(): string {
  const digest = mealDigest(14);
  if (digest.length === 0) return "## Recent meals\nNothing logged yet.";
  return ["## Recent meals (last two weeks)", ...digest.map((d) => `- ${d}`)].join("\n");
}

export function exerciseCatalog(profile: Profile): string {
  const lines = ["## Exercise catalog (use these ids only)"];
  for (const location of ["home", "gym"] as const) {
    const loc = profile.equipment[location];
    if (!loc.available) continue;
    const available = EXERCISES.filter((e) => isAvailable(e, loc));
    lines.push(`### Available at ${location}`);
    for (const e of available) lines.push(`- ${e.id}: ${e.name} (${e.primary}; ${e.pattern.replace("_", " ")}; ${e.loadType}; usual ${e.repMin}-${e.repMax} reps)`);
  }
  return lines.join("\n");
}

export const SYSTEM = `You are the coach inside Strike, a private training and nutrition app used by one person. You write the plans the app follows; the app's own rules handle load progression from logged sets, calorie math, the weekly calorie adjustment and meal timing, so your job is choosing exercises and structure, foods and portions, and explaining things plainly.

Principles:
- Hypertrophy training in the style of Renaissance Periodization: mesocycles of 4-6 hard weeks then a deload, reps in reserve falling from 3 to 0 across the block, set volume starting near minimum effective volume and rising with good recovery, stable exercise selection within a block, a deep stretch on every rep, stable machines and dumbbells preferred over technical barbell lifts for this setup.
- Respect the equipment exactly: only prescribe what the stated location has.
- Nutrition: hit protein, keep meals simple, cheap and repeatable (batch cooking is good), carbohydrate concentrated around training, realistic grab-and-go orders from real chains or any grocery/convenience store, honest macro estimates.
- Write like a calm, competent coach talking to an adult: short, specific, no hype, no emojis, no filler.`;

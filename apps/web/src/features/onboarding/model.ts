// The onboarding / edit-profile draft: what the form holds (display units), its defaults, conversion to
// and from the API contract, and per-step validation.
import {
  LocalDate,
  LocationEquipment,
  OnboardingRequest,
  Profile,
  TimeOfDay,
  ageOn,
  round,
  todayIn,
  type DumbbellSet,
  type EquipmentItem,
  type Location,
  type Measurements,
  type Units,
} from "@strike/core";
import {
  bodyUnit,
  cmToFeetInches,
  feetInchesToCm,
  fromDisplayLength,
  fromDisplayWeight,
  toDisplayLength,
  toDisplayWeight,
} from "../../lib/format.ts";
import { LOCATION_LABEL } from "../../lib/labels.ts";
import { convertEquipment } from "../../lib/units.ts";

export type Mode = "new" | "edit";

export const ALL_STEPS = ["about", "body", "goal", "day", "training", "equipment", "food", "review"] as const;
export type StepId = (typeof ALL_STEPS)[number];

export const stepsFor = (mode: Mode): StepId[] => (mode === "new" ? [...ALL_STEPS] : ALL_STEPS.filter((s) => s !== "body"));

export const STEP_LABEL: Record<StepId, string> = {
  about: "About you",
  body: "Measurements",
  goal: "Goal",
  day: "Your day",
  training: "Training",
  equipment: "Equipment",
  food: "Food",
  review: "Review",
};

export const TAPE_KEYS = ["waistCm", "neckCm", "hipsCm", "chestCm", "armCm", "thighCm"] as const;
export type TapeKey = (typeof TAPE_KEYS)[number];

export const TAPE_LABEL: Record<TapeKey, string> = {
  waistCm: "Waist",
  neckCm: "Neck",
  hipsCm: "Hips",
  chestCm: "Chest",
  armCm: "Arm",
  thighCm: "Thigh",
};

type GoalType = Profile["goal"]["type"];

/** Form state. Body weight, height and tape are in display units; equipment is in the load unit. */
export interface Draft {
  units: Units;
  name: string;
  sex: Profile["sex"] | null;
  birthDate: string;
  heightFt: number | null;
  heightIn: number | null;
  /** Metric height. */
  heightCm: number | null;
  /** Current body weight, new users only. */
  weight: number | null;
  timezone: string;
  tape: Record<TapeKey, number | null>;
  bodyFat: number | null;
  activityLevel: Profile["activityLevel"];
  goal: { type: GoalType; rate: number; targetWeight: number | null };
  schedule: Profile["schedule"];
  training: Profile["training"];
  equipment: Profile["equipment"];
  nutrition: Omit<Profile["nutrition"], "weeklyBudgetUsd"> & { weeklyBudgetUsd: number | null };
}

export type Errors = Record<string, string>;

// ---------- Presets ----------

export const RATE_PRESETS: Record<"lose" | "gain", { value: number; note: string }[]> = {
  lose: [
    { value: 0.25, note: "Slow and easy to sustain." },
    { value: 0.5, note: "Steady. Strength holds up well." },
    { value: 0.75, note: "Faster. Training gets harder." },
    { value: 1, note: "Aggressive. Best kept short." },
  ],
  gain: [
    { value: 0.1, note: "Lean and slow." },
    { value: 0.25, note: "Steady, with little fat gain." },
    { value: 0.5, note: "Fast. Expect more fat gain." },
  ],
};

export const DEFAULT_RATE: Record<GoalType, number> = { lose: 0.5, maintain: 0, gain: 0.25 };

export function range(from: number, to: number, step: number): number[] {
  if (!(step > 0) || !(to >= from)) return [];
  const out: number[] = [];
  for (let w = from; w <= to + 1e-9 && out.length < 200; w += step) out.push(round(w, 2));
  return out;
}

export function dumbbellDefaults(units: Units, kind: DumbbellSet["kind"]): DumbbellSet {
  if (kind === "none") return { kind };
  if (units === "imperial")
    return kind === "adjustable" ? { kind, min: 5, max: 50, step: 5 } : { kind, weights: range(5, 75, 5) };
  return kind === "adjustable" ? { kind, min: 2, max: 24, step: 2 } : { kind, weights: range(2.5, 35, 2.5) };
}

export const machineStepDefault = (units: Units) => (units === "imperial" ? 10 : 5);

const DEFAULT_GYM_ITEMS: EquipmentItem[] = [
  "bench_adjustable",
  "bench_flat",
  "cable",
  "lat_pulldown",
  "seated_row",
  "leg_press",
  "leg_extension",
  "leg_curl",
];

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const emptyTape = (): Draft["tape"] => ({ waistCm: null, neckCm: null, hipsCm: null, chestCm: null, armCm: null, thighCm: null });

export function defaultDraft(): Draft {
  return {
    units: "imperial",
    name: "",
    sex: null,
    birthDate: "",
    heightFt: null,
    heightIn: null,
    heightCm: null,
    weight: null,
    timezone: deviceTimeZone(),
    tape: emptyTape(),
    bodyFat: null,
    activityLevel: "light",
    goal: { type: "lose", rate: 0.5, targetWeight: null },
    schedule: { wakeTime: "07:00", sleepTime: "23:00", checkInDay: 0 },
    training: {
      experience: "intermediate",
      days: [1, 2, 4, 5],
      sessionMinutes: 60,
      workoutTime: "17:30",
      defaultLocation: "gym",
      focusMuscles: [],
      limitations: "",
    },
    equipment: {
      home: {
        available: true,
        dumbbells: dumbbellDefaults("imperial", "adjustable"),
        items: ["bench_adjustable"],
        machineStep: 10,
        notes: "",
      },
      gym: {
        available: true,
        dumbbells: dumbbellDefaults("imperial", "fixed"),
        items: DEFAULT_GYM_ITEMS,
        machineStep: 10,
        notes: "",
      },
    },
    nutrition: {
      mealsPerDay: 4,
      dietStyle: "omnivore",
      allergies: [],
      avoidFoods: "",
      favoriteFoods: "",
      cookingTime: "moderate",
      weeklyBudgetUsd: 100,
      grabAndGo: [],
      kitchen: ["microwave", "stove", "oven"],
    },
  };
}

// ---------- Profile <-> draft ----------

function heightFields(cm: number, units: Units): Pick<Draft, "heightFt" | "heightIn" | "heightCm"> {
  if (units === "metric") return { heightFt: null, heightIn: null, heightCm: round(cm, 1) };
  const { ft, inches } = cmToFeetInches(cm);
  return { heightFt: ft, heightIn: inches, heightCm: null };
}

export function draftFromProfile(p: Profile): Draft {
  return {
    units: p.units,
    name: p.name,
    sex: p.sex,
    birthDate: p.birthDate,
    ...heightFields(p.heightCm, p.units),
    weight: null,
    timezone: p.timezone,
    tape: emptyTape(),
    bodyFat: null,
    activityLevel: p.activityLevel,
    goal: {
      type: p.goal.type,
      rate: p.goal.ratePercentPerWeek,
      targetWeight: p.goal.targetWeightKg == null ? null : toDisplayWeight(p.goal.targetWeightKg, p.units),
    },
    schedule: { ...p.schedule },
    training: { ...p.training, days: [...p.training.days], focusMuscles: [...p.training.focusMuscles] },
    equipment: structuredClone(p.equipment),
    nutrition: {
      ...p.nutrition,
      allergies: [...p.nutrition.allergies],
      grabAndGo: [...p.nutrition.grabAndGo],
      kitchen: [...p.nutrition.kitchen],
    },
  };
}

export function draftHeightCm(d: Draft): number | null {
  if (d.units === "metric") return d.heightCm;
  if (d.heightFt == null) return null;
  return feetInchesToCm(d.heightFt, d.heightIn ?? 0);
}

const toKg = (v: number | null, units: Units) => (v == null ? null : fromDisplayWeight(v, units));

/** Current body weight in kg as the form knows it. */
export const draftWeightKg = (d: Draft) => toKg(d.weight, d.units);

/** The stored profile's height and target weight as the form shows them in `units`. */
function storedDisplay(base: Profile, units: Units) {
  return {
    height: heightFields(base.heightCm, units),
    targetWeight: base.goal.targetWeightKg == null ? null : toDisplayWeight(base.goal.targetWeightKg, units),
  };
}

const sameHeightFields = (
  a: Pick<Draft, "heightFt" | "heightIn" | "heightCm">,
  b: Pick<Draft, "heightFt" | "heightIn" | "heightCm">,
) => a.heightFt === b.heightFt && a.heightIn === b.heightIn && a.heightCm === b.heightCm;

/**
 * Convert every unit-bearing field to the other unit system. With `base` (edit mode), values still equal to
 * the stored ones are re-derived from the stored kg and cm, so a switch never compounds rounding.
 */
export function switchUnits(d: Draft, to: Units, base?: Profile | null): Draft {
  if (d.units === to) return d;
  const from = base ? storedDisplay(base, d.units) : null;
  const into = base ? storedDisplay(base, to) : null;
  const cm = draftHeightCm(d);
  const weight = (v: number | null) => (v == null ? null : toDisplayWeight(fromDisplayWeight(v, d.units), to));
  const length = (v: number | null) => (v == null ? null : toDisplayLength(fromDisplayLength(v, d.units), to));
  const tape = emptyTape();
  for (const k of TAPE_KEYS) tape[k] = length(d.tape[k]);
  const height =
    from && into && sameHeightFields(d, from.height)
      ? into.height
      : cm == null
        ? { heightFt: null, heightIn: null, heightCm: null }
        : heightFields(cm, to);
  const targetWeight =
    from && into && d.goal.targetWeight != null && d.goal.targetWeight === from.targetWeight
      ? into.targetWeight
      : weight(d.goal.targetWeight);
  return {
    ...d,
    units: to,
    ...height,
    weight: weight(d.weight),
    goal: { ...d.goal, targetWeight },
    tape,
    equipment: convertEquipment(d.equipment, d.units, to),
  };
}

/** Fingerprint of the unit-bearing fields, to undo a units round trip exactly. */
export const unitFingerprint = (d: Draft) =>
  JSON.stringify([d.heightFt, d.heightIn, d.heightCm, d.weight, d.goal.targetWeight, d.tape, d.equipment]);

/** Restore the unit-bearing fields of `from` onto `d`. */
export const withUnitFields = (d: Draft, from: Draft): Draft => ({
  ...d,
  units: from.units,
  heightFt: from.heightFt,
  heightIn: from.heightIn,
  heightCm: from.heightCm,
  weight: from.weight,
  goal: { ...d.goal, targetWeight: from.goal.targetWeight },
  tape: from.tape,
  equipment: from.equipment,
});

/** Same members as `base` means keep `base`'s order, so an untouched list never reads as a change. */
function keepOrder<T>(next: readonly T[], base: readonly T[] | undefined): T[] {
  if (base && next.length === base.length && next.every((v) => base.includes(v)) && base.every((v) => next.includes(v))) {
    return [...base];
  }
  return [...next];
}

function stableLocation(next: LocationEquipment, base: LocationEquipment | undefined): LocationEquipment {
  const d = next.dumbbells;
  const bd = base?.dumbbells;
  return {
    ...next,
    notes: next.notes.trim(),
    items: keepOrder(next.items, base?.items),
    dumbbells:
      d.kind === "fixed" ? { kind: "fixed", weights: keepOrder(d.weights, bd?.kind === "fixed" ? bd.weights : undefined) } : d,
  };
}

/**
 * The Profile the draft describes. Unparsed: run it through the zod schema. With `base` (edit mode), values
 * the user did not touch are sent back exactly as stored, so unit rounding never reads as a change on the
 * server (which recalculates targets and plans when some fields change).
 */
export function buildProfile(d: Draft, base?: Profile | null): unknown {
  const stored = base ? storedDisplay(base, d.units) : null;
  const cm = draftHeightCm(d);
  const heightCm = base && stored && sameHeightFields(d, stored.height) ? base.heightCm : cm == null ? null : round(cm, 1);

  const maintain = d.goal.type === "maintain";
  const target = toKg(d.goal.targetWeight, d.units);
  const targetWeightKg =
    maintain || target == null
      ? null
      : base && stored && stored.targetWeight === d.goal.targetWeight && base.goal.targetWeightKg != null
        ? base.goal.targetWeightKg
        : round(target, 2);

  const sameUnits = base?.units === d.units;
  const n = d.nutrition;
  const bn = base?.nutrition;

  return {
    name: d.name.trim(),
    sex: d.sex,
    birthDate: d.birthDate,
    heightCm,
    units: d.units,
    timezone: d.timezone,
    activityLevel: d.activityLevel,
    goal: { type: d.goal.type, ratePercentPerWeek: maintain ? 0 : d.goal.rate, targetWeightKg },
    training: {
      ...d.training,
      days: keepOrder(d.training.days, base?.training.days),
      focusMuscles: keepOrder(d.training.focusMuscles, base?.training.focusMuscles),
      limitations: d.training.limitations.trim(),
    },
    equipment: {
      home: stableLocation(d.equipment.home, sameUnits ? base?.equipment.home : undefined),
      gym: stableLocation(d.equipment.gym, sameUnits ? base?.equipment.gym : undefined),
    },
    schedule: d.schedule,
    nutrition: {
      ...n,
      allergies: keepOrder(n.allergies, bn?.allergies),
      avoidFoods: n.avoidFoods.trim(),
      favoriteFoods: n.favoriteFoods.trim(),
      grabAndGo: keepOrder(n.grabAndGo, bn?.grabAndGo),
      kitchen: keepOrder(n.kitchen, bn?.kitchen),
    },
  };
}

function buildMeasurements(d: Draft): Measurements | null {
  const m = {} as Measurements;
  for (const k of TAPE_KEYS) {
    const v = d.tape[k];
    m[k] = v == null ? null : round(fromDisplayLength(v, d.units), 1);
  }
  m.bodyFatPercent = d.bodyFat;
  return Object.values(m).every((v) => v == null) ? null : m;
}

export type SubmitPayload = { mode: "new"; request: OnboardingRequest } | { mode: "edit"; profile: Profile };

export type BuildResult = { ok: true; payload: SubmitPayload } | { ok: false; step: StepId; message: string };

function stepForPath(path: readonly PropertyKey[]): StepId {
  const [a, b] = path;
  if (a === "weightKg") return "about";
  if (a === "measurements") return "body";
  switch (a === "profile" ? b : a) {
    case "goal":
      return "goal";
    case "activityLevel":
    case "schedule":
      return "day";
    case "training":
      return "training";
    case "equipment":
      return "equipment";
    case "nutrition":
      return "food";
    default:
      return "about";
  }
}

/** Validate the whole thing with the contract schemas and produce the request body. */
export function buildSubmission(d: Draft, mode: Mode, base?: Profile | null): BuildResult {
  const profile = buildProfile(d, base);
  const parsed =
    mode === "edit"
      ? Profile.safeParse(profile)
      : OnboardingRequest.safeParse({
          profile,
          weightKg: (() => {
            const kg = draftWeightKg(d);
            return kg == null ? null : round(kg, 2);
          })(),
          measurements: buildMeasurements(d),
        });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path ?? [];
    return { ok: false, step: stepForPath(path), message: issue ? `${path.join(".")}: ${issue.message}` : "Check your answers" };
  }
  return mode === "edit"
    ? { ok: true, payload: { mode, profile: parsed.data as Profile } }
    : { ok: true, payload: { mode, request: parsed.data as OnboardingRequest } };
}

// ---------- Per-step validation ----------

export interface ValidationContext {
  mode: Mode;
  /** Device-local today, for age checks. */
  today: string;
}

function birthDateError(value: string, today: string): string | null {
  if (!LocalDate.safeParse(value).success) return "Enter your birth date";
  const age = ageOn(value, today);
  if (!Number.isFinite(age) || age < 13 || age > 100) return "Check this date";
  return null;
}

function weightRange(units: Units) {
  return `${Math.ceil(toDisplayWeight(30, units))} and ${Math.floor(toDisplayWeight(300, units))} ${bodyUnit(units)}`;
}

function validateAbout(d: Draft, ctx: ValidationContext, e: Errors) {
  if (!Profile.shape.name.safeParse(d.name.trim()).success) e.name = "Enter your name";
  if (!d.sex) e.sex = "Choose one";
  const birth = birthDateError(d.birthDate, ctx.today);
  if (birth) e.birthDate = birth;

  const cm = draftHeightCm(d);
  if (d.units === "imperial" && d.heightIn != null && (d.heightIn < 0 || d.heightIn >= 12)) {
    e.height = "Inches should be 0 to 11";
  } else if (cm == null || !Profile.shape.heightCm.safeParse(cm).success) {
    e.height = d.units === "imperial" ? "Enter a height between 4 ft and 7 ft 6 in" : "Enter a height between 120 and 230 cm";
  }

  if (ctx.mode === "new") {
    const kg = draftWeightKg(d);
    if (kg == null || !OnboardingRequest.shape.weightKg.safeParse(kg).success)
      e.weight = `Enter a weight between ${weightRange(d.units)}`;
  }
}

function validateBody(d: Draft, e: Errors) {
  for (const k of TAPE_KEYS) {
    const v = d.tape[k];
    if (v == null) continue;
    const cm = fromDisplayLength(v, d.units);
    if (!(cm >= 10 && cm <= 250)) e[`tape.${k}`] = "Check this number";
  }
  if (d.bodyFat != null && !(d.bodyFat >= 3 && d.bodyFat <= 60)) e.bodyFat = "Between 3 and 60%";
}

function validateGoal(d: Draft, ctx: ValidationContext, e: Errors) {
  const { type, rate, targetWeight } = d.goal;
  if (type === "maintain") return;
  if (!(rate > 0 && rate <= 1.5)) e.rate = "Pick a rate up to 1.5% a week";
  if (targetWeight == null) return;
  const target = fromDisplayWeight(targetWeight, d.units);
  if (!(target >= 30 && target <= 300)) {
    e.targetWeight = `Enter a weight between ${weightRange(d.units)}`;
    return;
  }
  const current = ctx.mode === "new" ? draftWeightKg(d) : null;
  if (current == null) return;
  if (type === "lose" && target >= current) e.targetWeight = "Should be below your current weight";
  if (type === "gain" && target <= current) e.targetWeight = "Should be above your current weight";
}

function validateDay(d: Draft, e: Errors) {
  const { wakeTime, sleepTime } = d.schedule;
  if (!TimeOfDay.safeParse(wakeTime).success) e.wakeTime = "Enter a time";
  if (!TimeOfDay.safeParse(sleepTime).success) e.sleepTime = "Enter a time";
  else if (wakeTime === sleepTime) e.sleepTime = "Can't be the same as your wake time";
}

function validateTraining(d: Draft, e: Errors) {
  const t = d.training;
  if (t.days.length < 2) e.days = "Pick at least 2 days";
  else if (t.days.length > 6) e.days = "Pick up to 6 days";
  if (!Profile.shape.training.shape.sessionMinutes.safeParse(t.sessionMinutes).success)
    e.sessionMinutes = "Between 20 and 120 minutes";
  if (!TimeOfDay.safeParse(t.workoutTime).success) e.workoutTime = "Enter a time";
  if (t.focusMuscles.length > 4) e.focusMuscles = "Pick up to 4";
}

const LOCATIONS: Location[] = ["home", "gym"];

function validateEquipment(d: Draft, e: Errors) {
  for (const loc of LOCATIONS) {
    const eq = d.equipment[loc];
    if (!eq.available) continue;
    const db = eq.dumbbells;
    if (db.kind === "adjustable") {
      if (!(db.min > 0 && db.max > 0 && db.step > 0)) e[`${loc}.dumbbells`] = "Fill in all three";
      else if (db.min >= db.max) e[`${loc}.dumbbells`] = "Heaviest should be more than lightest";
      else if (db.step > db.max - db.min) e[`${loc}.dumbbells`] = "Step is bigger than the range";
    } else if (db.kind === "fixed" && db.weights.length === 0) {
      e[`${loc}.dumbbells`] = "Add at least one weight";
    }
    if (!(eq.machineStep > 0)) e[`${loc}.machineStep`] = "Enter a step";
    if (!e[`${loc}.dumbbells`] && !e[`${loc}.machineStep`] && !LocationEquipment.safeParse(eq).success) {
      e[`${loc}.dumbbells`] = "Check these numbers";
    }
  }
  const def = d.training.defaultLocation;
  if (!d.equipment[def].available) {
    e[`${def}.available`] =
      `${LOCATION_LABEL[def]} is your default place to train. Turn it on, or change the default in Training.`;
  }
}

function validateFood(d: Draft, e: Errors) {
  const b = d.nutrition.weeklyBudgetUsd;
  if (b == null || !(b >= 0)) e.weeklyBudgetUsd = "Enter a weekly budget";
}

export function validateStep(step: StepId, d: Draft, ctx: ValidationContext): Errors {
  const e: Errors = {};
  switch (step) {
    case "about":
      validateAbout(d, ctx, e);
      break;
    case "body":
      validateBody(d, e);
      break;
    case "goal":
      validateGoal(d, ctx, e);
      break;
    case "day":
      validateDay(d, e);
      break;
    case "training":
      validateTraining(d, e);
      break;
    case "equipment":
      validateEquipment(d, e);
      break;
    case "food":
      validateFood(d, e);
      break;
    case "review":
      break;
  }
  return e;
}

export const localToday = (timezone: string) => {
  try {
    return todayIn(timezone);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

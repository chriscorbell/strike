// Pure helpers for the workout screen: ordering, set lookup, load stepping, formatting.
import {
  getExercise,
  round,
  type LoadType,
  type Muscle,
  type MuscleFeedback,
  type Session,
  type SessionExercise,
} from "@strike/core";
import { fmtLoad } from "../../lib/format.ts";
import { PUMP_OPTIONS, WORKLOAD_OPTIONS } from "../../lib/labels.ts";

export type LoadUnit = Session["loadUnit"];

/**
 * A set inside a session. `edit` marks a logged set the user opened to change. `carry` is the weight just
 * used on the previous set, handed over directly because the optimistic cache update renders a tick later.
 */
export interface SetRef {
  seId: number;
  index: number;
  edit?: boolean;
  carry?: number | null;
}

export const setKey = (ref: { seId: number; index: number }) => `${ref.seId}-${ref.index}`;

export const orderedExercises = (s: Session): SessionExercise[] => [...s.exercises].sort((a, b) => a.order - b.order);

export const isLoaded = (se: SessionExercise) => se.loadType !== "bodyweight";

export const isExerciseDone = (se: SessionExercise) => se.sets.length > 0 && se.sets.every((s) => s.log);

export function setCounts(exercises: SessionExercise[]) {
  let total = 0;
  let logged = 0;
  for (const se of exercises) {
    total += se.sets.length;
    for (const s of se.sets) if (s.log) logged += 1;
  }
  return { total, logged, remaining: total - logged };
}

/** First unlogged set in session order, skipping one set (the one being logged right now). */
export function firstUnlogged(exercises: SessionExercise[], skip?: { seId: number; index: number }): SetRef | null {
  for (const se of exercises) {
    for (const s of se.sets) {
      if (s.log) continue;
      if (skip && skip.seId === se.id && skip.index === s.index) continue;
      return { seId: se.id, index: s.index };
    }
  }
  return null;
}

/** Muscles in the order they are first trained. */
export function musclesInOrder(exercises: SessionExercise[]): Muscle[] {
  const seen: Muscle[] = [];
  for (const se of exercises) if (!seen.includes(se.muscle)) seen.push(se.muscle);
  return seen;
}

/** For each muscle, the id of its first and last exercise in this session. */
export function muscleBounds(exercises: SessionExercise[]) {
  const first = new Map<Muscle, number>();
  const last = new Map<Muscle, number>();
  for (const se of exercises) {
    if (!first.has(se.muscle)) first.set(se.muscle, se.id);
    last.set(se.muscle, se.id);
  }
  return { first, last };
}

export const feedbackFor = (s: Session, muscle: Muscle): MuscleFeedback | undefined =>
  s.feedback.find((f) => f.muscle === muscle);

/**
 * Step through the loads the server says are available (`SessionExercise.loadOptions`): from any value,
 * go to the nearest real load above or below it. With no options (bodyweight added load) it falls back
 * to 5 lb / 2.5 kg steps. Stays put at the ends.
 */
export function loadStepFn(options: number[], unit: LoadUnit) {
  return (current: number, dir: 1 | -1): number => {
    if (options.length > 0) {
      if (dir > 0) return options.find((o) => o > current + 1e-6) ?? current;
      for (let i = options.length - 1; i >= 0; i--) {
        const o = options[i]!;
        if (o < current - 1e-6) return o;
      }
      return current;
    }
    const step = unit === "lb" ? 5 : 2.5;
    const next = dir > 0 ? Math.floor(current / step + 1e-9) * step + step : Math.ceil(current / step - 1e-9) * step - step;
    return Math.max(0, round(next, 2));
  };
}

/** The available load closest to a value; the value itself when there are no options. */
export function nearestLoad(value: number, options: number[]): number {
  if (options.length === 0) return value;
  return options.reduce((best, o) => (Math.abs(o - value) < Math.abs(best - value) ? o : best), options[0]!);
}

/** "50 lb × 11"; "11 reps" for bodyweight, or "BW + 25 lb × 8" with added load. */
export const fmtWorkSet = (weight: number | null, reps: number, unit: LoadUnit, bodyweight = false) =>
  weight == null ? `${reps} reps` : bodyweight ? `BW + ${fmtLoad(weight)} ${unit} × ${reps}` : `${fmtLoad(weight)} ${unit} × ${reps}`;

export const fmtRir = (rir: number) => `${rir} RIR`;

/** "50×11, 50×10, 50×9", "8, 7, 6 reps", or "+25×8, 8" for bodyweight work with added load. */
export function fmtSetList(sets: { weight: number | null; reps: number }[], bodyweight = false): string {
  if (sets.length === 0) return "";
  if (sets.every((s) => s.weight == null)) return `${sets.map((s) => s.reps).join(", ")} reps`;
  const load = (w: number) => (bodyweight ? `+${fmtLoad(w)}` : fmtLoad(w));
  return sets.map((s) => (s.weight == null ? `${s.reps}` : `${load(s.weight)}×${s.reps}`)).join(", ");
}

export const fmtRepRange = (min: number, max: number) => (min === max ? `${min} reps` : `${min}-${max} reps`);

export function feedbackSummary(fb: MuscleFeedback | undefined): string | null {
  if (!fb) return null;
  const parts: string[] = [];
  if (fb.pump != null) parts.push(`${PUMP_OPTIONS[fb.pump] ?? ""} pump`);
  if (fb.workload != null) parts.push(`${WORKLOAD_OPTIONS[fb.workload] ?? ""} workload`);
  if (fb.jointPain) parts.push("Joint pain");
  return parts.length ? parts.join(" · ") : null;
}

/** Sum of weight × reps over loaded, logged sets. */
export function sessionVolume(exercises: SessionExercise[]): number {
  let v = 0;
  for (const se of exercises) for (const s of se.sets) if (s.log?.weight != null) v += s.log.weight * s.log.reps;
  return Math.round(v);
}

export function sessionMinutes(s: Session): number | null {
  if (!s.startedAt || !s.completedAt) return null;
  const m = Math.round((Date.parse(s.completedAt) - Date.parse(s.startedAt)) / 60_000);
  return m > 0 ? m : null;
}

export const LOAD_TYPE_LABEL: Record<LoadType, string> = {
  dumbbell: "Dumbbells",
  barbell: "Barbell",
  smith: "Smith machine",
  cable: "Cable",
  machine: "Machine",
  plate_machine: "Plate-loaded",
  bodyweight: "Bodyweight",
};

export const substitutedName = (se: SessionExercise) =>
  se.substitutedFrom ? (getExercise(se.substitutedFrom)?.name ?? null) : null;

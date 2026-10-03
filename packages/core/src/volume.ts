import type { MuscleFeedback } from "./schemas.ts";

/**
 * Sets to add to (or remove from) a muscle on the same training day next week, from that muscle's
 * feedback. Joint pain, lingering soreness or an excessive workload pull volume back; an easy session
 * that was fully recovered from adds two sets; a manageable one adds one.
 */
export function setDelta(fb: Pick<MuscleFeedback, "soreness" | "pump" | "workload" | "jointPain">): number {
  const soreness = fb.soreness ?? 1;
  const workload = fb.workload ?? 1;
  const pump = fb.pump ?? 1;
  if (fb.jointPain || workload >= 3 || soreness >= 3) return -1;
  if (workload === 2 || soreness === 2) return 0;
  if (workload === 0 && soreness <= 1 && pump <= 1) return 2;
  return 1;
}

export interface SetAllocation {
  key: string;
  sets: number;
}

/**
 * Spread a change in a muscle's sets across its exercises: additions go to the exercise with the fewest
 * sets, removals come from the one with the most. Each exercise stays between 1 and 5 sets.
 */
export function distributeDelta(exercises: SetAllocation[], delta: number): SetAllocation[] {
  const out = exercises.map((e) => ({ ...e }));
  if (out.length === 0) return out;
  let remaining = delta;
  while (remaining > 0) {
    const target = out.filter((e) => e.sets < 5).sort((a, b) => a.sets - b.sets)[0];
    if (!target) break;
    target.sets += 1;
    remaining -= 1;
  }
  while (remaining < 0) {
    const target = out.filter((e) => e.sets > 1).sort((a, b) => b.sets - a.sets)[0];
    if (!target) break;
    target.sets -= 1;
    remaining += 1;
  }
  return out;
}

/** A rough cap so a session fits its time: about two and a half minutes per working set with rest. */
export const maxSetsForMinutes = (minutes: number) => Math.max(6, Math.floor(minutes / 2.5));

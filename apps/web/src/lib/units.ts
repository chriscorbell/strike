// Unit switching for values stored in the load unit (equipment), which the server does not convert.
import { round, type LocationEquipment, type Profile, type Units } from "@strike/core";

const LB_PER_KG = 2.2046226218;

const raw = (value: number, to: Units) => (to === "metric" ? value / LB_PER_KG : value * LB_PER_KG);

/** A weight snapped to what real equipment in the target unit comes in. */
function weight(value: number, to: Units): number {
  const v = raw(value, to);
  const step = to === "metric" ? (v >= 5 ? 2.5 : 0.5) : v >= 10 ? 5 : 2.5;
  return Math.max(step, round(Math.round(v / step) * step, 2));
}

/** An increment snapped to the nearest common step in the target unit. */
function increment(value: number, to: Units): number {
  const v = raw(value, to);
  const steps = to === "metric" ? [0.5, 1, 1.25, 2, 2.5, 5, 10] : [1, 2.5, 5, 10, 15, 20];
  return steps.reduce((best, s) => (Math.abs(s - v) < Math.abs(best - v) ? s : best), steps[0]!);
}

function convertLocation(loc: LocationEquipment, to: Units): LocationEquipment {
  const d = loc.dumbbells;
  return {
    ...loc,
    machineStep: increment(loc.machineStep, to),
    dumbbells:
      d.kind === "adjustable"
        ? { kind: "adjustable", min: weight(d.min, to), max: weight(d.max, to), step: increment(d.step, to) }
        : d.kind === "fixed"
          ? { kind: "fixed", weights: [...new Set(d.weights.map((w) => weight(w, to)))].sort((a, b) => a - b) }
          : d,
  };
}

/**
 * Equipment weights are in the load unit (lb for imperial, kg for metric). Convert them when units
 * change, snapping to sizes real equipment comes in (5/10/15 lb become 2.5/5/7.5 kg).
 */
export function convertEquipment(equipment: Profile["equipment"], from: Units, to: Units): Profile["equipment"] {
  if (from === to) return equipment;
  return { home: convertLocation(equipment.home, to), gym: convertLocation(equipment.gym, to) };
}

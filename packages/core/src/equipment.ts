import type { Exercise, Requirement } from "./exercises.ts";
import { EXERCISES } from "./exercises.ts";
import type { Location, LocationEquipment, Profile } from "./schemas.ts";
import { round } from "./units.ts";

export function meets(loc: LocationEquipment, req: Requirement): boolean {
  if (!loc.available) return false;
  switch (req) {
    case "dumbbells":
      return loc.dumbbells.kind !== "none";
    case "bench":
      return loc.items.includes("bench_flat") || loc.items.includes("bench_adjustable");
    case "incline_bench":
      return loc.items.includes("bench_adjustable");
    default:
      return loc.items.includes(req);
  }
}

export function isAvailable(exercise: Exercise, loc: LocationEquipment): boolean {
  return loc.available && exercise.requires.every((r) => meets(loc, r));
}

export function availableExercises(loc: LocationEquipment, avoid: string[] = []): Exercise[] {
  return EXERCISES.filter((e) => isAvailable(e, loc) && !avoid.includes(e.id));
}

export function equipmentAt(profile: Profile, location: Location): LocationEquipment {
  return profile.equipment[location];
}

function range(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  for (let w = min; w <= max + 1e-9; w += step) out.push(round(w, 2));
  return out;
}

/**
 * Every load the lifter can actually set up for this exercise at this location, ascending, in the
 * load unit. Empty for bodyweight work.
 */
export function loadOptions(exercise: Exercise, loc: LocationEquipment, unit: "lb" | "kg"): number[] {
  const lb = unit === "lb";
  switch (exercise.loadType) {
    case "bodyweight":
      return [];
    case "dumbbell": {
      const d = loc.dumbbells;
      if (d.kind === "adjustable") return range(d.min, d.max, d.step);
      if (d.kind === "fixed") return [...new Set(d.weights)].sort((a, b) => a - b);
      return [];
    }
    case "barbell":
      return lb ? range(45, 405, 5) : range(20, 180, 2.5);
    case "smith":
      return lb ? range(20, 400, 5) : range(10, 180, 2.5);
    case "cable":
    case "machine": {
      const step = loc.machineStep || (lb ? 10 : 5);
      return range(step, step * 30, step);
    }
    case "plate_machine":
      return lb ? range(0, 720, 10) : range(0, 320, 5);
  }
}

/** The largest available load at or below `target`, or the smallest load when all are heavier. */
export function snapDown(target: number, loads: number[]): number {
  if (loads.length === 0) return round(target, 1);
  let best = loads[0]!;
  for (const w of loads) if (w <= target + 1e-9) best = w;
  return best;
}

import type { Units } from "./schemas.ts";

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const cmToIn = (cm: number) => cm / CM_PER_IN;
export const inToCm = (inches: number) => inches * CM_PER_IN;

export const loadUnit = (units: Units): "lb" | "kg" => (units === "imperial" ? "lb" : "kg");

/** Body weight in the display unit, to one decimal. */
export function displayBodyWeight(kg: number, units: Units): number {
  return round(units === "imperial" ? kgToLb(kg) : kg, 1);
}

export function round(value: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

export const roundTo = (value: number, step: number) => Math.round(value / step) * step;

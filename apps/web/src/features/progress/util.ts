import { kgToLb, round, type Profile, type Units } from "@strike/core";

const nfCache = new Map<number, Intl.NumberFormat>();
const nfFixed = (decimals: number) => {
  let f = nfCache.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    nfCache.set(decimals, f);
  }
  return f;
};

/** kg to the display unit, unrounded (for chart geometry). */
export const kgToDisplay = (kg: number, units: Units) => (units === "imperial" ? kgToLb(kg) : kg);

/** Signed number with a real minus sign: "+0.4", "−0.50", "0.0". */
export function signed(n: number, decimals: number): string {
  const v = round(n, decimals);
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${nfFixed(decimals).format(Math.abs(v))}`;
}

/** Plain number with fixed decimals: "194.0". */
export const fixed = (n: number, decimals: number) => nfFixed(decimals).format(round(n, decimals));

export type GoalType = Profile["goal"]["type"];

/** Words for how the weekly rate compares to the target, so direction never relies on color. */
export function rateVerdict(rate: number | null, target: number, goal: GoalType): string | null {
  if (rate == null) return null;
  const tol = Math.max(0.08, Math.abs(target) * 0.25);
  if (goal === "maintain") {
    if (Math.abs(rate) <= tol) return "Holding steady";
    return rate > 0 ? "Trending up" : "Trending down";
  }
  if (Math.abs(rate - target) <= tol) return "On pace";
  if (goal === "lose") {
    if (rate >= 0.02) return "Not losing yet";
    return rate > target ? "Slower than target" : "Faster than target";
  }
  if (rate <= -0.02) return "Not gaining yet";
  return rate < target ? "Slower than target" : "Faster than target";
}

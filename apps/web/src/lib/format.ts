// Display formatting. Body weight and lengths arrive in kg and cm; loads arrive in the load unit.
import { cmToIn, inToCm, kgToLb, lbToKg, round, type Units } from "@strike/core";

const nf = (max: number, min = 0) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: max, minimumFractionDigits: min });
const nf0 = nf(0);
const nf1 = nf(1);
const nf1f = nf(1, 1);
const nf2 = nf(2);

export const bodyUnit = (units: Units) => (units === "imperial" ? "lb" : "kg");
export const lengthUnit = (units: Units) => (units === "imperial" ? "in" : "cm");

/** kg to the display unit, one decimal. */
export const toDisplayWeight = (kg: number, units: Units) => round(units === "imperial" ? kgToLb(kg) : kg, 1);
/** Display unit to kg (unrounded, the server stores what it gets). */
export const fromDisplayWeight = (value: number, units: Units) => (units === "imperial" ? lbToKg(value) : value);
export const toDisplayLength = (cm: number, units: Units) => round(units === "imperial" ? cmToIn(cm) : cm, 1);
export const fromDisplayLength = (value: number, units: Units) => (units === "imperial" ? inToCm(value) : value);

/** "182.4 lb" */
export const fmtBodyWeight = (kg: number | null | undefined, units: Units) =>
  kg == null ? "-" : `${nf1f.format(toDisplayWeight(kg, units))} ${bodyUnit(units)}`;

/** Signed body-weight change in display units, e.g. "-0.6 lb". */
export const fmtWeightDelta = (kg: number, units: Units, decimals = 1) => {
  const v = round(units === "imperial" ? kgToLb(kg) : kg, decimals);
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${nf(decimals, decimals).format(Math.abs(v))} ${bodyUnit(units)}`;
};

export const fmtRate = (kgPerWeek: number | null | undefined, units: Units) =>
  kgPerWeek == null ? "-" : `${fmtWeightDelta(kgPerWeek, units, 2)}/wk`;

/** Body weight number only, always one decimal: "194.0". */
export const fmtBodyWeightValue = (kg: number, units: Units) => nf1f.format(toDisplayWeight(kg, units));

export const fmtLength = (cm: number | null | undefined, units: Units) =>
  cm == null ? "-" : `${nf1.format(toDisplayLength(cm, units))} ${lengthUnit(units)}`;

/** Loads: up to two decimals, no trailing zeros. 42.5, 45, 11.25 */
export const fmtLoad = (w: number | null | undefined) => (w == null ? "BW" : nf2.format(w));
export const fmtLoadUnit = (w: number | null | undefined, unit: "lb" | "kg") =>
  w == null ? "Bodyweight" : `${nf2.format(w)} ${unit}`;

export const fmtInt = (n: number) => nf0.format(Math.round(n));
export const fmtKcal = (n: number) => nf0.format(Math.round(n));
export const fmtGrams = (n: number) => `${nf0.format(Math.round(n))} g`;
export const fmtNum = (n: number, decimals = 1) => nf(decimals).format(n);
export const fmtPercent = (n: number, decimals = 0) => `${nf(decimals).format(n)}%`;
export const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: Number.isInteger(n) ? 0 : 2, minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);

/** Volume like 12,340 or 12.3k when large. */
export const fmtVolume = (n: number) => (n >= 100_000 ? `${nf1.format(n / 1000)}k` : nf0.format(n));

export const fmtMinutes = (m: number) => {
  if (m < 60) return `${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return r ? `${h} h ${r} min` : `${h} h`;
};

/** "17:30" to "5:30 PM" */
export function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Compact time for narrow columns: "5:30" with the period separate. */
export function splitTime(hhmm: string): { clock: string; period: string } {
  const [clock, period] = fmtTime(hhmm).split(" ") as [string, string];
  return { clock, period };
}

const dateCache = new Map<string, Intl.DateTimeFormat>();
function dtf(opts: Intl.DateTimeFormatOptions) {
  const key = JSON.stringify(opts);
  let f = dateCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" });
    dateCache.set(key, f);
  }
  return f;
}
const utc = (date: string) => new Date(`${date}T00:00:00Z`);

/** "Saturday, October 3" */
export const fmtDateLong = (date: string) => dtf({ weekday: "long", month: "long", day: "numeric" }).format(utc(date));
/** "Sat, Oct 3" */
export const fmtDate = (date: string) => dtf({ weekday: "short", month: "short", day: "numeric" }).format(utc(date));
/** "Oct 3" */
export const fmtDateShort = (date: string) => dtf({ month: "short", day: "numeric" }).format(utc(date));
/** "Oct 3, 2026" */
export const fmtDateYear = (date: string) => dtf({ month: "short", day: "numeric", year: "numeric" }).format(utc(date));
/** "Saturday" */
export const fmtWeekday = (date: string) => dtf({ weekday: "long" }).format(utc(date));

/** "Today", "Yesterday", "Tomorrow" or "Sat, Oct 3" relative to `today`. */
export function fmtRelativeDay(date: string, today: string): string {
  const diff = Math.round((utc(date).getTime() - utc(today).getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  if (diff === 1) return "Tomorrow";
  return fmtDate(date);
}

/** ISO timestamp to a local "5:42 PM". */
export const fmtClock = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(iso));

/** Seconds to "1:05". */
export const fmtCountdown = (seconds: number) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Inches to feet + inches parts. */
export function cmToFeetInches(cm: number): { ft: number; inches: number } {
  const total = cmToIn(cm);
  let ft = Math.floor(total / 12);
  let inches = round(total - ft * 12, 1);
  if (inches >= 12) {
    ft += 1;
    inches -= 12;
  }
  return { ft, inches };
}

export const feetInchesToCm = (ft: number, inches: number) => inToCm(ft * 12 + inches);

export const fmtHeight = (cm: number, units: Units) => {
  if (units === "metric") return `${Math.round(cm)} cm`;
  const { ft, inches } = cmToFeetInches(cm);
  return `${ft}′ ${Math.round(inches)}″`;
};

/** Parse a user-typed number; empty or invalid gives null. */
export function parseNum(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

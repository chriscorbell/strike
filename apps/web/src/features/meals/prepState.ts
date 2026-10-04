// Cook-mode progress. Check marks persist per menu + session in localStorage (so the Prep tab, Today and
// cook mode agree, and a phone left on the counter keeps its place). Step timers are end timestamps in
// sessionStorage, so they survive a reload of the page.
import { weekStartOn, type PrepSession } from "@strike/core";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { MenuWeek } from "../../lib/endpoints.ts";
import { useProfile, useServerToday } from "../../lib/queries.ts";

export interface PrepChecks {
  equipment: number[];
  ingredients: number[];
  steps: number[];
  containers: number[];
}
export type PrepSection = keyof PrepChecks;

const EMPTY: PrepChecks = { equipment: [], ingredients: [], steps: [], containers: [] };
const checksKey = (menuId: number, index: number) => `strike.prep.${menuId}.${index}`;

const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: PrepChecks }>();

function readChecks(key: string): PrepChecks {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    raw = null;
  }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value;
  let value = EMPTY;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<PrepChecks>;
      value = {
        equipment: parsed.equipment ?? [],
        ingredients: parsed.ingredients ?? [],
        steps: parsed.steps ?? [],
        containers: parsed.containers ?? [],
      };
    } catch {
      value = EMPTY;
    }
  }
  cache.set(key, { raw, value });
  return value;
}

function writeChecks(key: string, value: PrepChecks) {
  try {
    const empty = Object.values(value).every((list) => list.length === 0);
    if (empty) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: checks last for this page view only.
    cache.set(key, { raw: null, value });
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith("strike.prep.")) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Check state for one cooking session, live across every component showing it. */
export function usePrepChecks(menuId: number, index: number) {
  const key = checksKey(menuId, index);
  const checks = useSyncExternalStore(subscribe, () => readChecks(key), () => EMPTY);

  const toggle = useCallback(
    (section: PrepSection, i: number, on: boolean) => {
      const cur = readChecks(key);
      const list = cur[section].filter((x) => x !== i);
      writeChecks(key, { ...cur, [section]: on ? [...list, i].sort((a, b) => a - b) : list });
    },
    [key],
  );
  const replace = useCallback((value: PrepChecks) => writeChecks(key, value), [key]);
  return { checks, toggle, replace, reset: () => writeChecks(key, EMPTY) };
}

/** Steps done out of the session's steps (ignores stale indexes from a rewritten guide). */
export function stepProgress(checks: PrepChecks, session: Pick<PrepSession, "steps"> | { stepCount: number }) {
  const total = "steps" in session ? session.steps.length : session.stepCount;
  const done = checks.steps.filter((i) => i < total).length;
  return { done, total };
}

// ---------- Step timers ----------

export interface StepTimer {
  /** Epoch ms when it rings. */
  endAt: number;
  /** Full length in seconds. */
  total: number;
}

const timersKey = (menuId: number, index: number) => `strike.prep-timers.${menuId}.${index}`;

function readTimers(key: string): Record<number, StepTimer> {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(key) ?? "{}") as Record<number, StepTimer>;
    // Forget timers that finished long ago.
    const cutoff = Date.now() - 30 * 60_000;
    return Object.fromEntries(Object.entries(parsed).filter(([, t]) => t && t.endAt > cutoff)) as Record<number, StepTimer>;
  } catch {
    return {};
  }
}

/** Running step timers for a session, keyed by step index. Several can run at once. */
export function useStepTimers(menuId: number, index: number) {
  const key = timersKey(menuId, index);
  const [timers, setTimers] = useState<Record<number, StepTimer>>(() => readTimers(key));

  useEffect(() => setTimers(readTimers(key)), [key]);
  useEffect(() => {
    try {
      if (Object.keys(timers).length === 0) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, JSON.stringify(timers));
    } catch {
      // Storage unavailable: timers still run for this page view.
    }
  }, [key, timers]);

  const start = useCallback((step: number, minutes: number) => {
    setTimers((t) => ({ ...t, [step]: { endAt: Date.now() + minutes * 60_000, total: minutes * 60 } }));
  }, []);
  const add = useCallback((step: number, minutes: number) => {
    setTimers((t) => {
      const cur = t[step];
      if (!cur) return t;
      const endAt = Math.max(Date.now(), cur.endAt) + minutes * 60_000;
      return { ...t, [step]: { endAt, total: cur.total + minutes * 60 } };
    });
  }, []);
  const stop = useCallback((step: number) => {
    setTimers((t) => {
      const { [step]: _gone, ...rest } = t;
      return rest;
    });
  }, []);

  return { timers, start, add, stop };
}

/** A clock that ticks only while `active`. */
export function useNow(active: boolean, intervalMs = 500) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs]);
  return now;
}

/** Keep the screen on while mounted, where the Screen Wake Lock API exists. Returns whether it's held. */
export function useWakeLock() {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const wakeLock = (navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> } }).wakeLock;
    if (!wakeLock) return;
    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;
    const acquire = async () => {
      try {
        const s = await wakeLock.request("screen");
        if (disposed) {
          void s.release();
          return;
        }
        sentinel = s;
        setHeld(true);
        s.addEventListener("release", () => setHeld(false));
      } catch {
        setHeld(false);
      }
    };
    void acquire();
    // The lock drops when the tab is hidden; take it again on return.
    const onVisible = () => {
      if (document.visibilityState === "visible" && (!sentinel || sentinel.released)) void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release();
    };
  }, []);
  return held;
}

// ---------- Routing ----------

/** Which Meals week a menu belongs to, for the way back from cook mode: weeks after this one are "next". */
export function useMenuWeek(weekStart: string | undefined): MenuWeek {
  const profile = useProfile();
  const today = useServerToday();
  if (!weekStart) return "current";
  return weekStart > weekStartOn(today, profile.schedule.checkInDay) ? "next" : "current";
}

export const prepHref = (week: MenuWeek) => (week === "next" ? "/meals?week=next&tab=prep" : "/meals?tab=prep");
export const cookHref = (menuId: number, index: number) => `/meals/prep/${menuId}/${index}`;


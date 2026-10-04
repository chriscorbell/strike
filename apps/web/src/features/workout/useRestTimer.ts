// Rest timer state is an end timestamp, so it survives re-renders, reloads (sessionStorage, per
// session) and a backgrounded tab. Ticking lives in useCountdown, inside the timer UI only.
import { useCallback, useEffect, useRef, useState } from "react";

export interface RestState {
  /** Epoch ms when rest ends. */
  endAt: number;
  /** Full length in seconds, for the progress bar. */
  total: number;
}

/** How long the finished timer stays on screen before it tidies itself away. */
const LINGER_MS = 8000;

const storageKey = (sessionId: number) => `strike.rest.${sessionId}`;

function read(sessionId: number): RestState | null {
  try {
    const raw = sessionStorage.getItem(storageKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RestState>;
    if (typeof parsed.endAt !== "number" || typeof parsed.total !== "number") return null;
    if (Date.now() > parsed.endAt + LINGER_MS) return null;
    return { endAt: parsed.endAt, total: parsed.total };
  } catch {
    return null;
  }
}

function write(sessionId: number, state: RestState | null) {
  try {
    if (state) sessionStorage.setItem(storageKey(sessionId), JSON.stringify(state));
    else sessionStorage.removeItem(storageKey(sessionId));
  } catch {
    // Storage unavailable: the timer still works for this page view.
  }
}

export function clearRestTimer(sessionId: number) {
  write(sessionId, null);
}

export function useRestTimer(sessionId: number) {
  const [rest, setRest] = useState<RestState | null>(() => read(sessionId));

  useEffect(() => write(sessionId, rest), [sessionId, rest]);

  const start = useCallback((seconds: number) => setRest({ endAt: Date.now() + seconds * 1000, total: seconds }), []);
  const stop = useCallback(() => setRest(null), []);
  const adjust = useCallback(
    (deltaSeconds: number) =>
      setRest((r) => {
        if (!r) return r;
        const now = Date.now();
        const endAt = Math.max(now, r.endAt + deltaSeconds * 1000);
        const total = Math.max((endAt - now) / 1000, r.total + deltaSeconds, 1);
        return { endAt, total };
      }),
    [],
  );

  return { rest, start, stop, adjust };
}

export type RestTimer = ReturnType<typeof useRestTimer>;

/**
 * Ticks while mounted. Calls onDone once when the countdown reaches zero while you're watching (not
 * when a long-finished timer is restored), and onExpire once the finished state has lingered.
 */
export function useCountdown(rest: RestState, onDone: () => void, onExpire: () => void) {
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef<number | null>(rest.endAt <= Date.now() ? rest.endAt : null);
  const handlers = useRef({ onDone, onExpire });
  handlers.current = { onDone, onExpire };

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (now >= rest.endAt && fired.current !== rest.endAt) {
      fired.current = rest.endAt;
      if (now - rest.endAt < 3000) handlers.current.onDone();
    }
    if (now >= rest.endAt + LINGER_MS) handlers.current.onExpire();
  }, [now, rest.endAt]);

  const remaining = Math.max(0, (rest.endAt - now) / 1000);
  return { remaining, done: remaining <= 0, fraction: rest.total > 0 ? Math.min(1, remaining / rest.total) : 0 };
}

// Sound and haptics live in lib/alerts.ts, shared with cook mode.
export { buzz, chime, primeAudio } from "../../lib/alerts.ts";

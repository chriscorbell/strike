import type { MealMenu, PrepSession } from "@strike/core";
import { ArrowLeft, ArrowRight, Check, ChefHat, Plus, Refrigerator, RotateCcw, Snowflake, Sun, Timer, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { Button } from "../../components/ui/Button.tsx";
import { EmptyState, ErrorState, Skeleton } from "../../components/ui/States.tsx";
import { toast } from "../../components/ui/Toast.tsx";
import { buzz, chime, primeAudio } from "../../lib/alerts.ts";
import { cn } from "../../lib/cn.ts";
import type { MenuWeek } from "../../lib/endpoints.ts";
import { fmtCountdown, fmtDateLong, fmtMinutes, fmtRelativeDay, fmtWeekday } from "../../lib/format.ts";
import { easeOut, spring } from "../../lib/motion.ts";
import { ApiError } from "../../lib/api.ts";
import { useMenuById, useServerToday } from "../../lib/queries.ts";
import {
  cookHref,
  prepHref,
  stepProgress,
  useMenuWeek,
  useNow,
  usePrepChecks,
  useStepTimers,
  useWakeLock,
  type PrepSection,
  type StepTimer,
} from "./prepState.ts";

/** Route: /meals/prep/:menuId/:session */
export function CookModePage() {
  const params = useParams();
  const menuId = Number(params.menuId);
  const index = Number(params.session);
  const q = useMenuById(menuId);
  const menu = q.data ?? null;
  const week = useMenuWeek(menu?.weekStart);
  const session = menu?.prepGuide?.sessions[index];

  if (q.isPending && Number.isFinite(menuId)) {
    return (
      <main className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 lg:px-10 lg:pt-8" aria-busy="true">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="mt-6 h-9 w-56" />
        <Skeleton className="mt-3 h-5 w-72" />
        <Skeleton className="mt-10 h-64" />
      </main>
    );
  }
  if (q.isError && !(q.error instanceof ApiError && q.error.status === 404)) {
    return (
      <main className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 lg:px-10">
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </main>
    );
  }
  if (!menu || !session) {
    return (
      <main className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 lg:px-10">
        <EmptyState
          icon={ChefHat}
          title="This prep session isn't available"
          action={
            <Link to="/meals?tab=prep" className="text-sm font-medium text-accent hover:underline">
              Back to Prep
            </Link>
          }
        >
          The guide may have been rewritten with fewer sessions.
        </EmptyState>
      </main>
    );
  }
  return <CookMode key={`${menuId}-${index}`} menu={menu} week={week} index={index} session={session} />;
}

function CookMode({ menu, week, index, session }: { menu: MealMenu; week: MenuWeek; index: number; session: PrepSession }) {
  const today = useServerToday();
  const sessions = menu.prepGuide?.sessions ?? [];
  const { checks, toggle, replace, reset } = usePrepChecks(menu.id, index);
  const timers = useStepTimers(menu.id, index);
  const wakeHeld = useWakeLock();
  const running = Object.keys(timers.timers).length > 0;
  const now = useNow(running);
  const fired = useRef(new Set<string>());

  // Ring once per timer when it reaches zero while the page is open.
  useEffect(() => {
    for (const [step, t] of Object.entries(timers.timers)) {
      const id = `${step}:${t.endAt}`;
      if (now >= t.endAt && !fired.current.has(id)) {
        fired.current.add(id);
        if (now - t.endAt < 5000) {
          chime();
          buzz();
          toast(`Step ${Number(step) + 1}: time's up`);
        }
      }
    }
  }, [now, timers.timers]);

  const progress = stepProgress(checks, session);
  const has = (section: PrepSection, i: number) => checks[section].includes(i);

  const onReset = () => {
    const previous = checks;
    reset();
    toast("Checks cleared", { action: { label: "Undo", onClick: () => replace(previous) } });
  };

  const rel = fmtRelativeDay(session.date, today);
  const eatBy = (date: string) => {
    const r = fmtRelativeDay(date, today);
    return r === "Today" ? "Eat today" : r === "Tomorrow" ? "Eat by tomorrow" : `Eat by ${fmtWeekday(date).slice(0, 3)}`;
  };

  return (
    <main className={cn("mx-auto w-full max-w-5xl px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 lg:px-10 lg:pt-8", running ? "pb-44" : "pb-24")}>
      <div className="flex h-11 items-center justify-between">
        <Link
          to={prepHref(week)}
          className="-ml-2 inline-flex h-11 items-center gap-1.5 rounded-xl px-2 text-[15px] font-medium text-ink-2 transition-colors hover:text-ink"
        >
          <ArrowLeft size={18} aria-hidden />
          Prep
        </Link>
        <Button variant="ghost" size="sm" icon={RotateCcw} onClick={onReset} disabled={Object.values(checks).every((l) => l.length === 0)}>
          Reset
        </Button>
      </div>

      <motion.header initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={easeOut} className="mt-4">
        <p className="text-[15px] font-medium text-ink-3">
          {rel === "Today" || rel === "Tomorrow" || rel === "Yesterday" ? `${rel}, ${fmtDateLong(session.date)}` : fmtDateLong(session.date)}
        </p>
        <h1 className="mt-1 text-[30px] font-semibold leading-[1.1] tracking-tight text-ink lg:text-[34px]">{session.title}</h1>
        <p className="mt-2 text-[17px] leading-snug text-ink-2">{session.covers}</p>
        <p className="tnum mt-1 text-[15px] text-ink-3">
          {fmtMinutes(session.activeMinutes)} hands-on, {fmtMinutes(session.totalMinutes)} total
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="min-w-48 flex-1 sm:max-w-xs">
            <p className="tnum text-sm text-ink-2">
              {progress.done} of {progress.total} steps
            </p>
            <div
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-accent/15"
              role="progressbar"
              aria-label="Steps done"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.done}
            >
              <motion.div
                className="h-full rounded-full bg-accent"
                initial={false}
                animate={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 22 }}
              />
            </div>
          </div>
          {wakeHeld && (
            <p className="inline-flex items-center gap-1.5 text-[13px] text-ink-3">
              <Sun size={14} aria-hidden />
              Screen stays on
            </p>
          )}
        </div>
      </motion.header>

      <div className="mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-10 lg:sticky lg:top-8 lg:self-start">
          {session.equipment.length > 0 && (
            <CookSection title="Equipment" done={checks.equipment.length} total={session.equipment.length}>
              {session.equipment.map((item, i) => (
                <li key={i}>
                  <CheckRow checked={has("equipment", i)} onToggle={(on) => toggle("equipment", i, on)}>
                    <span className={cn("text-[16px] leading-snug", has("equipment", i) ? "text-ink-3 line-through decoration-ink-3/50" : "text-ink")}>
                      {item}
                    </span>
                  </CheckRow>
                </li>
              ))}
            </CookSection>
          )}
          {session.ingredients.length > 0 && (
            <CookSection title="Get out" done={checks.ingredients.length} total={session.ingredients.length}>
              {session.ingredients.map((ing, i) => (
                <li key={i}>
                  <CheckRow checked={has("ingredients", i)} onToggle={(on) => toggle("ingredients", i, on)}>
                    {/* Amounts can be a whole sentence ("52 oz to cook today, 31 oz to freeze"), so they sit under the name and wrap. */}
                    <span className={cn("block text-[16px] leading-snug", has("ingredients", i) ? "text-ink-3 line-through decoration-ink-3/50" : "text-ink")}>
                      {ing.item}
                    </span>
                    <span className="tnum mt-0.5 block text-[15px] leading-snug text-ink-3">{ing.amount}</span>
                  </CheckRow>
                </li>
              ))}
            </CookSection>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-10">
          <CookSection title="Steps" done={progress.done} total={progress.total}>
            {session.steps.map((step, i) => {
              const done = has("steps", i);
              const timer = timers.timers[i];
              return (
                <li key={i} id={`step-${i}`} className="scroll-mb-40 scroll-mt-6">
                  <CheckRow checked={done} onToggle={(on) => toggle("steps", i, on)} marker={i + 1} large>
                    <span className={cn("block text-[17px] leading-relaxed transition-colors", done ? "text-ink-3" : "text-ink")}>{step.text}</span>
                    {step.tip && <span className="mt-1.5 block text-[15px] leading-relaxed text-ink-3">{step.tip}</span>}
                  </CheckRow>
                  {step.timerMinutes > 0 && (
                    <div className="pb-2 pl-[3.25rem] pr-3">
                      <StepTimerControl
                        minutes={step.timerMinutes}
                        timer={timer}
                        now={now}
                        onStart={() => {
                          primeAudio();
                          timers.start(i, step.timerMinutes);
                        }}
                        onAdd={() => timers.add(i, 1)}
                        onStop={() => timers.stop(i)}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </CookSection>

          {session.containers.length > 0 && (
            <CookSection title="Pack" done={checks.containers.length} total={session.containers.length}>
              {session.containers.map((c, i) => {
                const done = has("containers", i);
                return (
                  <li key={i}>
                    <CheckRow checked={done} onToggle={(on) => toggle("containers", i, on)}>
                      <span className={cn("block text-[16px] font-semibold leading-snug", done ? "text-ink-3" : "text-ink")}>{c.label}</span>
                      <span className="mt-0.5 block text-[15px] leading-relaxed text-ink-2">{c.contents}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-ink-3">
                        <span className="inline-flex items-center gap-1.5">
                          {c.storage === "freezer" ? <Snowflake size={15} aria-hidden /> : <Refrigerator size={15} aria-hidden />}
                          {c.storage === "freezer" ? "Freezer" : "Fridge"}
                        </span>
                        <span>{eatBy(c.eatBy)}</span>
                      </span>
                    </CheckRow>
                  </li>
                );
              })}
            </CookSection>
          )}

          {sessions.length > 1 && (
            <nav aria-label="Other prep sessions" className="grid gap-3 sm:grid-cols-2">
              {index > 0 ? (
                <SessionLink to={cookHref(menu.id, index - 1)} dir="prev" title={sessions[index - 1]!.title} date={sessions[index - 1]!.date} />
              ) : (
                <span className="hidden sm:block" />
              )}
              {index < sessions.length - 1 && (
                <SessionLink to={cookHref(menu.id, index + 1)} dir="next" title={sessions[index + 1]!.title} date={sessions[index + 1]!.date} />
              )}
            </nav>
          )}
        </div>
      </div>

      <TimerDock timers={timers.timers} now={now} steps={session.steps.length} />
    </main>
  );
}

function CookSection({ title, done, total, children }: { title: string; done: number; total: number; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-[19px] font-semibold tracking-tight text-ink">{title}</h2>
        <span className={cn("tnum text-sm", done >= total && total > 0 ? "text-accent" : "text-ink-3")}>
          {Math.min(done, total)} of {total}
        </span>
      </div>
      <ul className="-mx-3 flex flex-col">{children}</ul>
    </section>
  );
}

interface CheckRowProps {
  checked: boolean;
  onToggle: (on: boolean) => void;
  children: ReactNode;
  /** A step number shown until it's checked. */
  marker?: number;
  large?: boolean;
}

/** A big, whole-row checkbox for use with wet hands. */
function CheckRow({ checked, onToggle, children, marker, large }: CheckRowProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onToggle(!checked)}
      className={cn(
        "flex w-full items-start gap-3.5 rounded-xl px-3 text-left transition-colors hover:bg-surface active:bg-raised",
        large ? "min-h-16 py-3.5" : "min-h-14 py-3",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full border-2 text-[13px] font-semibold transition-colors duration-200",
          large ? "mt-0.5 size-8" : "mt-px size-6",
          checked ? "border-accent bg-accent text-accent-ink" : "border-line-strong text-ink-2",
        )}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {checked ? (
            <motion.span key="check" initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={spring}>
              <Check size={large ? 17 : 14} strokeWidth={3} />
            </motion.span>
          ) : marker !== undefined ? (
            <motion.span key="n" className="tnum" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {marker}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );
}

interface StepTimerControlProps {
  minutes: number;
  timer: StepTimer | undefined;
  now: number;
  onStart: () => void;
  onAdd: () => void;
  onStop: () => void;
}

function StepTimerControl({ minutes, timer, now, onStart, onAdd, onStop }: StepTimerControlProps) {
  if (!timer) {
    return (
      <Button variant="outline" icon={Timer} onClick={onStart}>
        Start {minutes}-min timer
      </Button>
    );
  }
  const remaining = Math.max(0, (timer.endAt - now) / 1000);
  const done = remaining <= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={easeOut}
      className={cn("flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2", done ? "border-accent/50 bg-accent-soft" : "border-line-strong bg-surface")}
    >
      <span className={cn("inline-flex items-center gap-2", done ? "text-accent" : "text-ink")}>
        <Timer size={18} aria-hidden />
        <span className="font-mono text-[22px] font-medium tabular-nums" aria-live="off">
          {done ? "Done" : fmtCountdown(remaining)}
        </span>
      </span>
      <span className="sr-only" aria-live="polite">
        {done ? "Timer done" : ""}
      </span>
      <span className="ml-auto flex gap-1.5">
        {!done && (
          <Button size="sm" variant="secondary" icon={Plus} onClick={onAdd} aria-label="Add a minute">
            1 min
          </Button>
        )}
        <Button size="sm" variant={done ? "primary" : "ghost"} icon={done ? Check : X} onClick={onStop}>
          {done ? "Dismiss" : "Cancel"}
        </Button>
      </span>
    </motion.div>
  );
}

/** Running timers stay visible at the bottom wherever you've scrolled. Tap one to jump to its step. */
function TimerDock({ timers, now, steps }: { timers: Record<number, StepTimer>; now: number; steps: number }) {
  const list = Object.entries(timers)
    .map(([step, t]) => ({ step: Number(step), t }))
    .filter(({ step }) => step < steps)
    .sort((a, b) => a.t.endAt - b.t.endAt);
  return (
    <AnimatePresence>
      {list.length > 0 && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 380, damping: 38 }}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 pb-safe backdrop-blur-xl lg:left-60"
          aria-label="Running timers"
          role="region"
        >
          <ul className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 py-3 sm:px-6 lg:px-10">
            {list.map(({ step, t }) => {
              const remaining = Math.max(0, (t.endAt - now) / 1000);
              const done = remaining <= 0;
              return (
                <li key={step} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => document.getElementById(`step-${step}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                    className={cn(
                      "inline-flex h-12 items-center gap-2.5 rounded-full border px-4 transition-colors",
                      done ? "border-accent/50 bg-accent text-accent-ink" : "border-line-strong bg-surface text-ink hover:bg-raised",
                    )}
                  >
                    <span className={cn("text-sm font-medium", done ? "text-accent-ink" : "text-ink-3")}>Step {step + 1}</span>
                    <span className="font-mono text-lg font-medium tabular-nums">{done ? "Done" : fmtCountdown(remaining)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SessionLink({ to, dir, title, date }: { to: string; dir: "prev" | "next"; title: string; date: string }) {
  return (
    <Link
      to={to}
      className={cn(
        "group flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 transition-colors hover:border-line-strong",
        dir === "next" && "justify-end text-right sm:col-start-2",
      )}
    >
      {dir === "prev" && <ArrowLeft size={18} className="shrink-0 text-ink-3 transition-transform group-hover:-translate-x-0.5" aria-hidden />}
      <span className="min-w-0">
        <span className="block text-[13px] text-ink-3">{dir === "prev" ? "Previous" : "Next"}</span>
        <span className="block truncate text-[15px] font-medium text-ink">
          {title}, {fmtWeekday(date)}
        </span>
      </span>
      {dir === "next" && <ArrowRight size={18} className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />}
    </Link>
  );
}

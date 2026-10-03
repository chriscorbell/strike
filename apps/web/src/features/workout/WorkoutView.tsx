import type { Session, SessionExercise } from "@strike/core";
import { CalendarX, Check, Flag } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Page, Panel } from "../../components/Page.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { ProgressRing } from "../../components/ui/ProgressRing.tsx";
import { Segmented } from "../../components/ui/Segmented.tsx";
import { Sheet } from "../../components/ui/Sheet.tsx";
import { toast } from "../../components/ui/Toast.tsx";
import { cn } from "../../lib/cn.ts";
import { fmtCountdown } from "../../lib/format.ts";
import { LOCATION_LABEL } from "../../lib/labels.ts";
import { useMediaQuery } from "../../lib/useMediaQuery.ts";
import { useProfile } from "../../lib/queries.ts";
import { OverflowMenu } from "./controls.tsx";
import { ExerciseCard } from "./ExerciseCard.tsx";
import {
  feedbackFor,
  firstUnlogged,
  isExerciseDone,
  loadsFor,
  muscleBounds,
  orderedExercises,
  restSecondsFor,
  setCounts,
  setKey,
  type SetRef,
} from "./lib.ts";
import { RestDock, RestPanel } from "./RestTimer.tsx";
import { availableLocations, locationOptions, SessionHeader, SessionMeta, SkipSheet } from "./SessionHeader.tsx";
import type { Draft } from "./SetRow.tsx";
import { SwapSheet } from "./SwapSheet.tsx";
import { buzz, chime, clearRestTimer, primeAudio, useRestTimer } from "./useRestTimer.ts";
import type { SessionActions } from "./useSessionActions.ts";

/** Selection only sticks while it points at a set that still makes sense. */
function resolveSelected(selected: SetRef | null, exercises: SessionExercise[]): SetRef | null {
  if (!selected) return null;
  const se = exercises.find((e) => e.id === selected.seId);
  if (!se) return null;
  if (selected.index === se.sets.length) return selected;
  const set = se.sets[selected.index];
  if (!set) return null;
  if (set.log && !selected.edit) return null;
  return selected;
}

interface WorkoutViewProps {
  session: Session;
  actions: SessionActions;
}

export function WorkoutView({ session, actions }: WorkoutViewProps) {
  const profile = useProfile();
  const navigate = useNavigate();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const reduceMotion = useReducedMotion();
  const timer = useRestTimer(session.id);

  const exercises = useMemo(() => orderedExercises(session), [session]);
  const { total, logged, remaining } = setCounts(exercises);
  const bounds = useMemo(() => muscleBounds(exercises), [exercises]);
  const equipment = profile.equipment[session.location];
  const loads = useMemo(
    () => new Map(exercises.map((se) => [se.id, loadsFor(se, equipment, session.loadUnit)] as const)),
    [exercises, equipment, session.loadUnit],
  );

  const [selected, setSelected] = useState<SetRef | null>(null);
  const defaultActive = firstUnlogged(exercises);
  const active = resolveSelected(selected, exercises) ?? defaultActive;

  const [announcement, setAnnouncement] = useState("");
  /** CSS selectors to focus and scroll to after the next render; either may only exist a tick later. */
  const [focusTarget, setFocusTarget] = useState<{ focus: string; scrollTo?: string; block?: ScrollLogicalPosition } | null>(null);
  const scrollTimer = useRef<number | undefined>(undefined);
  const [swapId, setSwapId] = useState<number | null>(null);
  const [swapOpen, setSwapOpen] = useState(false);
  const [confirm, setConfirm] = useState<"finish" | "skip" | null>(null);

  // Move focus (and the viewport, gently) to where the next action is.
  useEffect(() => {
    if (!focusTarget) return;
    setFocusTarget(null);
    const { focus, scrollTo, block = "nearest" } = focusTarget;
    const focused = document.querySelector<HTMLElement>(focus);
    focused?.focus({ preventScroll: true });
    if (focused && !scrollTo) return;
    window.clearTimeout(scrollTimer.current);
    // After the expand animation, and after the optimistic cache update has rendered.
    scrollTimer.current = window.setTimeout(() => {
      if (!focused) document.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true });
      if (scrollTo) document.querySelector(scrollTo)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block });
    }, 360);
  }, [focusTarget, reduceMotion]);
  useEffect(() => () => window.clearTimeout(scrollTimer.current), []);

  // Browsers only allow sound after a tap; prime on the first one (covers a timer restored on reload).
  useEffect(() => {
    document.addEventListener("pointerdown", primeAudio, { once: true });
    return () => document.removeEventListener("pointerdown", primeAudio);
  }, []);

  const exerciseOf = (seId: number) => exercises.find((e) => e.id === seId);

  const onLog = (se: SessionExercise, index: number, draft: Draft) => {
    primeAudio();
    const editing = !!se.sets[index]?.log;
    actions.logSet.mutate({ sessionExerciseId: se.id, setIndex: index, weight: draft.weight, reps: draft.reps, rir: draft.rir });

    if (editing) {
      setSelected(null);
      setAnnouncement(`Set ${index + 1} updated`);
      setFocusTarget({ focus: `#rowbtn-${setKey({ seId: se.id, index })}` });
      return;
    }

    const next =
      se.sets.find((s) => s.index > index && !s.log) ??
      se.sets.find((s) => s.index !== index && !s.log) ??
      null;
    const nextRef: SetRef | null = next
      ? { seId: se.id, index: next.index, carry: draft.weight }
      : firstUnlogged(exercises, { seId: se.id, index });
    setSelected(nextRef);

    const left = remaining - (index < se.sets.length ? 1 : 0);
    if (left > 0) {
      const seconds = restSecondsFor(se.exerciseId);
      timer.start(seconds);
      setAnnouncement(`Set ${index + 1} logged. Rest ${fmtCountdown(seconds)}.`);
    } else {
      timer.stop();
      setAnnouncement(`Set ${index + 1} logged. Every set is done.`);
    }

    // Finishing a muscle's last exercise: ask for its feedback before moving on.
    const fb = feedbackFor(session, se.muscle);
    const finishesMuscle =
      bounds.last.get(se.muscle) === se.id && se.sets.every((s) => s.log || s.index === index) && (fb?.pump == null || fb.workload == null);
    if (finishesMuscle) {
      setFocusTarget({ focus: `#fb-${se.id} [role="radio"]`, scrollTo: `#fb-${se.id}`, block: "center" });
    } else if (nextRef) {
      const newExercise = nextRef.seId !== se.id;
      setFocusTarget({
        focus: `#log-${setKey(nextRef)}`,
        scrollTo: newExercise ? `#ex-${nextRef.seId}` : `#row-${setKey(nextRef)}`,
        block: newExercise ? "start" : "nearest",
      });
    }
  };

  const onDelete = (se: SessionExercise, index: number) => {
    const log = se.sets[index]?.log;
    if (!log) return;
    actions.deleteSet.mutate({ seId: se.id, index, logId: log.id });
    // Stay on the set you were working toward, rather than jumping back to the one just cleared.
    setSelected(defaultActive);
    setFocusTarget({ focus: `#rowbtn-${setKey({ seId: se.id, index })}` });
    toast(`Set ${index + 1} deleted`, {
      action: {
        label: "Undo",
        onClick: () =>
          actions.logSet.mutate({ sessionExerciseId: se.id, setIndex: index, weight: log.weight, reps: log.reps, rir: log.rir }),
      },
    });
  };

  const onAddSet = (se: SessionExercise) => {
    const ref = { seId: se.id, index: se.sets.length };
    setSelected(ref);
    setFocusTarget({ focus: `#log-${setKey(ref)}`, scrollTo: `#row-${setKey(ref)}` });
  };

  const onSwap = (se: SessionExercise) => {
    setSwapId(se.id);
    setSwapOpen(true);
  };

  const finish = () => {
    if (logged === 0) return;
    if (remaining > 0) setConfirm("finish");
    else doFinish();
  };
  const doFinish = () =>
    actions.complete.mutate(undefined, {
      onSuccess: () => {
        clearRestTimer(session.id);
        window.scrollTo({ top: 0 });
      },
    });
  const doSkip = () =>
    actions.skip.mutate(undefined, {
      onSuccess: () => {
        clearRestTimer(session.id);
        toast("Workout skipped");
        void navigate("/");
      },
    });

  const onRestDone = () => {
    chime();
    buzz();
    setAnnouncement("Rest over");
  };

  const locations = availableLocations(session, profile.equipment);
  const unloggedByExercise = exercises
    .map((se) => ({ se, left: se.sets.filter((s) => !s.log).length }))
    .filter((x) => x.left > 0);

  const finishButton = (className?: string) => (
    <div className={className}>
      <Button
        variant={remaining === 0 && total > 0 ? "primary" : "outline"}
        size="lg"
        block
        icon={Flag}
        disabled={logged === 0}
        loading={actions.complete.isPending}
        onClick={finish}
      >
        Finish workout
      </Button>
      {logged === 0 && <p className="mt-2 text-center text-[13px] text-ink-3">Log a set to finish</p>}
    </div>
  );

  return (
    <Page wide className="lg:pb-16">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-10 xl:gap-14">
        <div className="min-w-0">
          <SessionHeader
            session={session}
            meta={<SessionMeta session={session} />}
            actions={
              <OverflowMenu
                items={[
                  { label: "Finish workout", icon: Flag, onSelect: finish, disabled: logged === 0 },
                  { label: "Skip workout", icon: CalendarX, onSelect: () => setConfirm("skip"), tone: "danger" },
                ]}
              />
            }
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              {locations.length > 1 ? (
                <Segmented
                  label="Location"
                  options={locationOptions(locations)}
                  value={session.location}
                  onChange={(l) => l !== session.location && actions.setLocation.mutate(l)}
                  disabled={actions.setLocation.isPending}
                />
              ) : (
                <span className="text-sm text-ink-3">{LOCATION_LABEL[session.location]}</span>
              )}
              <p className="ml-auto text-sm text-ink-3 tnum lg:hidden">
                <span className="font-medium text-ink">{logged}</span> of {total} sets
              </p>
            </div>
          </SessionHeader>

          <div className="flex flex-col gap-4">
            {exercises.map((se) => {
              const fb = feedbackFor(session, se.muscle);
              const muscleStarted = exercises.some((e) => e.muscle === se.muscle && e.sets.some((s) => s.log));
              return (
                <ExerciseCard
                  key={se.id}
                  session={session}
                  exercise={se}
                  active={active}
                  loads={loads.get(se.id) ?? []}
                  feedback={fb}
                  askSoreness={bounds.first.get(se.muscle) === se.id && fb?.soreness == null && !muscleStarted}
                  askFeedback={bounds.last.get(se.muscle) === se.id && isExerciseDone(se)}
                  onSelect={setSelected}
                  onCancel={() => setSelected(null)}
                  onLog={onLog}
                  onDelete={onDelete}
                  onAddSet={onAddSet}
                  onSwap={onSwap}
                  onFeedback={actions.sendFeedback}
                />
              );
            })}
          </div>

          {!desktop && finishButton("mt-8")}
        </div>

        {desktop && (
          <aside aria-label="Workout progress" className="sticky top-10 flex flex-col gap-4">
            <Panel className="p-5">
              <div className="flex items-center gap-4">
                <ProgressRing value={total ? logged / total : 0} size={56} stroke={5} label={`${logged} of ${total} sets logged`}>
                  {remaining === 0 && total > 0 ? (
                    <Check size={20} strokeWidth={2.75} className="text-accent" aria-hidden />
                  ) : (
                    <span className="text-[13px] font-semibold text-ink tnum">{logged}</span>
                  )}
                </ProgressRing>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-ink tnum">
                    {logged} of {total} sets
                  </p>
                  <p className="text-sm text-ink-3">{remaining === 0 ? "All logged" : `${remaining} to go`}</p>
                </div>
              </div>
              <ol className="mt-4 flex flex-col border-t border-line pt-2">
                {exercises.map((se) => {
                  const doneSets = se.sets.filter((s) => s.log).length;
                  const current = active?.seId === se.id;
                  return (
                    <li key={se.id}>
                      <button
                        type="button"
                        onClick={() =>
                          document
                            .getElementById(`ex-${se.id}`)
                            ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" })
                        }
                        className={cn(
                          "-mx-2 flex h-10 w-[calc(100%+1rem)] items-center gap-2.5 rounded-xl px-2 text-left text-sm transition-colors hover:bg-raised",
                          current ? "font-medium text-ink" : "text-ink-3",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            isExerciseDone(se) ? "bg-accent" : current ? "bg-ink" : "bg-line-strong",
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate">{se.name}</span>
                        <span className="shrink-0 text-[13px] text-ink-3 tnum">
                          {doneSets}/{se.sets.length}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </Panel>
            <RestPanel timer={timer} onDone={onRestDone} />
            {finishButton()}
          </aside>
        )}
      </div>

      {!desktop && <RestDock timer={timer} onDone={onRestDone} />}

      <SwapSheet
        session={session}
        exercise={swapId != null ? exerciseOf(swapId) : undefined}
        open={swapOpen}
        pending={actions.swap.isPending}
        onClose={() => setSwapOpen(false)}
        onSwap={(exerciseId, permanent) => {
          if (swapId == null) return;
          actions.swap.mutate(
            { seId: swapId, exerciseId, permanent },
            {
              onSuccess: () => {
                setSwapOpen(false);
                toast(permanent ? "Swapped for the rest of the block" : "Swapped for today");
              },
            },
          );
        }}
      />

      <Sheet
        open={confirm === "finish"}
        onClose={() => setConfirm(null)}
        title={`Finish with ${remaining} ${remaining === 1 ? "set" : "sets"} left?`}
        description="Sets you haven't logged won't count."
        footer={
          <div className="flex gap-2">
            <Button size="lg" className="flex-1" onClick={() => setConfirm(null)}>
              Keep going
            </Button>
            <Button variant="primary" size="lg" className="flex-1" icon={Flag} loading={actions.complete.isPending} onClick={doFinish}>
              Finish
            </Button>
          </div>
        }
      >
        <ul className="divide-y divide-line">
          {unloggedByExercise.map(({ se, left }) => (
            <li key={se.id} className="flex items-center justify-between gap-3 py-2.5 text-[15px]">
              <span className="min-w-0 truncate text-ink-2">{se.name}</span>
              <span className="shrink-0 text-sm text-ink-3 tnum">
                {left} {left === 1 ? "set" : "sets"}
              </span>
            </li>
          ))}
        </ul>
      </Sheet>

      <SkipSheet
        open={confirm === "skip"}
        label={session.label}
        pending={actions.skip.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={doSkip}
      />

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </Page>
  );
}

// Shown right after onboarding while the coach writes the first training block and meal plan.
import type { JobKind, StateResponse } from "@strike/core";
import { ArrowRight, CircleCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { Wordmark } from "../../components/AppShell.tsx";
import { WorkingGlyph } from "../../components/CoachStatus.tsx";
import { MacroLine } from "../../components/Macros.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { fmtKcal } from "../../lib/format.ts";
import { JOB_LABEL } from "../../lib/labels.ts";
import { easeOut, itemVariants, listVariants, spring } from "../../lib/motion.ts";
import { usePendingJobs } from "../../lib/queries.ts";

/** Onboarding always queues these two. */
const EXPECTED: JobKind[] = ["mesocycle", "meal_menu"];

const DONE_LABEL: Record<JobKind, string> = {
  mesocycle: "Training block ready",
  meal_menu: "This week's meals ready",
  prep_guide: "Prep guide ready",
  check_in_note: "Check-in note ready",
  more_options: "More meal options ready",
  estimate_meal: "Meal estimated",
};

export function BuildingScreen({ state, onContinue }: { state: StateResponse; onContinue: () => void }) {
  const pending = usePendingJobs();
  const jobs = pending.data;
  const loaded = pending.isSuccess;
  const seen = useRef(new Set<JobKind>(EXPECTED));
  for (const j of jobs ?? []) seen.current.add(j.kind);
  const kinds = [...seen.current];
  const allDone = loaded && (jobs?.length ?? 0) === 0;

  const continued = useRef(false);
  const go = () => {
    if (continued.current) return;
    continued.current = true;
    onContinue();
  };
  const goRef = useRef(go);
  goRef.current = go;

  // Everything finished: give the checkmarks a moment, then move on.
  useEffect(() => {
    if (!allDone) return;
    const timer = window.setTimeout(() => goRef.current(), 1600);
    return () => window.clearTimeout(timer);
  }, [allDone]);

  const t = state.targets;

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 lg:pt-10">
      <header className="flex min-h-11 items-center">
        <Wordmark />
      </header>

      <motion.div
        variants={listVariants}
        initial="initial"
        animate="animate"
        className="flex flex-1 flex-col justify-center py-10"
      >
        <motion.div variants={itemVariants} aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.h1
              key={allDone ? "done" : "working"}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0, transition: easeOut }}
              exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
              className="text-[26px] font-semibold leading-tight tracking-tight text-ink"
            >
              {allDone ? "Your plan is ready" : "Building your plan"}
            </motion.h1>
          </AnimatePresence>
          {state.coachAvailable && !allDone && (
            <p className="mt-2 text-[15px] leading-relaxed text-ink-3">
              This can take a few minutes. You can start using Strike now.
            </p>
          )}
        </motion.div>

        <motion.ul variants={itemVariants} className="mt-8 divide-y divide-line border-y border-line">
          {kinds.map((kind) => {
            const working = !loaded || (jobs ?? []).some((j) => j.kind === kind);
            return (
              <li key={kind} className="flex min-h-14 items-center gap-3.5 py-3">
                <span className="flex size-6 shrink-0 items-center justify-center">
                  <AnimatePresence mode="wait" initial={false}>
                    {working ? (
                      <motion.span key="working" exit={{ opacity: 0, transition: { duration: 0.12 } }} className="flex">
                        <WorkingGlyph className="h-3.5" />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="done"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={spring}
                        className="flex text-accent"
                      >
                        <CircleCheck size={20} aria-hidden />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
                <span className={working ? "text-[15px] text-ink" : "text-[15px] text-ink-2"}>
                  {working ? JOB_LABEL[kind] : DONE_LABEL[kind]}
                </span>
              </li>
            );
          })}
        </motion.ul>

        {t && (
          <motion.dl variants={itemVariants} className="mt-8 grid grid-cols-2 gap-x-6 gap-y-1">
            {(
              [
                ["Training days", t.training],
                ["Rest days", t.rest],
              ] as const
            ).map(([label, m]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[13px] font-medium text-ink-3">{label}</dt>
                <dd className="tnum mt-1 text-[22px] font-semibold tracking-tight text-ink">
                  {fmtKcal(m.kcal)}
                  <span className="ml-1 text-sm font-normal text-ink-3">kcal</span>
                </dd>
                <dd className="mt-0.5">
                  <MacroLine macros={m} kcalFirst={false} />
                </dd>
              </div>
            ))}
          </motion.dl>
        )}

        <motion.div variants={itemVariants} className="mt-10">
          <Button size="lg" variant="primary" iconRight={ArrowRight} onClick={go} block>
            Go to Today
          </Button>
        </motion.div>
      </motion.div>
    </main>
  );
}

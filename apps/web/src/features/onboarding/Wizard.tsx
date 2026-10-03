// The profile wizard, shared by first-run onboarding and Edit profile.
import type { Profile, Units } from "@strike/core";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { useEffect, useId, useRef, useState, type ComponentType } from "react";
import { Wordmark } from "../../components/AppShell.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { toastError } from "../../components/ui/Toast.tsx";
import { cn } from "../../lib/cn.ts";
import { pageVariants, softSpring, spring } from "../../lib/motion.ts";
import {
  STEP_LABEL,
  buildSubmission,
  draftWeightKg,
  localToday,
  stepsFor,
  switchUnits,
  unitFingerprint,
  validateStep,
  withUnitFields,
  type Draft,
  type Mode,
  type StepId,
  type SubmitPayload,
} from "./model.ts";
import { AboutStep } from "./steps/AboutStep.tsx";
import { BodyStep } from "./steps/BodyStep.tsx";
import { DayStep } from "./steps/DayStep.tsx";
import { EquipmentStep } from "./steps/EquipmentStep.tsx";
import { FoodStep } from "./steps/FoodStep.tsx";
import { GoalStep } from "./steps/GoalStep.tsx";
import { ReviewStep } from "./steps/ReviewStep.tsx";
import { TrainingStep } from "./steps/TrainingStep.tsx";
import type { StepProps } from "./steps/types.ts";

const STEP_COMPONENT: Record<StepId, ComponentType<StepProps>> = {
  about: AboutStep,
  body: BodyStep,
  goal: GoalStep,
  day: DayStep,
  training: TrainingStep,
  equipment: EquipmentStep,
  food: FoodStep,
  review: ReviewStep,
};

const DESCRIPTION: Partial<Record<StepId, string>> = {
  body: "All optional. With waist and neck, Strike estimates your body fat.",
  day: "Meals are timed around your day.",
  equipment: "Your plan only uses what you have.",
};

const FOCUSABLE = "input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])";

const stepVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -20, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } }),
};

export interface WizardProgress {
  draft: Draft;
  step: StepId;
  furthest: number;
}

interface WizardProps {
  mode: Mode;
  initialDraft: Draft;
  initialStep?: StepId;
  /** Index of the furthest step reached, for resuming. */
  initialFurthest?: number;
  /** The stored profile when editing. Untouched values are sent back exactly. */
  base?: Profile | null;
  /** Body weight for goal hints when editing (onboarding uses the typed-in weight). */
  currentWeightKg?: number | null;
  submitting: boolean;
  onSubmit: (payload: SubmitPayload) => void;
  /** Edit mode: leave without saving. */
  onExit?: () => void;
  onProgress?: (progress: WizardProgress) => void;
}

export function Wizard({
  mode,
  initialDraft,
  initialStep,
  initialFurthest = 0,
  base,
  currentWeightKg: weightProp = null,
  submitting,
  onSubmit,
  onExit,
  onProgress,
}: WizardProps) {
  const steps = stepsFor(mode);
  /** Order used for slide direction and the side rail. Editing starts from the overview. */
  const order: StepId[] = mode === "edit" ? ["review", ...steps.filter((s) => s !== "review")] : steps;
  const first = initialStep && steps.includes(initialStep) ? initialStep : steps[0]!;

  const [draft, setDraft] = useState(initialDraft);
  const [step, setStep] = useState<StepId>(first);
  const [dir, setDir] = useState(1);
  const [furthest, setFurthest] = useState(() => Math.max(initialFurthest, steps.indexOf(first)));
  const [attempted, setAttempted] = useState<ReadonlySet<StepId>>(() => new Set());
  const [attempt, setAttempt] = useState(0);

  const lastSwitch = useRef<{ before: Draft; after: string } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const focusInvalid = useRef(false);
  const prevStep = useRef(step);
  const uid = useId();
  const reduceMotion = useReducedMotion();

  const index = steps.indexOf(step);
  const isReview = step === "review";
  const reviewSeen = mode === "edit" || furthest >= steps.length - 1;
  const ctx = { mode, today: localToday(draft.timezone) };
  const errors = attempted.has(step) ? validateStep(step, draft, ctx) : {};
  const currentWeightKg = mode === "new" ? draftWeightKg(draft) : weightProp;

  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  useEffect(() => {
    onProgressRef.current?.({ draft, step, furthest });
  }, [draft, step, furthest]);

  // Move focus with the step: to the first problem after a blocked Continue, else to the new title.
  useEffect(() => {
    const stepChanged = prevStep.current !== step;
    prevStep.current = step;
    if (!stepChanged && !focusInvalid.current) return;
    const timer = window.setTimeout(() => {
      const root = bodyRef.current?.querySelector<HTMLElement>(`[data-step="${step}"]`);
      if (!root) return;
      if (focusInvalid.current) {
        focusInvalid.current = false;
        const bad = root.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]');
        const target = bad?.matches(FOCUSABLE) ? bad : bad?.querySelector<HTMLElement>(FOCUSABLE);
        if (target) {
          target.focus({ preventScroll: true });
          target.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
          return;
        }
      }
      if (stepChanged) root.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [step, attempt, reduceMotion]);

  const update = (fn: (d: Draft) => Draft) => setDraft(fn);

  const setUnits = (to: Units) => {
    if (draft.units === to) return;
    const last = lastSwitch.current;
    // Switching straight back restores the exact values instead of converting twice.
    if (last && last.before.units === to && last.after === unitFingerprint(draft)) {
      lastSwitch.current = null;
      setDraft(withUnitFields(draft, last.before));
      return;
    }
    const next = switchUnits(draft, to, base);
    lastSwitch.current = { before: draft, after: unitFingerprint(next) };
    setDraft(next);
  };

  const go = (target: StepId) => {
    if (target === step) return;
    setDir(order.indexOf(target) >= order.indexOf(step) ? 1 : -1);
    window.scrollTo({ top: 0 });
    setStep(target);
    setFurthest((f) => Math.max(f, steps.indexOf(target)));
  };

  const block = (s: StepId) => {
    setAttempted((prev) => new Set(prev).add(s));
    setAttempt((n) => n + 1);
    focusInvalid.current = true;
  };

  const submit = () => {
    if (submitting) return;
    for (const s of steps) {
      if (Object.keys(validateStep(s, draft, ctx)).length > 0) {
        block(s);
        go(s);
        return;
      }
    }
    const result = buildSubmission(draft, mode, base);
    if (!result.ok) {
      toastError(result.message);
      block(result.step);
      go(result.step);
      return;
    }
    onSubmit(result.payload);
  };

  const next = () => {
    if (isReview) return submit();
    if (Object.keys(validateStep(step, draft, ctx)).length > 0) return block(step);
    go(reviewSeen ? "review" : steps[index + 1]!);
  };

  const back = () => {
    if (mode === "edit") {
      if (isReview) onExit?.();
      else go("review");
      return;
    }
    if (index > 0) go(steps[index - 1]!);
  };

  const title = mode === "edit" && isReview ? "Edit profile" : STEP_LABEL[step];
  const railLabel = (s: StepId) => (mode === "edit" && s === "review" ? "Overview" : STEP_LABEL[s]);
  const primaryLabel = isReview ? (mode === "new" ? "Build my plan" : "Save changes") : reviewSeen ? "Done" : "Continue";
  const StepComponent = STEP_COMPONENT[step];
  const headingId = `${uid}-${step}-title`;

  return (
    <div className="overflow-x-clip">
      <motion.main
        variants={pageVariants}
        initial="initial"
        animate="animate"
        className={cn(
          "mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col px-4 sm:px-6 lg:px-10",
        )}
      >
        <header className="flex min-h-11 items-center justify-between gap-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] lg:pb-8 lg:pt-10">
          {mode === "new" ? (
            <>
              <Wordmark />
              <span className="tnum text-[13px] font-medium text-ink-3 lg:hidden">
                {index + 1} of {steps.length}
              </span>
            </>
          ) : (
            <Button variant="ghost" size="sm" icon={ArrowLeft} className="-ml-3" onClick={back}>
              {isReview ? "Settings" : "Profile"}
            </Button>
          )}
        </header>

        {mode === "new" && (
          <div
            role="progressbar"
            aria-label="Progress"
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-valuenow={index + 1}
            aria-valuetext={`Step ${index + 1} of ${steps.length}, ${STEP_LABEL[step]}`}
            className="h-1 overflow-hidden rounded-full bg-raised lg:hidden"
          >
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={false}
              animate={{ width: `${((index + 1) / steps.length) * 100}%` }}
              transition={softSpring}
            />
          </div>
        )}

        <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:items-start lg:gap-14 xl:gap-20">
          <nav aria-label={mode === "new" ? "Steps" : "Profile sections"} className="sticky top-10 hidden lg:block">
            <ol className="flex flex-col gap-0.5">
              {order.map((s) => {
                const i = steps.indexOf(s);
                const current = s === step;
                const reachable = mode === "edit" || i <= furthest;
                const done = mode === "new" && !current && i < furthest;
                return (
                  <li key={s}>
                    <button
                      type="button"
                      disabled={!reachable}
                      aria-current={current ? "step" : undefined}
                      onClick={() => go(s)}
                      className={cn(
                        "relative isolate flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium transition-colors duration-150 disabled:cursor-default",
                        current ? "text-ink" : reachable ? "text-ink-3 hover:text-ink-2" : "text-ink-3/45",
                      )}
                    >
                      {current && (
                        <motion.span
                          layoutId={`${uid}-rail`}
                          transition={spring}
                          className="absolute inset-0 -z-10 rounded-xl bg-raised"
                          aria-hidden
                        />
                      )}
                      {mode === "new" && (
                        <span
                          aria-hidden
                          className={cn(
                            "tnum flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors duration-200",
                            current
                              ? "bg-accent text-accent-ink"
                              : done
                                ? "bg-accent-soft text-accent"
                                : "border border-line-strong",
                          )}
                        >
                          {done ? <Check size={11} strokeWidth={3} /> : i + 1}
                        </span>
                      )}
                      {railLabel(s)}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="flex min-w-0 max-w-2xl flex-1 flex-col">
            <div ref={bodyRef} className="relative flex-1 pt-7 lg:flex-none lg:pt-0">
              <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                <motion.section
                  key={step}
                  data-step={step}
                  custom={dir}
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  aria-labelledby={headingId}
                >
                  <header className="mb-8">
                    <h1
                      id={headingId}
                      tabIndex={-1}
                      className="text-[26px] font-semibold leading-tight tracking-tight text-ink focus:outline-none"
                    >
                      {title}
                    </h1>
                    {DESCRIPTION[step] && <p className="mt-2 text-[15px] leading-relaxed text-ink-3">{DESCRIPTION[step]}</p>}
                  </header>
                  <StepComponent
                    draft={draft}
                    update={update}
                    errors={errors}
                    mode={mode}
                    attempt={attempt}
                    setUnits={setUnits}
                    currentWeightKg={currentWeightKg}
                    goTo={go}
                  />
                </motion.section>
              </AnimatePresence>
            </div>

            <div
              className={cn(
                "sticky z-30 -mx-4 mt-10 flex items-center gap-3 border-t border-line bg-bg/90 px-4 pt-3 backdrop-blur-xl sm:-mx-6 sm:px-6",
                "lg:static lg:mx-0 lg:mt-12 lg:border-0 lg:bg-transparent lg:px-0 lg:pb-16 lg:pt-0 lg:backdrop-blur-none",
                "bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
              )}
            >
              {mode === "new" && index > 0 && (
                <Button size="lg" variant="secondary" icon={ArrowLeft} onClick={back}>
                  Back
                </Button>
              )}
              {mode === "edit" && isReview && (
                <Button size="lg" variant="secondary" onClick={onExit}>
                  Cancel
                </Button>
              )}
              <Button
                size="lg"
                variant="primary"
                onClick={next}
                loading={submitting && isReview}
                iconRight={primaryLabel === "Continue" ? ArrowRight : undefined}
                className="flex-1 lg:ml-auto lg:min-w-44 lg:flex-none"
              >
                {primaryLabel}
              </Button>
            </div>
          </div>
        </div>
      </motion.main>
    </div>
  );
}

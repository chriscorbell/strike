import type { Muscle, MuscleFeedback } from "@strike/core";
import { Check, Pencil } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { Button } from "../../components/ui/Button.tsx";
import { collapseVariants } from "../../lib/motion.ts";
import { MUSCLE_LABEL, PUMP_OPTIONS, SORENESS_OPTIONS, WORKLOAD_OPTIONS } from "../../lib/labels.ts";
import { ChoiceRow } from "./controls.tsx";
import { feedbackSummary } from "./lib.ts";
import type { FeedbackChange } from "./useSessionActions.ts";

const soreness = SORENESS_OPTIONS.map((label, value) => ({ value, label }));
const pump = PUMP_OPTIONS.map((label, value) => ({ value, label }));
const workload = WORKLOAD_OPTIONS.map((label, value) => ({ value, label }));
const jointPain = [
  { value: false, label: "No" },
  { value: true, label: "Yes" },
] as const;

const lower = (m: Muscle) => MUSCLE_LABEL[m].toLowerCase();

export function SorenessPicker({ muscle, value, onChange }: { muscle: Muscle; value: number | null; onChange: (v: number) => void }) {
  return <ChoiceRow label={`${MUSCLE_LABEL[muscle]} soreness`} options={soreness} value={value} onChange={onChange} layout="pairs" />;
}

/** Asked above a muscle's first exercise when soreness wasn't given at the start. */
export function InlineSoreness({ muscle, onChange }: { muscle: Muscle; onChange: (v: number) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="border-t border-line px-4 py-4 sm:px-5">
      <p className="mb-3 text-[15px] font-medium text-ink">How did your {lower(muscle)} recover since last time?</p>
      <SorenessPicker
        muscle={muscle}
        value={picked}
        onChange={(v) => {
          setPicked(v);
          onChange(v);
        }}
      />
    </div>
  );
}

interface MuscleFeedbackPromptProps {
  muscle: Muscle;
  feedback: MuscleFeedback | undefined;
  onChange: (change: FeedbackChange) => void;
  className?: string;
}

/**
 * Pump, workload and joint pain for a muscle, after its last exercise. Saves on every tap. Once pump and
 * workload are in it folds to a one-line summary; "Done" folds it right after answering.
 */
export function MuscleFeedbackPrompt({ muscle, feedback, onChange, className }: MuscleFeedbackPromptProps) {
  const complete = feedback?.pump != null && feedback.workload != null;
  const [editing, setEditing] = useState(false);
  const open = !complete || editing;
  const change = (c: FeedbackChange) => {
    setEditing(true);
    onChange(c);
  };

  return (
    <div className={className}>
      <AnimatePresence initial={false} mode="wait">
        {open ? (
          <motion.div key="form" variants={collapseVariants} initial="collapsed" animate="open" exit="collapsed" className="overflow-hidden">
            <fieldset className="flex flex-col gap-4">
              <legend className="mb-4 text-[15px] font-semibold text-ink">How was {lower(muscle)} today?</legend>
              <Question label="Pump">
                <ChoiceRow label={`${MUSCLE_LABEL[muscle]} pump`} options={pump} value={feedback?.pump ?? null} onChange={(v) => change({ pump: v })} layout="equal" />
              </Question>
              <Question label="Workload">
                <ChoiceRow
                  label={`${MUSCLE_LABEL[muscle]} workload`}
                  options={workload}
                  value={feedback?.workload ?? null}
                  onChange={(v) => change({ workload: v })}
                  layout="pairs"
                />
              </Question>
              <Question label="Joint pain">
                <ChoiceRow
                  label={`Joint pain during ${lower(muscle)} work`}
                  options={jointPain}
                  value={feedback?.jointPain ?? false}
                  onChange={(v) => change({ jointPain: v })}
                />
              </Question>
            </fieldset>
            {complete && (
              <Button variant="secondary" icon={Check} onClick={() => setEditing(false)} className="mt-4">
                Done
              </Button>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="summary"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-3"
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent" aria-hidden>
              <Check size={14} strokeWidth={2.75} />
            </span>
            <p className="min-w-0 flex-1 text-sm text-ink-2">
              <span className="font-medium text-ink">{MUSCLE_LABEL[muscle]}</span>
              <span className="ml-2">{feedbackSummary(feedback)}</span>
            </p>
            <Button variant="ghost" icon={Pencil} onClick={() => setEditing(true)} aria-label={`Edit ${lower(muscle)} feedback`} className="-mr-2">
              Edit
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Question({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-medium text-ink-3">{label}</p>
      {children}
    </div>
  );
}

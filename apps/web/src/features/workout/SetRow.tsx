import type { SessionExercise, SessionSet } from "@strike/core";
import { Check, Plus, Trash } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button.tsx";
import { Stepper } from "../../components/ui/Field.tsx";
import { cn } from "../../lib/cn.ts";
import { collapseVariants } from "../../lib/motion.ts";
import { ChoiceRow } from "./controls.tsx";
import { fmtRir, fmtWorkSet, setKey, type LoadUnit } from "./lib.ts";

export interface Draft {
  weight: number | null;
  reps: number;
  rir: number;
}

interface SetRowProps {
  exercise: SessionExercise;
  index: number;
  /** Undefined for a set being added past the planned count. */
  set: SessionSet | undefined;
  unit: LoadUnit;
  active: boolean;
  readOnly: boolean;
  initial: Draft;
  stepLoad: (current: number, dir: 1 | -1) => number;
  perHand: boolean;
  onSelect: () => void;
  onCancel: () => void;
  onLog: (draft: Draft) => void;
  onDelete: () => void;
}

export function SetRow(props: SetRowProps) {
  const { exercise, index, set, unit, active, readOnly, onSelect } = props;
  const key = setKey({ seId: exercise.id, index });
  const log = set?.log ?? null;
  const state = log ? "done" : active ? "active" : "todo";
  const targetRir = set?.targetRir ?? props.initial.rir;

  const bw = exercise.loadType === "bodyweight";
  const main = log
    ? fmtWorkSet(log.weight, log.reps, unit, bw)
    : set
      ? fmtWorkSet(set.targetWeight, set.targetReps, unit, bw)
      : "Extra set";
  const side = log ? fmtRir(log.rir ?? targetRir) : fmtRir(targetRir);
  const srLabel = log
    ? `Set ${index + 1}, done: ${main} at ${side}${readOnly ? "" : ". Edit"}`
    : `Set ${index + 1}, target ${main} at ${side}`;

  const header = (
    <>
      <span className="sr-only">Set {index + 1}: </span>
      <SetBadge index={index} state={state} />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[15px] tnum",
          state === "done" ? "font-medium text-ink" : state === "active" ? "font-medium text-ink-2" : "text-ink-3",
        )}
      >
        {state === "active" && set && <span className="sr-only">Target </span>}
        {main}
      </span>
      <span className={cn("shrink-0 text-sm tnum", state === "done" ? "text-ink-2" : "text-ink-3")}>{side}</span>
    </>
  );

  const headerClass = "flex min-h-14 w-full items-center gap-3 px-4 text-left sm:px-5";

  return (
    <li
      id={`row-${key}`}
      className={cn("scroll-mb-32 scroll-mt-24 transition-colors duration-300", active && "bg-raised/50")}
    >
      {active || readOnly ? (
        <div className={headerClass}>
          {header}
        </div>
      ) : (
        <button
          id={`rowbtn-${key}`}
          type="button"
          onClick={onSelect}
          aria-label={srLabel}
          aria-expanded={false}
          className={cn(headerClass, "transition-colors hover:bg-raised/40 focus-visible:-outline-offset-2")}
        >
          {header}
        </button>
      )}
      <AnimatePresence initial={false}>
        {active && !readOnly && (
          <motion.div key="editor" variants={collapseVariants} initial="collapsed" animate="open" exit="collapsed" className="overflow-hidden">
            <SetEditor
              // Fresh inputs when the exercise is swapped or its targets are re-prescribed.
              key={`${exercise.exerciseId}:${set?.targetWeight}:${set?.targetReps}`}
              {...props}
              logKey={key}
              logged={!!log}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function SetBadge({ index, state }: { index: number; state: "done" | "active" | "todo" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-[13px] font-semibold tnum transition-colors duration-200",
        state === "done" && "bg-accent text-accent-ink",
        state === "active" && "bg-accent-soft text-accent ring-1 ring-accent/50 ring-inset",
        state === "todo" && "text-ink-3 ring-1 ring-line-strong ring-inset",
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {state === "done" ? (
          <motion.span
            key="check"
            initial={{ scale: 0.2, rotate: -25, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 620, damping: 18 }}
            className="flex"
          >
            <Check size={16} strokeWidth={3} />
          </motion.span>
        ) : (
          <motion.span
            key="number"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            {index + 1}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

function SetEditor({
  exercise,
  index,
  set,
  unit,
  initial,
  stepLoad,
  perHand,
  onCancel,
  onLog,
  onDelete,
  logKey,
  logged,
}: SetRowProps & { logKey: string; logged: boolean }) {
  const [weight, setWeight] = useState<number | null>(initial.weight);
  const [reps, setReps] = useState<number | null>(initial.reps);
  const [rir, setRir] = useState(initial.rir);
  // Bodyweight work logs reps only unless you add load (a vest, a plate on a belt).
  const bodyweight = exercise.loadType === "bodyweight";
  const loaded = !bodyweight || weight !== null;
  const maxRir = Math.max(4, set?.targetRir ?? 0, initial.rir);
  const rirOptions = Array.from({ length: maxRir + 1 }, (_, r) => ({
    value: r,
    label: String(r),
    hint: r === 0 ? "to failure" : undefined,
  }));

  const valid = reps != null && reps >= 1 && reps <= 100 && (!loaded || (weight != null && weight >= 0));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid || reps == null) return;
    onLog({ weight: loaded ? (weight ?? 0) : null, reps: Math.round(reps), rir });
  };

  return (
    <form onSubmit={submit} className="px-4 pb-4 pt-1 sm:px-5 sm:pb-5" aria-label={`Set ${index + 1} of ${exercise.name}`}>
      <div className={cn("grid grid-cols-2 gap-x-3 gap-y-4", loaded ? "md:grid-cols-[12rem_10rem_minmax(0,1fr)]" : "md:grid-cols-[10rem_minmax(0,1fr)]")}>
        {loaded && (
          <div className="min-w-0">
            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]">
              <span className="font-medium text-ink-2">{bodyweight ? "Added weight" : "Weight"}</span>
              {bodyweight ? (
                <button
                  type="button"
                  onClick={() => setWeight(null)}
                  className="rounded text-ink-3 transition-colors hover:text-ink-2"
                  aria-label="Remove added weight"
                >
                  Remove
                </button>
              ) : (
                <span className="text-ink-3">{perHand ? `${unit} per hand` : unit}</span>
              )}
            </div>
            <Stepper
              label={bodyweight ? `Added weight in ${unit}` : perHand ? `Weight in ${unit} per hand` : `Weight in ${unit}`}
              value={weight}
              onChange={setWeight}
              stepFn={stepLoad}
              min={0}
              max={2000}
              decimals={2}
              size="lg"
              unit={bodyweight ? unit : undefined}
            />
          </div>
        )}
        <div className={cn("min-w-0", !loaded && "col-span-2 md:col-span-1")}>
          <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]">
            <span className="font-medium text-ink-2">Reps</span>
            {bodyweight && !loaded && (
              <button
                type="button"
                onClick={() => setWeight(unit === "lb" ? 5 : 2.5)}
                aria-label="Add weight to this set"
                className="inline-flex items-center gap-1 rounded text-ink-3 transition-colors hover:text-ink-2"
              >
                <Plus size={13} aria-hidden />
                Weight
              </button>
            )}
          </div>
          <Stepper label="Reps" value={reps} onChange={setReps} step={1} min={0} max={100} decimals={0} size="lg" inputMode="numeric" />
        </div>
        <div className="col-span-2 min-w-0 md:col-span-1">
          <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]">
            <span className="font-medium text-ink-2">RIR</span>
            <span className="text-ink-3">0 = failure</span>
          </div>
          <ChoiceRow label="Reps in reserve" options={rirOptions} value={rir} onChange={setRir} layout="equal" />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {logged ? (
          <>
            <Button variant="danger" size="lg" icon={Trash} aria-label="Delete set" title="Delete set" onClick={onDelete} />
            <Button variant="secondary" size="lg" onClick={onCancel}>
              Cancel
            </Button>
            <Button id={`log-${logKey}`} type="submit" variant="primary" size="lg" icon={Check} disabled={!valid} className="flex-1">
              Save
            </Button>
          </>
        ) : (
          <>
            {!set && (
              <Button variant="secondary" size="lg" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button id={`log-${logKey}`} type="submit" variant="primary" size="lg" icon={Check} disabled={!valid} className="flex-1">
              Log set
            </Button>
          </>
        )}
      </div>
    </form>
  );
}

import type { Muscle, MuscleFeedback, Session, SessionExercise } from "@strike/core";
import { ArrowLeftRight, ChevronRight, CircleCheck, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Disclosure, Panel } from "../../components/Page.tsx";
import { Button, IconButton } from "../../components/ui/Button.tsx";
import { Badge } from "../../components/ui/States.tsx";
import { fmtDateShort } from "../../lib/format.ts";
import { MUSCLE_LABEL } from "../../lib/labels.ts";
import { collapseVariants } from "../../lib/motion.ts";
import { InlineSoreness, MuscleFeedbackPrompt } from "./Feedback.tsx";
import {
  fmtRepRange,
  fmtSetList,
  isExerciseDone,
  isLoaded,
  loadStepFn,
  nearestLoad,
  substitutedName,
  type SetRef,
} from "./lib.ts";
import { SetRow, type Draft } from "./SetRow.tsx";
import type { FeedbackChange } from "./useSessionActions.ts";

/** What the editor starts with: the logged values, or the target with the last logged weight carried forward. */
export function initialDraft(se: SessionExercise, index: number, sessionRir: number, carry?: number | null): Draft {
  const set = se.sets[index];
  if (set?.log) return { weight: set.log.weight, reps: set.log.reps, rir: set.log.rir ?? set.targetRir };
  const template = set ?? se.sets[se.sets.length - 1];
  const previous = se.sets
    .slice(0, index)
    .reverse()
    .find((s) => s.log)?.log;
  // Bodyweight work starts without added load unless this set or the previous one used some.
  const weight = isLoaded(se)
    ? (carry ??
      previous?.weight ??
      template?.targetWeight ??
      // No target yet: start from last time's load, snapped to what's available here.
      nearestLoad(se.lastTime?.sets.find((s) => s.weight != null)?.weight ?? se.loadOptions[0] ?? 0, se.loadOptions))
    : carry !== undefined
      ? carry
      : (previous?.weight ?? template?.targetWeight ?? null);
  return { weight, reps: template?.targetReps ?? se.repMin, rir: template?.targetRir ?? sessionRir };
}

export interface ExerciseCardProps {
  session: Session;
  exercise: SessionExercise;
  active: SetRef | null;
  feedback: MuscleFeedback | undefined;
  askSoreness: boolean;
  askFeedback: boolean;
  onSelect: (ref: SetRef) => void;
  onCancel: () => void;
  onLog: (se: SessionExercise, index: number, draft: Draft) => void;
  onDelete: (se: SessionExercise, index: number) => void;
  onAddSet: (se: SessionExercise) => void;
  onSwap: (se: SessionExercise) => void;
  /** Open the form guide. */
  onGuide: (se: SessionExercise) => void;
  onFeedback: (muscle: Muscle, change: FeedbackChange) => void;
}

export function ExerciseCard({
  session,
  exercise: se,
  active,
  feedback,
  askSoreness,
  askFeedback,
  onSelect,
  onCancel,
  onLog,
  onDelete,
  onAddSet,
  onSwap,
  onGuide,
  onFeedback,
}: ExerciseCardProps) {
  const unit = session.loadUnit;
  const done = isExerciseDone(se);
  const anyLogged = se.sets.some((s) => s.log);
  const swappedFrom = substitutedName(se);
  const nameBreak = se.name.lastIndexOf(" ") + 1;
  const nameHead = se.name.slice(0, nameBreak);
  const nameTail = se.name.slice(nameBreak);
  const stepLoad = loadStepFn(se.loadOptions, unit);
  const perHand = se.loadType === "dumbbell";
  const activeHere = active?.seId === se.id ? active : null;
  const adding = activeHere != null && activeHere.index >= se.sets.length;
  const indices = se.sets.map((s) => s.index);
  if (adding) indices.push(se.sets.length);

  return (
    <Panel as="article" className="scroll-mt-4 overflow-hidden">
      <div id={`ex-${se.id}`} className="scroll-mt-4" />
      <header className="px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-[17px] font-semibold leading-snug tracking-tight text-ink">
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => onGuide(se)}
                className="group -mx-1 -my-0.5 min-w-0 rounded-lg px-1 py-0.5 text-left transition-colors hover:text-accent"
              >
                {nameHead}
                {/* The chevron stays with the last word instead of wrapping onto its own line. */}
                <span className="whitespace-nowrap">
                  {nameTail}
                  <ChevronRight
                    size={16}
                    strokeWidth={2.25}
                    className="ml-0.5 inline-block align-[-2px] text-ink-3 transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:text-accent"
                    aria-hidden
                  />
                </span>
                <span className="sr-only">: how to do it</span>
              </button>
              <AnimatePresence initial={false}>
                {done && (
                  <motion.span
                    initial={{ scale: 0.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 520, damping: 20 }}
                    className="flex shrink-0 text-accent"
                  >
                    <CircleCheck size={18} strokeWidth={2.25} aria-label="Done" />
                  </motion.span>
                )}
              </AnimatePresence>
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-3">
              <span>{MUSCLE_LABEL[se.muscle]}</span>
              <span aria-hidden>·</span>
              <span className="tnum">{fmtRepRange(se.repMin, se.repMax)}</span>
              {se.maxedOut && <Badge tone="warn">Maxed out</Badge>}
            </p>
            {swappedFrom && (
              <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-ink-3">
                <ArrowLeftRight size={12} aria-hidden />
                Swapped from {swappedFrom}
              </p>
            )}
          </div>
          {!anyLogged && (
            <IconButton icon={ArrowLeftRight} label={`Swap ${se.name}`} onClick={() => onSwap(se)} className="-mr-2 -mt-1.5" />
          )}
        </div>

        {se.prescriptionNote && <p className="mt-3 text-sm leading-relaxed text-ink-2">{se.prescriptionNote}</p>}
        {se.notes && <p className="mt-2 text-sm leading-relaxed text-ink-2">{se.notes}</p>}
        {se.lastTime && se.lastTime.sets.length > 0 && (
          <p className="mt-2 text-[13px] leading-relaxed text-ink-3 tnum">
            <span className="font-medium text-ink-2">Last time</span> {fmtDateShort(se.lastTime.date)}: {fmtSetList(se.lastTime.sets, !isLoaded(se))}
          </p>
        )}
        {se.cues && (
          <Disclosure summary="Cues" className="-mb-2 mt-1" buttonClassName="h-11">
            <p className="pb-3 text-sm leading-relaxed text-ink-2">{se.cues}</p>
          </Disclosure>
        )}
      </header>

      <AnimatePresence initial={false}>
        {askSoreness && (
          <motion.div
            key="soreness"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0, transition: { delay: 0.45, duration: 0.3, ease: [0.16, 1, 0.3, 1] } }}
            className="overflow-hidden"
          >
            <InlineSoreness muscle={se.muscle} onChange={(v) => onFeedback(se.muscle, { soreness: v })} />
          </motion.div>
        )}
      </AnimatePresence>

      <ol className="divide-y divide-line border-t border-line" aria-label={`${se.name} sets`}>
        {indices.map((index) => {
          const set = se.sets[index];
          const isActive = activeHere?.index === index;
          return (
            <SetRow
              key={index}
              exercise={se}
              index={index}
              set={set}
              unit={unit}
              active={isActive}
              readOnly={false}
              initial={initialDraft(se, index, session.targetRir, isActive ? activeHere?.carry : undefined)}
              stepLoad={stepLoad}
              perHand={perHand}
              onSelect={() => onSelect({ seId: se.id, index, edit: !!set?.log })}
              onCancel={onCancel}
              onLog={(draft) => onLog(se, index, draft)}
              onDelete={() => onDelete(se, index)}
            />
          );
        })}
      </ol>

      {done && !activeHere && (
        <div className="border-t border-line px-2 sm:px-3">
          <Button variant="ghost" icon={Plus} onClick={() => onAddSet(se)} className="my-1.5">
            Add set
          </Button>
        </div>
      )}

      <AnimatePresence initial={false}>
        {askFeedback && (
          <motion.div
            key="feedback"
            id={`fb-${se.id}`}
            variants={collapseVariants}
            initial="collapsed"
            animate="open"
            exit="collapsed"
            className="scroll-mb-32 overflow-hidden"
          >
            <MuscleFeedbackPrompt
              muscle={se.muscle}
              feedback={feedback}
              onChange={(change) => onFeedback(se.muscle, change)}
              className="border-t border-line px-4 py-4 sm:px-5"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  );
}

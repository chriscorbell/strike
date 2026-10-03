import type { CheckIn, Units } from "@strike/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ClipboardCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useState, type ReactNode } from "react";
import { usePendingJobList, WorkingGlyph } from "../../components/CoachStatus.tsx";
import { Panel } from "../../components/Page.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { Field, TextArea } from "../../components/ui/Field.tsx";
import { EmptyState, ErrorState, SkeletonList } from "../../components/ui/States.tsx";
import { toast } from "../../components/ui/Toast.tsx";
import { cn } from "../../lib/cn.ts";
import { endpoints } from "../../lib/endpoints.ts";
import { fmtBodyWeight, fmtDateShort, fmtKcal, fmtRate } from "../../lib/format.ts";
import { WEEKDAY_LONG } from "../../lib/labels.ts";
import { collapseVariants, easeOut } from "../../lib/motion.ts";
import { keys, useCheckinStatus, useCheckins, useProfile, useUnits } from "../../lib/queries.ts";
import { planReadyDay } from "../../lib/week.ts";

const kcalChange = (kcal: number) => {
  const n = Math.round(kcal);
  if (n === 0) return "Calories unchanged";
  return `${n > 0 ? "+" : "−"}${fmtKcal(Math.abs(n))} kcal a day`;
};

/** The weekly check-in prompt. Only shows when one is due. */
export function CheckInDue({ className }: { className?: string }) {
  const status = useCheckinStatus();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const due = status.data?.due ?? false;

  const run = useMutation({
    mutationFn: (n: string | undefined) => endpoints.runCheckin(n),
    onSuccess: (checkIn) => {
      qc.setQueryData<CheckIn[]>(keys.checkins, (list) => (list ? [checkIn, ...list.filter((c) => c.id !== checkIn.id)] : list));
      void qc.invalidateQueries({ queryKey: keys.checkins });
      void qc.invalidateQueries({ queryKey: keys.today() });
      void qc.invalidateQueries({ queryKey: keys.state });
      void qc.invalidateQueries({ queryKey: keys.pendingJobs });
      setNote("");
      toast(checkIn.adjustmentKcal === 0 ? "Check-in done" : `Check-in done. ${kcalChange(checkIn.adjustmentKcal)}.`);
    },
  });

  return (
    <AnimatePresence initial={false}>
      {due && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={easeOut}
          className={cn("overflow-hidden", className)}
        >
          <Panel as="section" className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent" aria-hidden>
                <ClipboardCheck size={18} />
              </span>
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-ink">Weekly check-in is due</h2>
                <p className="mt-0.5 text-[13px] leading-snug text-ink-3">
                  Reviews last week's weight trend and training, and adjusts calories if needed.
                </p>
              </div>
            </div>
            <form
              noValidate
              className="mt-4"
              onSubmit={(e) => {
                e.preventDefault();
                run.mutate(note.trim() || undefined);
              }}
            >
              <Field label="Anything your coach should know?" optional>
                <TextArea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} className="min-h-16" />
              </Field>
              <Button type="submit" variant="primary" block className="mt-3" loading={run.isPending}>
                Run check-in
              </Button>
            </form>
          </Panel>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Past check-ins, newest first. The latest starts open. */
export function CheckInList() {
  const q = useCheckins();
  const units = useUnits();
  const profile = useProfile();
  const writing = usePendingJobList().some((j) => j.kind === "check_in_note");

  if (q.isPending) return <SkeletonList rows={3} rowClassName="h-14" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (q.data.length === 0) {
    return (
      <EmptyState icon={ClipboardCheck} title="No check-ins yet">
        They run automatically {WEEKDAY_LONG[planReadyDay(profile.schedule)]} evening, along with next week's meal plan.
      </EmptyState>
    );
  }

  return (
    <ul className="divide-y divide-line border-y border-line">
      {q.data.map((c, i) => (
        <CheckInRow key={c.id} checkIn={c} units={units} defaultOpen={i === 0} writing={writing && i === 0} />
      ))}
    </ul>
  );
}

function CheckInRow({ checkIn: c, units, defaultOpen, writing }: { checkIn: CheckIn; units: Units; defaultOpen: boolean; writing: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="group flex w-full items-center gap-3 py-3.5 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium text-ink">Week of {fmtDateShort(c.weekStart)}</p>
          <p className="mt-0.5 truncate text-[13px] text-ink-3">
            {c.rateKgPerWeek == null ? "No rate yet" : fmtRate(c.rateKgPerWeek, units)} · {kcalChange(c.adjustmentKcal)}
          </p>
        </div>
        <ChevronDown
          size={17}
          className={cn("shrink-0 text-ink-3 transition-transform duration-200 group-hover:text-ink-2", open && "rotate-180")}
          aria-hidden
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            key="detail"
            variants={collapseVariants}
            initial="collapsed"
            animate="open"
            exit="collapsed"
            className="overflow-hidden"
          >
            <CheckInDetail c={c} units={units} writing={writing} />
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function CheckInDetail({ c, units, writing }: { c: CheckIn; units: Units; writing: boolean }) {
  const adherence = c.mealAdherence == null ? "Not tracked" : `${Math.round(c.mealAdherence * 100)}% on plan`;
  return (
    <div className="pb-5">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5">
        <Item label="Trend">{fmtBodyWeight(c.trendKg, units)}</Item>
        <Item label="Weekly rate" sub={`Target ${fmtRate(c.targetRateKgPerWeek, units)}`}>
          {c.rateKgPerWeek == null ? "Not enough data" : fmtRate(c.rateKgPerWeek, units)}
        </Item>
        <Item label="Training">
          {c.sessionsCompleted} of {c.sessionsPlanned} sessions
        </Item>
        <Item label="Meals">{adherence}</Item>
        <Item label="Weigh-ins">{c.weighIns}</Item>
        <Item label="Calories">{kcalChange(c.adjustmentKcal)}</Item>
      </dl>
      {c.adjustmentReason && <p className="mt-4 text-[13px] leading-relaxed text-ink-2">{c.adjustmentReason}</p>}

      <div className="mt-4">
        <p className="text-xs font-medium text-ink-3">From your coach</p>
        {c.coachNote ? (
          <p className="mt-1.5 whitespace-pre-line text-[15px] leading-relaxed text-ink">{c.coachNote}</p>
        ) : writing ? (
          <p role="status" className="mt-1.5 flex items-center gap-2.5 text-[13px] text-ink-2">
            <WorkingGlyph />
            Writing a note
          </p>
        ) : (
          <p className="mt-1.5 text-[13px] text-ink-3">No note this week.</p>
        )}
      </div>

      {c.userNote && (
        <div className="mt-4">
          <p className="text-xs font-medium text-ink-3">Your note</p>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-2">{c.userNote}</p>
        </div>
      )}
    </div>
  );
}

function Item({ label, sub, children }: { label: string; sub?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="tnum mt-0.5 text-sm text-ink">{children}</dd>
      {sub && <dd className="tnum text-xs text-ink-3">{sub}</dd>}
    </div>
  );
}

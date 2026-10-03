import type { CheckIn } from "@strike/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Disclosure, Panel } from "../../components/Page.tsx";
import { Button, IconButton } from "../../components/ui/Button.tsx";
import { TextArea } from "../../components/ui/Field.tsx";
import { endpoints } from "../../lib/endpoints.ts";
import { fmtKcal, fmtRate } from "../../lib/format.ts";
import { easeOut } from "../../lib/motion.ts";
import { keys, useUnits } from "../../lib/queries.ts";

/** Shown when the weekly check-in is due, and briefly after running it. */
export function CheckInCard({ due }: { due: boolean }) {
  const qc = useQueryClient();
  const units = useUnits();
  const [note, setNote] = useState("");
  const [result, setResult] = useState<CheckIn | null>(null);

  const run = useMutation({
    mutationFn: () => endpoints.runCheckin(note.trim() || undefined),
    onSuccess: (checkIn) => {
      setResult(checkIn);
      void qc.invalidateQueries({ queryKey: keys.today() });
      void qc.invalidateQueries({ queryKey: keys.checkins });
      void qc.invalidateQueries({ queryKey: keys.state });
      void qc.invalidateQueries({ queryKey: keys.pendingJobs });
    },
  });

  if (!due && !result) return null;

  return (
    <Panel className="p-5">
      <AnimatePresence mode="wait" initial={false}>
        {result ? (
          <motion.div key="result" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={easeOut}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <ClipboardCheck size={17} className="text-accent" aria-hidden />
                Check-in done
              </h2>
              <IconButton icon={X} label="Dismiss" size="sm" onClick={() => setResult(null)} className="-mr-2 -mt-2" />
            </div>
            <p className="tnum mt-3 text-[22px] font-semibold tracking-tight text-ink">
              {result.adjustmentKcal === 0
                ? "Calories unchanged"
                : `${result.adjustmentKcal > 0 ? "+" : "−"}${fmtKcal(Math.abs(result.adjustmentKcal))} kcal/day`}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{result.adjustmentReason}</p>
            <p className="tnum mt-3 text-[13px] text-ink-3">
              Rate {fmtRate(result.rateKgPerWeek, units)}, target {fmtRate(result.targetRateKgPerWeek, units)}
            </p>
          </motion.div>
        ) : (
          <motion.div key="due" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={easeOut}>
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <ClipboardCheck size={17} className="text-ink-3" aria-hidden />
              Weekly check-in is due
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-3">Reviews your weight trend and adherence, then adjusts calories.</p>
            <Disclosure summary="Add a note" className="mt-3">
              <TextArea
                aria-label="Note for this check-in"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Slept badly, traveled midweek"
                rows={3}
                className="mt-2"
              />
            </Disclosure>
            <Button variant="primary" block className="mt-4" loading={run.isPending} onClick={() => run.mutate()}>
              Run check-in
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  );
}

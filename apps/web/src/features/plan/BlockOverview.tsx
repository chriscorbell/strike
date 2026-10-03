import type { MesoOverview } from "@strike/core";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { WorkingGlyph } from "../../components/CoachStatus.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { Field, TextArea } from "../../components/ui/Field.tsx";
import { Sheet } from "../../components/ui/Sheet.tsx";
import { Badge } from "../../components/ui/States.tsx";
import { fmtDateShort } from "../../lib/format.ts";
import { easeOut } from "../../lib/motion.ts";
import { useAppState } from "../../lib/queries.ts";
import { findNext, type Regenerate } from "./useRegenerate.ts";

/** Name, where you are in the block, why it's built this way, and the regenerate action. */
export function BlockOverview({ meso, regen }: { meso: MesoOverview; regen: Regenerate }) {
  const headingId = useId();
  const [open, setOpen] = useState(false);
  const next = findNext(meso.grid);
  const progress =
    meso.status === "completed" || !next
      ? "Block finished"
      : next.week >= meso.hardWeeks
        ? "Deload week"
        : `Week ${next.week + 1} of ${meso.hardWeeks}`;

  return (
    <section aria-labelledby={headingId}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id={headingId} className="text-[22px] font-semibold leading-tight tracking-tight text-ink">
            {meso.name}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-ink-3">
            <span className="font-medium text-ink-2">{progress}</span>
            {meso.split !== meso.name && <span>{meso.split}</span>}
            <span>Started {fmtDateShort(meso.startDate)}</span>
            {meso.source === "fallback" && (
              <span title="Built from the standard template while the coach was unavailable">
                <Badge tone="outline">Standard template</Badge>
              </span>
            )}
          </div>
        </div>
        <Button size="sm" icon={RefreshCw} onClick={() => setOpen(true)} disabled={regen.running} className="mt-0.5">
          Regenerate
        </Button>
      </div>
      {meso.rationale && <p className="mt-4 max-w-[65ch] text-[15px] leading-relaxed text-ink-2">{meso.rationale}</p>}
      <RegenStatus regen={regen} onRetry={() => setOpen(true)} />
      <RegenerateSheet open={open} onClose={() => setOpen(false)} regen={regen} />
    </section>
  );
}

/** Inline progress for a running block rewrite, or why it failed. */
export function RegenStatus({ regen, onRetry, firstBlock = false }: { regen: Regenerate; onRetry: () => void; firstBlock?: boolean }) {
  const failed = regen.failed;
  const running = regen.running;
  const queued = regen.job?.status === "queued";
  return (
    <AnimatePresence initial={false}>
      {(running || failed) && (
        <motion.div
          key={failed ? "failed" : "running"}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={easeOut}
          className="overflow-hidden"
        >
          {failed ? (
            <div role="alert" className="mt-5 flex items-start gap-3 rounded-2xl border border-danger/25 bg-danger-soft px-4 py-3.5">
              <TriangleAlert size={18} className="mt-0.5 shrink-0 text-danger" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">Couldn't build a new block</p>
                {failed.error && <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{failed.error}</p>}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={onRetry}>
                    Try again
                  </Button>
                  <Button size="sm" variant="ghost" onClick={regen.dismiss}>
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div role="status" className="mt-5 flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5">
              <WorkingGlyph className="shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{firstBlock ? "Writing your first block" : "Writing your new block"}</p>
                <p className="mt-0.5 text-[13px] text-ink-3">{queued ? "Queued" : "This page updates when it's ready."}</p>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function RegenerateSheet({ open, onClose, regen, firstBlock = false }: { open: boolean; onClose: () => void; regen: Regenerate; firstBlock?: boolean }) {
  const { data: state } = useAppState();
  const [note, setNote] = useState("");
  const submit = () =>
    regen.run(note, {
      onStarted: () => {
        setNote("");
        onClose();
      },
    });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={firstBlock ? "Build a training block" : "Regenerate block"}
      description={
        firstBlock
          ? "Your coach writes a block around your training days and equipment."
          : "Your coach writes a new block that starts with your next session. Finished sessions stay in your history."
      }
      footer={
        <Button variant="primary" block loading={regen.starting} onClick={submit}>
          {firstBlock ? "Build block" : "Regenerate block"}
        </Button>
      }
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field
          label="Anything to change?"
          optional
          hint={state?.coachAvailable === false ? "The coach isn't available right now, so this uses the standard template." : undefined}
        >
          <TextArea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="More arm work, shorter sessions, no barbell squats"
            data-autofocus
          />
        </Field>
      </form>
    </Sheet>
  );
}

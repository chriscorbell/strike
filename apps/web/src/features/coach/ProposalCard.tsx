import type { CoachAction, CoachMessage } from "@strike/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, CircleAlert, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { WorkingGlyph } from "../../components/CoachStatus.tsx";
import { Collapse } from "../../components/Page.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { cn } from "../../lib/cn.ts";
import { endpoints } from "../../lib/endpoints.ts";
import { COACH_ACTION_ICON, JOB_LABEL } from "../../lib/labels.ts";
import { easeOut, spring } from "../../lib/motion.ts";
import { keys, useJob } from "../../lib/queries.ts";

interface ProposalCardProps {
  message: CoachMessage;
  /** The reply is still being written, or another one is: no applying until it's done. */
  locked: boolean;
  onUpdate: (message: CoachMessage) => void;
}

/** The changes a reply proposes. Apply makes all of them happen together; nothing changes until then. */
export function ProposalCard({ message, locked, onUpdate }: ProposalCardProps) {
  const qc = useQueryClient();
  const actions = message.actions;
  const proposed = actions.some((a) => a.status === "proposed");
  const dismissed = actions.every((a) => a.status === "dismissed");

  const apply = useMutation({
    mutationFn: () => endpoints.applyCoachMessage(message.id),
    onSuccess: (m) => {
      onUpdate(m);
      // A change can touch the plan, today, meals or training: refresh everything outside the chat.
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== keys.coach[0] });
    },
  });
  const dismiss = useMutation({ mutationFn: () => endpoints.dismissCoachMessage(message.id), onSuccess: onUpdate });

  const heading = proposed
    ? actions.length === 1
      ? "Proposed change"
      : `${actions.length} proposed changes`
    : actions.length === 1
      ? "Applied"
      : `Applied ${actions.length} changes`;

  return (
    <motion.section
      aria-label={dismissed ? "Dismissed changes" : heading}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={easeOut}
      className={cn(
        "mt-4 rounded-2xl border border-line transition-colors duration-300",
        dismissed ? "bg-transparent" : "bg-surface",
      )}
    >
      <Collapse open={!dismissed}>
        <p className="px-4 pt-3.5 text-[13px] font-medium text-ink-3">{heading}</p>
        <ul className="divide-y divide-line">
          {actions.map((a) => (
            <ActionRow key={a.id} action={a} />
          ))}
        </ul>
        <AnimatePresence initial={false}>
          {proposed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              className="flex items-center gap-2 border-t border-line px-4 py-3"
            >
              <Button
                variant="primary"
                size="sm"
                icon={Check}
                loading={apply.isPending}
                disabled={locked || dismiss.isPending}
                onClick={() => apply.mutate()}
              >
                Apply
              </Button>
              <Button
                variant="ghost"
                size="sm"
                loading={dismiss.isPending}
                disabled={locked || apply.isPending}
                onClick={() => dismiss.mutate()}
              >
                Dismiss
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </Collapse>
      <Collapse open={dismissed}>
        <p className="flex items-center gap-2 px-4 py-2.5 text-[13px] text-ink-3">
          <X size={14} className="shrink-0" aria-hidden />
          <span className="min-w-0 truncate">Dismissed: {actions.map((a) => a.summary).join(", ")}</span>
        </p>
      </Collapse>
    </motion.section>
  );
}

function ActionRow({ action }: { action: CoachAction }) {
  const Icon = COACH_ACTION_ICON[action.kind];
  const applied = action.status === "applied";
  return (
    <li className="flex gap-3 px-4 py-3.5">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors duration-300",
          applied ? "bg-accent-soft text-accent" : "bg-raised text-ink-2",
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={applied ? "applied" : "proposed"}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0, transition: { duration: 0.1 } }}
            transition={spring}
            className="flex"
          >
            {applied ? <Check size={16} strokeWidth={2.5} aria-label="Applied" /> : <Icon size={16} aria-hidden />}
          </motion.span>
        </AnimatePresence>
      </span>
      <div className="min-w-0 flex-1 pt-[5px]">
        <p className="text-[15px] leading-snug text-ink">{action.summary}</p>
        {action.detail && <ClampText text={action.detail} />}
        {applied && action.jobId != null && <JobLine jobId={action.jobId} />}
      </div>
    </li>
  );
}

/** Coach work started by an applied change: working, done or failed. */
function JobLine({ jobId }: { jobId: number }) {
  const { data: job } = useJob(jobId, 3000);
  const failed = job?.status === "failed";
  const done = job?.status === "succeeded";
  return (
    <p role="status" className={cn("mt-2 flex items-start gap-2 text-[13px] leading-snug", failed ? "text-ink-2" : "text-ink-3")}>
      {done ? (
        <Check size={14} strokeWidth={2.5} className="mt-px shrink-0 text-accent" aria-hidden />
      ) : failed ? (
        <CircleAlert size={14} className="mt-px shrink-0 text-danger" aria-hidden />
      ) : (
        <WorkingGlyph className="mt-[3px] shrink-0" />
      )}
      <span className="min-w-0">
        {done ? "Done" : failed ? (job.error ?? "The coach couldn't finish this.") : job ? JOB_LABEL[job.kind] : "Starting"}
      </span>
    </p>
  );
}

/** Secondary text clamped to two lines, with a toggle when it runs longer. */
function ClampText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, text]);

  return (
    <>
      <p ref={ref} id={id} className={cn("mt-1 whitespace-pre-line text-[13px] leading-snug text-ink-3", !open && "line-clamp-2")}>
        {text}
      </p>
      {(overflows || open) && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="mt-1 text-[13px] font-medium text-ink-2 transition-colors hover:text-ink"
        >
          {open ? "Less" : "More"}
        </button>
      )}
    </>
  );
}

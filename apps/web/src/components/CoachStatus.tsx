import type { Job } from "@strike/core";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { endpoints } from "../lib/endpoints.ts";
import { cn } from "../lib/cn.ts";
import { JOB_LABEL } from "../lib/labels.ts";
import { easeOut } from "../lib/motion.ts";
import { keys } from "../lib/queries.ts";

/** Read the pending-jobs list (the poller lives in AppShell via usePendingJobs). */
export function usePendingJobList(): Job[] {
  const { data } = useQuery({ queryKey: keys.pendingJobs, queryFn: endpoints.pendingJobs });
  return data ?? [];
}

/** Three softly pulsing bars: the coach is working. */
export function WorkingGlyph({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex h-3 items-end gap-[2px]", className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-accent"
          animate={{ height: ["35%", "100%", "35%"] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}

/** Subtle "coach is working" line listing running jobs. Renders nothing when idle. */
export function CoachStatus({ jobs, className }: { jobs?: Job[]; className?: string }) {
  const fallback = usePendingJobList();
  const list = jobs ?? fallback;
  const unique = [...new Map(list.map((j) => [j.kind, j])).values()];
  return (
    <AnimatePresence initial={false}>
      {unique.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={easeOut}
          className="overflow-hidden"
        >
          <div role="status" className={cn("flex items-start gap-2.5 text-[13px] text-ink-2", className)}>
            <WorkingGlyph className="mt-[3px] shrink-0" />
            <ul className="min-w-0">
              {unique.map((j) => (
                <li key={j.id} className="leading-snug">
                  {JOB_LABEL[j.kind]}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

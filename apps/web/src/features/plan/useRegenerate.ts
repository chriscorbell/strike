import type { Job, MesoOverview } from "@strike/core";
import { useEffect, useRef, useState } from "react";
import { usePendingJobList } from "../../components/CoachStatus.tsx";
import { toast } from "../../components/ui/Toast.tsx";
import { endpoints } from "../../lib/endpoints.ts";
import { isJobDone, useJob, useStartJob } from "../../lib/queries.ts";

export interface Regenerate {
  run: (note: string, opts?: { onStarted?: () => void }) => void;
  starting: boolean;
  /** A mesocycle job is queued or running (ours, or one started elsewhere). */
  running: boolean;
  /** The job being shown, while it runs or after it failed. */
  job: Job | null;
  failed: Job | null;
  dismiss: () => void;
}

/** Start a new block and follow the coach job until it lands. */
export function useRegenerate(): Regenerate {
  const [jobId, setJobId] = useState<number | null>(null);
  const start = useStartJob((note: string | undefined) => endpoints.regenerateMeso(note));
  const tracked = useJob(jobId).data ?? null;
  const pending = usePendingJobList().find((j) => j.kind === "mesocycle") ?? null;

  const announced = useRef<number | null>(null);
  useEffect(() => {
    if (tracked?.status === "succeeded" && announced.current !== tracked.id) {
      announced.current = tracked.id;
      toast("Your new block is ready");
    }
  }, [tracked]);

  const trackedRunning = tracked != null && !isJobDone(tracked);
  const job = trackedRunning || tracked?.status === "failed" ? tracked : pending;

  return {
    run: (note, opts) =>
      start.mutate(note.trim() || undefined, {
        onSuccess: (j) => {
          setJobId(j.id);
          opts?.onStarted?.();
        },
      }),
    starting: start.isPending,
    running: start.isPending || trackedRunning || pending != null,
    job,
    failed: tracked?.status === "failed" ? tracked : null,
    dismiss: () => setJobId(null),
  };
}

/** The next session slot, same rule as the server: first cell that isn't done or skipped. */
export function findNext(grid: MesoOverview["grid"]): { week: number; day: number } | null {
  for (let week = 0; week < grid.length; week++) {
    const row = grid[week]!;
    for (let day = 0; day < row.length; day++) {
      const cell = row[day];
      if (!cell || cell.status === "planned" || cell.status === "in_progress") return { week, day };
    }
  }
  return null;
}

export const weekName = (week: number, hardWeeks: number) => (week >= hardWeeks ? "Deload" : `Week ${week + 1}`);

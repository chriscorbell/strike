import type { MesoOverview } from "@strike/core";
import { motion } from "motion/react";
import { Panel } from "../../components/Page.tsx";
import { Badge } from "../../components/ui/States.tsx";
import { LOCATION_ICON, LOCATION_LABEL, MUSCLE_LABEL } from "../../lib/labels.ts";
import { itemVariants, listVariants } from "../../lib/motion.ts";
import { findNext } from "./useRegenerate.ts";

/** Each training day of the block: focus, location, exercises with sets and rep ranges. */
export function BlockDays({ meso }: { meso: MesoOverview }) {
  const next = findNext(meso.grid);
  return (
    <motion.div variants={listVariants} initial="initial" animate="animate" className="grid gap-4 md:grid-cols-2">
      {meso.days.map((d, i) => {
        const sets = d.exercises.reduce((a, e) => a + e.sets, 0);
        const LocIcon = LOCATION_ICON[d.location];
        return (
          <motion.div key={`${d.label}-${i}`} variants={itemVariants}>
            <Panel as="article" className="h-full p-4 sm:p-5">
              <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-[15px] font-semibold text-ink">{d.label}</h3>
                    {next?.day === i && <Badge tone="accent">Next</Badge>}
                  </div>
                  <p className="mt-0.5 text-[13px] text-ink-3">
                    {d.focus ? `${d.focus} · ` : ""}
                    {sets} sets
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] text-ink-3">
                  <LocIcon size={14} aria-hidden />
                  {LOCATION_LABEL[d.location]}
                </span>
              </header>
              <ul className="mt-3 divide-y divide-line">
                {d.exercises.map((e) => (
                  <li key={e.exerciseId} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{e.name}</p>
                      <p className="text-xs text-ink-3">{MUSCLE_LABEL[e.muscle]}</p>
                    </div>
                    <p className="tnum shrink-0 text-sm text-ink-2">
                      <span aria-hidden>
                        {e.sets} × {e.repMin}-{e.repMax}
                      </span>
                      <span className="sr-only">
                        {e.sets} sets of {e.repMin} to {e.repMax} reps
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

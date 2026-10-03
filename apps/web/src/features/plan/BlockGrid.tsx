import type { MesoOverview, SessionStatus } from "@strike/core";
import { Check, Minus, Play } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "../../lib/cn.ts";
import { fmtDateShort } from "../../lib/format.ts";
import { findNext, weekName } from "./useRegenerate.ts";

type Cell = MesoOverview["grid"][number][number];

const STATUS_WORDS: Record<SessionStatus, string> = {
  completed: "completed",
  skipped: "skipped",
  in_progress: "in progress",
  planned: "planned",
};

const cellBase =
  "relative flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-xs font-medium transition-[background-color,border-color,box-shadow] duration-200";

function look(cell: Cell): string {
  switch (cell?.status) {
    case "completed":
      return "bg-accent-soft text-ink-2";
    case "in_progress":
      return "border border-accent/50 bg-accent-soft text-ink";
    case "skipped":
      return "bg-raised text-ink-3";
    default:
      return "border border-line text-ink-3";
  }
}

function content(cell: Cell, isNext: boolean): ReactNode {
  if (isNext && (!cell || cell.status === "planned")) return <span className="text-ink">Next</span>;
  switch (cell?.status) {
    case "completed":
      return (
        <>
          <Check size={15} strokeWidth={2.5} className="shrink-0 text-accent" aria-hidden />
          {cell.date && <span className="tnum hidden sm:inline">{fmtDateShort(cell.date)}</span>}
        </>
      );
    case "in_progress":
      return (
        <>
          <Play size={13} strokeWidth={2.5} className="shrink-0 fill-current text-accent" aria-hidden />
          <span className="hidden sm:inline">Now</span>
        </>
      );
    case "skipped":
      return (
        <>
          <Minus size={15} strokeWidth={2.5} className="shrink-0" aria-hidden />
          <span className="hidden sm:inline">Skipped</span>
        </>
      );
    default:
      return null;
  }
}

/** Weeks by training days. Rows are weeks (the last is the deload), cells open their session. */
export function BlockGrid({ meso }: { meso: MesoOverview }) {
  const next = findNext(meso.grid);
  const days = meso.days;

  return (
    <div>
      <div className="-mx-1.5 overflow-x-auto">
        <table className="w-full min-w-[19rem] table-fixed border-separate border-spacing-1.5">
          <caption className="sr-only">Training block by week and day. Each cell shows the session's status.</caption>
          <thead>
            <tr>
              <th scope="col" className="w-16 sm:w-20">
                <span className="sr-only">Week</span>
              </th>
              {days.map((d) => (
                <th
                  key={d.label}
                  scope="col"
                  title={d.label}
                  className="truncate px-1 pb-1 text-left text-xs font-medium text-ink-3"
                >
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {meso.grid.map((row, w) => {
              const deload = w >= meso.hardWeeks;
              const name = weekName(w, meso.hardWeeks);
              return (
                <tr key={w}>
                  <th scope="row" className={cn("pr-1 text-left text-[13px] font-medium", deload ? "text-ink-3" : "text-ink-2")}>
                    {name}
                  </th>
                  {days.map((d, i) => {
                    const cell = row[i] ?? null;
                    const isNext = next?.week === w && next.day === i;
                    const status = cell ? STATUS_WORDS[cell.status] : "not scheduled yet";
                    const label = `${name}, ${d.label}, ${status}${cell?.date ? ` ${fmtDateShort(cell.date)}` : ""}${isNext ? ", next up" : ""}`;
                    const cls = cn(
                      cellBase,
                      look(cell),
                      isNext && "ring-2 ring-accent ring-offset-2 ring-offset-bg",
                      cell && "hover:brightness-125",
                    );
                    return (
                      <td key={i} className="p-0">
                        <motion.div
                          initial={{ opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: Math.min(0.4, (w * days.length + i) * 0.012) }}
                        >
                          {cell ? (
                            <Link to={`/sessions/${cell.sessionId}`} aria-label={label} title={label} className={cls}>
                              {content(cell, isNext)}
                            </Link>
                          ) : (
                            <div role="img" aria-label={label} title={label} className={cls}>
                              {content(cell, isNext)}
                            </div>
                          )}
                        </motion.div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-3" aria-label="Legend">
        <LegendItem swatch={<Swatch className="bg-accent-soft"><Check size={10} strokeWidth={3} className="text-accent" /></Swatch>} label="Done" />
        <LegendItem swatch={<Swatch className="bg-raised"><Minus size={10} strokeWidth={3} /></Swatch>} label="Skipped" />
        <LegendItem swatch={<Swatch className="border border-line ring-2 ring-accent ring-offset-1 ring-offset-bg" />} label="Next" />
        <LegendItem swatch={<Swatch className="border border-line" />} label="Upcoming" />
      </ul>
    </div>
  );
}

function Swatch({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <span aria-hidden className={cn("inline-flex size-4 items-center justify-center rounded-md text-ink-3", className)}>
      {children}
    </span>
  );
}

function LegendItem({ swatch, label }: { swatch: ReactNode; label: string }) {
  return (
    <li className="inline-flex items-center gap-2">
      {swatch}
      {label}
    </li>
  );
}

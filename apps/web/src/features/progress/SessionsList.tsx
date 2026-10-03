import { loadUnit, type SessionSummary } from "@strike/core";
import { CalendarCheck, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router";
import { Badge, EmptyState, ErrorState, SkeletonList } from "../../components/ui/States.tsx";
import { cn } from "../../lib/cn.ts";
import { fmtDate, fmtInt, fmtVolume } from "../../lib/format.ts";
import { itemVariants, listVariants } from "../../lib/motion.ts";
import { useSessions, useUnits } from "../../lib/queries.ts";

/** Finished and skipped sessions, newest first, each opening the session. */
export function SessionsList({ columns = false }: { columns?: boolean }) {
  const q = useSessions(30);
  const units = useUnits();
  const unit = loadUnit(units);

  if (q.isPending) return <SkeletonList rows={5} rowClassName="h-14" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (q.data.length === 0) {
    return (
      <EmptyState icon={CalendarCheck} title="No sessions yet">
        Finished and skipped sessions show up here.
      </EmptyState>
    );
  }

  const weekName = (s: SessionSummary) => (s.isDeload ? "Deload" : `Week ${s.week + 1}`);

  return (
    <motion.ul
      variants={listVariants}
      initial="initial"
      animate="animate"
      aria-label="Recent sessions"
      className={cn(columns ? "grid grid-cols-2 gap-x-10" : "flex flex-col")}
    >
      {q.data.map((s) => {
        const date = s.date ?? s.completedAt?.slice(0, 10) ?? null;
        const skipped = s.status === "skipped";
        return (
          <motion.li key={s.id} variants={itemVariants} className="border-b border-line">
            <Link
              to={`/sessions/${s.id}`}
              className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-3.5 transition-colors hover:bg-surface"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-ink">{s.label}</p>
                <p className="mt-0.5 text-[13px] text-ink-3">{date ? `${fmtDate(date)} · ${weekName(s)}` : weekName(s)}</p>
              </div>
              {skipped ? (
                <Badge tone="outline">Skipped</Badge>
              ) : (
                <div className="shrink-0 text-right">
                  <p className="tnum text-sm text-ink-2">
                    {fmtInt(s.setCount)} {s.setCount === 1 ? "set" : "sets"}
                  </p>
                  {s.volume > 0 && (
                    <p className="tnum text-[13px] text-ink-3">
                      {fmtVolume(s.volume)} {unit} lifted
                    </p>
                  )}
                </div>
              )}
              <ChevronRight size={16} className="shrink-0 text-ink-3 transition-colors group-hover:text-ink-2" aria-hidden />
            </Link>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}

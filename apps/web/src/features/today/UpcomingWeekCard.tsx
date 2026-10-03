import type { TodayResponse } from "@strike/core";
import { CalendarClock, ChevronRight, ShoppingCart } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router";
import { WorkingGlyph } from "../../components/CoachStatus.tsx";
import { Panel } from "../../components/Page.tsx";
import { fmtDateShort, fmtRelativeDay, fmtUsd, fmtWeekday } from "../../lib/format.ts";
import { easeOut } from "../../lib/motion.ts";
import { useServerToday } from "../../lib/queries.ts";

/**
 * From the evening before grocery day until the new week starts: is next week's plan written yet,
 * and what's the shopping. Links to next week's grocery list.
 */
export function UpcomingWeekCard({ upcoming }: { upcoming: NonNullable<TodayResponse["upcomingWeek"]> }) {
  const today = useServerToday();
  const rel = fmtRelativeDay(upcoming.shoppingDate, today);
  const shop = rel === "Today" ? "Shop today" : rel === "Tomorrow" ? "Shop tomorrow" : `Shop ${fmtWeekday(upcoming.shoppingDate)}`;

  if (!upcoming.ready) {
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={easeOut}>
        <Panel className="flex items-start gap-3.5 p-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-raised text-ink-2">
            <CalendarClock size={19} aria-hidden />
          </span>
          <div className="min-w-0" role="status">
            <p className="text-[15px] font-semibold text-ink">Next week's plan is being written</p>
            <p className="mt-1 flex items-center gap-2.5 text-sm text-ink-3">
              <WorkingGlyph />
              Meals and groceries for the week of {fmtDateShort(upcoming.weekStart)}
            </p>
          </div>
        </Panel>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={easeOut}>
      <Link
        to="/meals?week=next&tab=groceries"
        className="group flex items-center gap-3.5 rounded-2xl border border-accent/25 bg-surface p-5 transition-colors hover:border-accent/45"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <ShoppingCart size={19} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">Next week is planned</span>
          <span className="tnum mt-1 block text-sm text-ink-2">
            {upcoming.itemCount} {upcoming.itemCount === 1 ? "item" : "items"}, about {fmtUsd(Math.round(upcoming.costUsd))}
          </span>
          <span className="mt-0.5 block text-sm text-ink-3">{shop}</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </motion.div>
  );
}

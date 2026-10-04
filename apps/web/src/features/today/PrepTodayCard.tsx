import type { TodayResponse } from "@strike/core";
import { BellRing, ChefHat, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router";
import { Panel } from "../../components/Page.tsx";
import { fmtMinutes, fmtTime } from "../../lib/format.ts";
import { easeOut } from "../../lib/motion.ts";
import { cookHref, usePrepChecks } from "../meals/prepState.ts";

type Prep = NonNullable<TodayResponse["prep"]>;

/** Today's cooking session(s), opening cook mode, and prep reminders for today. */
export function PrepTodayCard({ prep }: { prep: Prep }) {
  if (prep.sessions.length === 0 && prep.reminders.length === 0) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={easeOut} className="flex flex-col gap-3">
      {prep.sessions.map((s) => (
        <SessionCard key={s.index} menuId={prep.menuId} session={s} />
      ))}
      {prep.reminders.length > 0 && (
        <Panel className="px-5 py-2">
          <ul className="divide-y divide-line" aria-label="Prep reminders">
            {prep.reminders.map((r, i) => (
              <li key={i} className="flex gap-3 py-3">
                <BellRing size={17} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
                <p className="min-w-0 text-[15px] leading-snug text-ink">
                  {r.time && <span className="tnum font-medium text-ink-2">{fmtTime(r.time)}: </span>}
                  {r.text}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </motion.div>
  );
}

function SessionCard({ menuId, session }: { menuId: number; session: Prep["sessions"][number] }) {
  const { checks } = usePrepChecks(menuId, session.index);
  const started = checks.steps.length;
  return (
    <Link
      to={cookHref(menuId, session.index)}
      className="group flex items-center gap-3.5 rounded-2xl border border-accent/25 bg-surface p-5 transition-colors hover:border-accent/45"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <ChefHat size={19} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-ink">Prep today: {session.title}</span>
        <span className="tnum mt-1 block text-sm text-ink-2">{fmtMinutes(session.activeMinutes)} hands-on</span>
        <span className="mt-0.5 block text-sm text-ink-3">
          {started > 0 ? `${started} ${started === 1 ? "step" : "steps"} done` : session.covers}
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

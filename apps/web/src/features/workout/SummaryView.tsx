import { round, type CompleteSessionResponse, type Session } from "@strike/core";
import { Check, House, Trophy } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Page, Panel, Section } from "../../components/Page.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { fmtDateLong, fmtLoad } from "../../lib/format.ts";
import { itemVariants, listVariants } from "../../lib/motion.ts";
import { StatRow } from "./controls.tsx";
import { MuscleFeedbackPrompt } from "./Feedback.tsx";
import { sessionStats } from "./HistoryView.tsx";
import { feedbackFor, musclesInOrder, orderedExercises } from "./lib.ts";
import type { SessionActions } from "./useSessionActions.ts";

interface SummaryViewProps {
  session: Session;
  summary: CompleteSessionResponse["summary"];
  actions: SessionActions;
}

/** Shown right after finishing: totals, PRs, and any muscle feedback still missing. */
export function SummaryView({ session, summary, actions }: SummaryViewProps) {
  const navigate = useNavigate();
  const unit = session.loadUnit;
  const exercises = orderedExercises(session);
  // Fixed when the summary opens, so a muscle stays put while you answer it.
  const [askFor] = useState(() =>
    musclesInOrder(exercises.filter((se) => se.sets.some((s) => s.log))).filter((m) => {
      const fb = feedbackFor(session, m);
      return fb?.pump == null || fb.workload == null;
    }),
  );

  return (
    <Page>
      <div className="pt-2">
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 16, delay: 0.08 }}
          className="flex size-14 items-center justify-center rounded-full bg-accent text-accent-ink"
        >
          <Check size={28} strokeWidth={3} aria-hidden />
        </motion.div>
        {session.date && <p className="mt-6 text-sm font-medium text-ink-3">{fmtDateLong(session.date)}</p>}
        <h1 className="mt-1.5 text-[28px] font-semibold leading-[1.1] tracking-tight text-ink lg:text-[32px]">{session.label} done</h1>
      </div>

      <StatRow className="mt-8" items={sessionStats(session, summary.setCount, summary.volume, summary.durationMinutes)} />

      {summary.prs.length > 0 && (
        <Section title="Personal records" className="mt-10">
          <Panel>
            <motion.ul variants={listVariants} initial="initial" animate="animate" className="divide-y divide-line">
              {summary.prs.map((pr) => (
                <motion.li key={pr.exerciseId} variants={itemVariants} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent" aria-hidden>
                    <Trophy size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium leading-snug text-ink">{pr.name}</p>
                    <p className="mt-0.5 text-[13px] text-ink-3 tnum">
                      Estimated 1RM {fmtLoad(pr.e1rm)} {unit}
                    </p>
                  </div>
                  {pr.previous != null && (
                    <div className="shrink-0 text-right tnum">
                      <p className="text-[15px] font-semibold text-accent">
                        +{fmtLoad(round(pr.e1rm - pr.previous, 1))} {unit}
                      </p>
                      <p className="text-[13px] text-ink-3">from {fmtLoad(pr.previous)}</p>
                    </div>
                  )}
                </motion.li>
              ))}
            </motion.ul>
          </Panel>
        </Section>
      )}

      {askFor.length > 0 && (
        <Section title="Feedback" description="This sets next week's volume." className="mt-10">
          <Panel>
            <ul className="divide-y divide-line">
              {askFor.map((m) => (
                <li key={m} className="px-4 py-4 sm:px-5">
                  <MuscleFeedbackPrompt muscle={m} feedback={feedbackFor(session, m)} onChange={(c) => actions.sendFeedback(m, c)} />
                </li>
              ))}
            </ul>
          </Panel>
        </Section>
      )}

      <Button variant="primary" size="lg" icon={House} className="mt-10 w-full sm:w-auto" onClick={() => void navigate("/")}>
        Back to Today
      </Button>
    </Page>
  );
}

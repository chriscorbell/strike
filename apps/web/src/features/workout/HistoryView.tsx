import type { Session, SessionExercise } from "@strike/core";
import { ArrowLeftRight, Check } from "lucide-react";
import type { ReactNode } from "react";
import { Page, Panel } from "../../components/Page.tsx";
import { Badge } from "../../components/ui/States.tsx";
import { fmtDateLong, fmtMinutes, fmtVolume } from "../../lib/format.ts";
import { LOCATION_LABEL, MUSCLE_LABEL } from "../../lib/labels.ts";
import { StatRow } from "./controls.tsx";
import {
  feedbackFor,
  feedbackSummary,
  fmtRepRange,
  fmtRir,
  fmtWorkSet,
  muscleBounds,
  orderedExercises,
  sessionMinutes,
  sessionVolume,
  setCounts,
  substitutedName,
} from "./lib.ts";
import { SessionHeader, SessionMeta } from "./SessionHeader.tsx";

/** Stats for a finished session; shared with the summary. */
export function sessionStats(session: Session, sets: number, volume: number, minutes: number | null) {
  const items: { label: string; value: ReactNode }[] = [
    { label: "Sets", value: sets },
    {
      label: "Volume",
      value: (
        <>
          {fmtVolume(volume)}
          <span className="ml-1 text-base font-medium text-ink-3">{session.loadUnit}</span>
        </>
      ),
    },
  ];
  if (minutes != null) items.push({ label: "Time", value: fmtMinutes(minutes) });
  return items;
}

/** A completed or skipped session, opened from history. Nothing is editable. */
export function HistoryView({ session }: { session: Session }) {
  const exercises = orderedExercises(session);
  const { logged } = setCounts(exercises);
  const bounds = muscleBounds(exercises);
  const skipped = session.status === "skipped";

  return (
    <Page>
      <SessionHeader session={session} meta={<SessionMeta session={session} />}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[15px] text-ink-2">
          {session.date && <span>{fmtDateLong(session.date)}</span>}
          <span aria-hidden className="text-ink-3">
            ·
          </span>
          <span>{LOCATION_LABEL[session.location]}</span>
          {skipped ? (
            <Badge className="ml-1">Skipped</Badge>
          ) : (
            <Badge tone="accent" icon={Check} className="ml-1">
              Done
            </Badge>
          )}
        </div>
      </SessionHeader>

      {logged > 0 && (
        <StatRow className="mb-8" items={sessionStats(session, logged, sessionVolume(exercises), sessionMinutes(session))} />
      )}

      <div className="flex flex-col gap-4">
        {exercises.map((se) => (
          <ReadOnlyExercise
            key={se.id}
            session={session}
            exercise={se}
            feedbackLine={bounds.last.get(se.muscle) === se.id ? feedbackSummary(feedbackFor(session, se.muscle)) : null}
          />
        ))}
      </div>
    </Page>
  );
}

function ReadOnlyExercise({ session, exercise: se, feedbackLine }: { session: Session; exercise: SessionExercise; feedbackLine: string | null }) {
  const done = se.sets.filter((s) => s.log);
  const swapped = substitutedName(se);
  return (
    <Panel as="article" className="overflow-hidden">
      <header className="px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
        <h2 className="text-[17px] font-semibold leading-snug tracking-tight text-ink">{se.name}</h2>
        <p className="mt-1 text-sm text-ink-3">
          {MUSCLE_LABEL[se.muscle]} · <span className="tnum">{fmtRepRange(se.repMin, se.repMax)}</span>
        </p>
        {swapped && (
          <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-ink-3">
            <ArrowLeftRight size={12} aria-hidden />
            Swapped from {swapped}
          </p>
        )}
      </header>
      {done.length > 0 ? (
        <ol className="divide-y divide-line border-t border-line" aria-label={`${se.name} sets`}>
          {done.map((s) => (
            <li key={s.index} className="flex min-h-12 items-center gap-3 px-4 sm:px-5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent tnum">
                <span className="sr-only">Set </span>
                {s.index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink tnum">
                {fmtWorkSet(s.log!.weight, s.log!.reps, session.loadUnit, se.loadType === "bodyweight")}
              </span>
              <span className="shrink-0 text-sm text-ink-2 tnum">{fmtRir(s.log!.rir ?? s.targetRir)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="border-t border-line px-4 py-3.5 text-sm text-ink-3 sm:px-5">Not logged</p>
      )}
      {feedbackLine && (
        <p className="border-t border-line px-4 py-3.5 text-sm text-ink-2 sm:px-5">
          <span className="mr-2 font-medium text-ink">{MUSCLE_LABEL[se.muscle]}</span>
          {feedbackLine}
        </p>
      )}
    </Panel>
  );
}

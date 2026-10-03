import type { Session, SessionExercise } from "@strike/core";
import { CalendarX, Play } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Page, Panel, Section } from "../../components/Page.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { Segmented } from "../../components/ui/Segmented.tsx";
import { toast } from "../../components/ui/Toast.tsx";
import { cn } from "../../lib/cn.ts";
import { LOCATION_LABEL, MUSCLE_LABEL } from "../../lib/labels.ts";
import { useProfile } from "../../lib/queries.ts";
import { useMediaQuery } from "../../lib/useMediaQuery.ts";
import { Dock, OverflowMenu } from "./controls.tsx";
import { SorenessPicker } from "./Feedback.tsx";
import { feedbackFor, fmtWorkSet, musclesInOrder, orderedExercises, substitutedName, type LoadUnit } from "./lib.ts";
import { availableLocations, locationOptions, SessionHeader, SessionMeta, SkipSheet } from "./SessionHeader.tsx";
import { primeAudio } from "./useRestTimer.ts";
import type { SessionActions } from "./useSessionActions.ts";

/** A planned session: pick the location, answer soreness, then start. */
export function StartView({ session, actions }: { session: Session; actions: SessionActions }) {
  const profile = useProfile();
  const navigate = useNavigate();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [confirmSkip, setConfirmSkip] = useState(false);

  const exercises = orderedExercises(session);
  const muscles = musclesInOrder(exercises);
  const locations = availableLocations(session, profile.equipment);
  const relocating = actions.setLocation.isPending;

  const start = () => {
    primeAudio();
    actions.start.mutate(session.location, { onSuccess: () => window.scrollTo({ top: 0 }) });
  };

  const skip = () =>
    actions.skip.mutate(undefined, {
      onSuccess: () => {
        toast("Workout skipped");
        void navigate("/");
      },
    });

  const startButton = (
    <Button variant="primary" size="lg" block icon={Play} loading={actions.start.isPending} disabled={relocating} onClick={start}>
      Start workout
    </Button>
  );

  return (
    <Page wide>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-10 xl:gap-14">
        <div className="min-w-0">
          <SessionHeader
            session={session}
            meta={<SessionMeta session={session} />}
            actions={<OverflowMenu items={[{ label: "Skip workout", icon: CalendarX, onSelect: () => setConfirmSkip(true), tone: "danger" }]} />}
          />

          <div>
            <Section title="Where are you training?">
              {locations.length > 1 ? (
                <Segmented
                  label="Location"
                  options={locationOptions(locations)}
                  value={session.location}
                  onChange={(l) => l !== session.location && actions.setLocation.mutate(l)}
                  disabled={relocating}
                  block
                  className="sm:max-w-xs"
                />
              ) : (
                <p className="text-[15px] text-ink-2">{LOCATION_LABEL[session.location]}</p>
              )}
            </Section>

            {muscles.length > 0 && (
              <Section title="Soreness" description="How each muscle recovered since you last trained it">
                <Panel>
                  <ul className="divide-y divide-line">
                    {muscles.map((m) => (
                      <li key={m} className="px-4 py-4 sm:px-5">
                        <p className="mb-3 text-[15px] font-medium text-ink">{MUSCLE_LABEL[m]}</p>
                        <SorenessPicker
                          muscle={m}
                          value={feedbackFor(session, m)?.soreness ?? null}
                          onChange={(v) => actions.sendFeedback(m, { soreness: v })}
                        />
                      </li>
                    ))}
                  </ul>
                </Panel>
              </Section>
            )}

            {!desktop && (
              <Section title="Exercises">
                <ExercisePreview exercises={exercises} unit={session.loadUnit} busy={relocating} />
              </Section>
            )}
          </div>
        </div>

        {desktop && (
          <aside aria-label="Exercises" className="sticky top-10 flex flex-col gap-4">
            <h2 className="text-[17px] font-semibold tracking-tight text-ink">Exercises</h2>
            <ExercisePreview exercises={exercises} unit={session.loadUnit} busy={relocating} />
            {startButton}
          </aside>
        )}
      </div>

      {!desktop && (
        <Dock show label="Start">
          {startButton}
        </Dock>
      )}

      <SkipSheet
        open={confirmSkip}
        label={session.label}
        pending={actions.skip.isPending}
        onClose={() => setConfirmSkip(false)}
        onConfirm={skip}
      />
    </Page>
  );
}

function ExercisePreview({ exercises, unit, busy }: { exercises: SessionExercise[]; unit: LoadUnit; busy: boolean }) {
  return (
    <Panel className={cn("transition-opacity duration-200", busy && "opacity-50")}>
      <ol className="divide-y divide-line" aria-busy={busy || undefined}>
        {exercises.map((se, i) => {
          const first = se.sets[0];
          const swapped = substitutedName(se);
          return (
            <li key={se.id} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
              <span className="w-4 shrink-0 pt-px text-sm text-ink-3 tnum">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium leading-snug text-ink">{se.name}</p>
                <p className="mt-0.5 text-[13px] text-ink-3 tnum">
                  {se.sets.length} {se.sets.length === 1 ? "set" : "sets"}
                  {first && ` · ${fmtWorkSet(first.targetWeight, first.targetReps, unit, se.loadType === "bodyweight")}`}
                </p>
                {swapped && <p className="mt-0.5 text-[13px] text-ink-3">Swapped from {swapped}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

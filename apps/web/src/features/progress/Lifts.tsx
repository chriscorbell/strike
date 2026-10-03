import { loadUnit, Muscle, type ExerciseInfo, type MesoOverview, type SessionSummary } from "@strike/core";
import { ChevronRight, ChevronsUpDown, Dumbbell } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Panel } from "../../components/Page.tsx";
import { Sheet } from "../../components/ui/Sheet.tsx";
import { EmptyState, ErrorState, Skeleton } from "../../components/ui/States.tsx";
import { cn } from "../../lib/cn.ts";
import { fmtDate, fmtDateShort, fmtLoad, fmtRelativeDay } from "../../lib/format.ts";
import { MUSCLE_LABEL } from "../../lib/labels.ts";
import { easeOut, spring } from "../../lib/motion.ts";
import { useExerciseHistory, useLoggedExercises, useMeso, useServerToday, useSessions, useUnits } from "../../lib/queries.ts";
import { LiftChart } from "./LiftChart.tsx";
import { signed } from "./util.ts";

interface LiftItem {
  exerciseId: string;
  name: string;
  muscle: Muscle;
}

interface LiftGroup {
  label: string;
  items: LiftItem[];
}

/** Exercises with logged sets, grouped by primary muscle in the usual body order. */
function groupLifts(exercises: ExerciseInfo[] | undefined): LiftGroup[] {
  if (!exercises) return [];
  return Muscle.options
    .map((m) => ({
      label: MUSCLE_LABEL[m],
      items: exercises
        .filter((e) => e.primary === m)
        .map((e) => ({ exerciseId: e.id, name: e.name, muscle: e.primary }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((g) => g.items.length > 0);
}

/** Start with the first lift of the most recent finished session's day when it has history. */
function defaultLift(all: LiftItem[], meso: MesoOverview | null | undefined, sessions: SessionSummary[] | undefined): string | null {
  const last = meso ? sessions?.find((s) => s.status === "completed" && s.mesoId === meso.id) : undefined;
  const fromLast = last ? meso?.days[last.dayIndex]?.exercises.find((e) => all.some((a) => a.exerciseId === e.exerciseId)) : undefined;
  return fromLast?.exerciseId ?? all[0]?.exerciseId ?? null;
}

/** Per-exercise progress for every exercise you've logged. */
export function Lifts({ layout }: { layout: "split" | "stack" }) {
  const logged = useLoggedExercises();
  const meso = useMeso();
  const sessions = useSessions(30);
  const [params, setParams] = useSearchParams();
  const [pickerOpen, setPickerOpen] = useState(false);

  const groups = useMemo(() => groupLifts(logged.data), [logged.data]);
  const all = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const requested = params.get("lift");
  const selectedId = requested && all.some((e) => e.exerciseId === requested) ? requested : defaultLift(all, meso.data, sessions.data);
  const selected = all.find((e) => e.exerciseId === selectedId) ?? null;

  const select = (id: string) => {
    setParams(
      (p) => {
        p.set("lift", id);
        return p;
      },
      { replace: true },
    );
    setPickerOpen(false);
  };

  if (logged.isPending) {
    return (
      <div aria-busy="true">
        <Skeleton className="h-12 w-full lg:w-72" />
        <Skeleton className="mt-6 h-64" />
      </div>
    );
  }
  if (logged.isError) return <ErrorState error={logged.error} onRetry={() => void logged.refetch()} />;
  if (!selected) {
    return (
      <EmptyState icon={Dumbbell} title="No lifts yet">
        Log a workout and each exercise gets its own progress chart here.
      </EmptyState>
    );
  }

  const list = <LiftList groups={groups} selectedId={selected.exerciseId} onSelect={select} />;

  if (layout === "split") {
    return (
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-4 -ml-3 max-h-[640px] overflow-y-auto pr-2">{list}</div>
        <LiftDetail key={selected.exerciseId} lift={selected} className="col-span-8" />
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Exercise: ${selected.name}. Choose another`}
        className="flex h-12 w-full items-center gap-3 rounded-xl border border-line-strong bg-raised px-3.5 text-left transition-colors hover:bg-hover"
      >
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">{selected.name}</span>
        <span className="shrink-0 text-[13px] text-ink-3">{MUSCLE_LABEL[selected.muscle]}</span>
        <ChevronsUpDown size={16} className="shrink-0 text-ink-3" aria-hidden />
      </button>
      <LiftDetail key={selected.exerciseId} lift={selected} className="mt-6" showName={false} />
      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Choose an exercise">
        <div className="-mx-3">{list}</div>
      </Sheet>
    </div>
  );
}

function LiftList({ groups, selectedId, onSelect }: { groups: LiftGroup[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <nav aria-label="Exercises" className="flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="mb-1 px-3 text-xs font-medium text-ink-3">{g.label}</p>
          <ul>
            {g.items.map((e) => {
              const active = e.exerciseId === selectedId;
              return (
                <li key={e.exerciseId}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelect(e.exerciseId)}
                    className={cn(
                      "relative isolate flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                      active ? "text-ink" : "text-ink-2 hover:bg-surface hover:text-ink",
                    )}
                  >
                    {active && (
                      <motion.span layoutId="lift-active" transition={spring} className="absolute inset-0 -z-10 rounded-xl bg-raised" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function LiftDetail({ lift, className, showName = true }: { lift: LiftItem; className?: string; showName?: boolean }) {
  const q = useExerciseHistory(lift.exerciseId);
  const units = useUnits();
  const today = useServerToday();
  const unit = loadUnit(units);

  const perDumbbell = q.data?.exercise.loadType === "dumbbell";
  // In the stacked layout the picker button above already names the lift.
  const header = showName ? (
    <div className="mb-5">
      <h3 className="text-lg font-semibold tracking-tight text-ink">{lift.name}</h3>
      <p className="mt-0.5 text-[13px] text-ink-3">
        {MUSCLE_LABEL[lift.muscle]}
        {perDumbbell && ", loads per dumbbell"}
      </p>
    </div>
  ) : perDumbbell ? (
    <p className="-mt-3 mb-5 text-[13px] text-ink-3">Loads per dumbbell</p>
  ) : null;

  if (q.isPending) {
    return (
      <div className={className} aria-busy="true">
        {header}
        <div className="grid grid-cols-2 gap-5">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
        <Skeleton className="mt-6 h-60" />
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className={className}>
        {header}
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </div>
    );
  }

  const points = [...q.data.points].sort((a, b) => a.date.localeCompare(b.date));
  if (points.length === 0) {
    return (
      <div className={className}>
        {header}
        <EmptyState icon={Dumbbell} title="No sets logged yet" className="py-4">
          Log {lift.name} in a session and its progress shows up here.
        </EmptyState>
      </div>
    );
  }

  const mode = points.some((p) => p.e1rm != null) ? "e1rm" : "reps";
  const latest = points[points.length - 1]!;
  const first = points[0]!;
  const withE1rm = points.filter((p) => p.e1rm != null);
  const lastE1rm = withE1rm[withE1rm.length - 1]?.e1rm ?? null;
  const firstE1rm = withE1rm[0]?.e1rm ?? null;

  const headline =
    mode === "e1rm"
      ? { label: "Estimated 1RM", value: fmtLoad(lastE1rm), unit, change: lastE1rm != null && firstE1rm != null && withE1rm.length > 1 ? `${signed(lastE1rm - firstE1rm, 1)} ${unit} since ${fmtDateShort(withE1rm[0]!.date)}` : null }
      : { label: "Best reps", value: String(latest.bestReps), unit: "reps", change: points.length > 1 ? `${signed(latest.bestReps - first.bestReps, 0)} since ${fmtDateShort(first.date)}` : null };

  const summary =
    mode === "e1rm"
      ? `${lift.name} estimated one rep max over ${points.length} ${points.length === 1 ? "session" : "sessions"}: ${fmtLoad(firstE1rm)} to ${fmtLoad(lastE1rm)} ${unit}.`
      : `${lift.name} best reps over ${points.length} ${points.length === 1 ? "session" : "sessions"}: ${first.bestReps} to ${latest.bestReps}.`;

  return (
    <motion.div className={className} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={easeOut}>
      {header}
      <div className="grid grid-cols-2 gap-x-5">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-ink-3">{headline.label}</p>
          <p className="mt-1.5 flex items-baseline gap-1 whitespace-nowrap">
            <span className="text-[28px] font-semibold leading-none tracking-tight text-ink">{headline.value}</span>
            <span className="text-sm font-medium text-ink-3">{headline.unit}</span>
          </p>
          {headline.change && <p className="mt-2 text-[13px] text-ink-2">{headline.change}</p>}
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-ink-3">Best set, last session</p>
          <p className="mt-1.5 flex items-baseline gap-1 whitespace-nowrap text-[28px] font-semibold leading-none tracking-tight text-ink">
            {latest.bestWeight == null ? (
              <>
                {latest.bestReps}
                <span className="text-sm font-medium tracking-normal text-ink-3">reps</span>
              </>
            ) : (
              <>
                {fmtLoad(latest.bestWeight)}
                <span className="text-sm font-medium tracking-normal text-ink-3">{unit}</span>
                <span className="ml-1">× {latest.bestReps}</span>
              </>
            )}
          </p>
          <p className="mt-2 text-[13px] text-ink-2">{fmtRelativeDay(latest.date, today)}</p>
        </div>
      </div>

      <Panel className="mt-6 p-4 sm:p-5">
        <LiftChart points={points} mode={mode} unit={unit} summary={summary} />
      </Panel>

      <h4 className="mt-8 text-[15px] font-semibold text-ink">History</h4>
      <ul className="mt-1 divide-y divide-line" aria-label={`${lift.name} sessions`}>
        {[...points].reverse().map((p) => (
          <li key={`${p.sessionId}-${p.date}`}>
            <Link
              to={`/sessions/${p.sessionId}`}
              className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-surface"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[15px] text-ink">{fmtDate(p.date)}</p>
                <p className="tnum mt-0.5 truncate text-[13px] text-ink-3">
                  {p.sets.map((s) => `${fmtLoad(s.weight)} × ${s.reps}`).join(", ")}
                </p>
              </div>
              {p.e1rm != null && (
                <div className="shrink-0 text-right">
                  <p className="tnum text-[15px] font-medium text-ink">
                    {fmtLoad(p.e1rm)} <span className="text-xs font-normal text-ink-3">{unit}</span>
                  </p>
                  <p className="text-xs text-ink-3">e1RM</p>
                </div>
              )}
              <ChevronRight size={16} className="shrink-0 text-ink-3 transition-colors group-hover:text-ink-2" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

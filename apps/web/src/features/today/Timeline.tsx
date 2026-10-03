import { minutesNowIn, parseTime, type MealOption, type TimelineItem, type TimelineMeal, type TimelineWorkout } from "@strike/core";
import { ArrowRight, Ban, Check, ChevronDown, MapPin, Pencil, Plus, Sparkles, Undo2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useState } from "react";
import { Link } from "react-router";
import { WorkingGlyph } from "../../components/CoachStatus.tsx";
import { MacroLine } from "../../components/Macros.tsx";
import { Collapse } from "../../components/Page.tsx";
import { Button, IconButton } from "../../components/ui/Button.tsx";
import { Badge } from "../../components/ui/States.tsx";
import { toast } from "../../components/ui/Toast.tsx";
import { cn } from "../../lib/cn.ts";
import { endpoints } from "../../lib/endpoints.ts";
import { fmtKcal, fmtTime, splitTime } from "../../lib/format.ts";
import { LOCATION_LABEL, roleTag } from "../../lib/labels.ts";
import { easeOut, spring } from "../../lib/motion.ts";
import { useJob, useProfile, useStartJob } from "../../lib/queries.ts";
import { LogOtherSheet } from "../meals/LogOtherSheet.tsx";
import { AteButton, OptionRow, OptionSheet } from "../meals/MealOption.tsx";
import { useDeleteMealLog, useLogMeal } from "../meals/mealMutations.ts";

interface TimelineProps {
  date: string;
  items: TimelineItem[];
  isToday: boolean;
}

/** Minutes since midnight in the profile time zone, refreshed every minute. */
function useNowMinutes(timeZone: string, enabled: boolean) {
  const [now, setNow] = useState(() => minutesNowIn(timeZone));
  useEffect(() => {
    if (!enabled) return;
    const t = window.setInterval(() => setNow(minutesNowIn(timeZone)), 60_000);
    return () => window.clearInterval(t);
  }, [timeZone, enabled]);
  return now;
}

export function Timeline({ date, items, isToday }: TimelineProps) {
  const profile = useProfile();
  const now = useNowMinutes(profile.timezone, isToday);
  const nowIndex = isToday ? items.findIndex((i) => parseTime(i.time) > now) : -1;
  const markerAt = isToday ? (nowIndex === -1 ? items.length : nowIndex) : -1;

  return (
    <ol className="relative" aria-label="Today's plan">
      {items.map((item, i) => {
        const key = item.kind === "meal" ? `meal-${item.slotIndex}-${item.label}` : `workout-${item.sessionId}`;
        const past = isToday && i < markerAt;
        return (
          <li key={key}>
            {i === markerAt && <NowMarker />}
            {item.kind === "meal" ? (
              <MealItem date={date} meal={item} past={past} last={i === items.length - 1} />
            ) : (
              <WorkoutItem workout={item} past={past} last={i === items.length - 1} />
            )}
          </li>
        );
      })}
      {markerAt === items.length && items.length > 0 && (
        <li>
          <NowMarker />
        </li>
      )}
    </ol>
  );
}

function NowMarker() {
  return (
    <div className="relative flex items-center py-1.5 pl-16" role="separator" aria-label="Now">
      <span className="absolute left-16 size-2 -translate-x-1/2 rounded-full bg-accent" aria-hidden />
      <span className="ml-3 h-px flex-1 bg-accent/40" aria-hidden />
      <span className="ml-2 text-[11px] font-semibold text-accent">Now</span>
    </div>
  );
}

function TimeLabel({ time, dim }: { time: string; dim?: boolean }) {
  const { clock, period } = splitTime(time);
  return (
    <div className={cn("tnum w-11 shrink-0 pt-[3px] text-right leading-tight", dim ? "text-ink-3/70" : "text-ink-3")}>
      <span className="block text-[13px] font-medium text-ink-2">{clock}</span>
      <span className="block text-[11px]">{period}</span>
    </div>
  );
}

/** The rail: a node plus the line to the next item. */
function Rail({ state, last, workout }: { state: "done" | "skipped" | "open"; last: boolean; workout?: boolean }) {
  return (
    <div className="relative flex w-4 shrink-0 justify-center self-stretch">
      {!last && <span className="absolute bottom-0 top-6 w-px bg-line-strong" aria-hidden />}
      <span
        className={cn(
          "relative mt-1.5 flex items-center justify-center rounded-full transition-colors duration-200",
          workout ? "size-4" : "size-3.5",
          state === "done" && "bg-accent text-accent-ink",
          state === "skipped" && "border border-line-strong bg-raised",
          state === "open" && (workout ? "border-2 border-accent bg-bg" : "border-2 border-ink-3/60 bg-bg"),
        )}
        aria-hidden
      >
        <AnimatePresence>
          {state === "done" && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={spring}>
              <Check size={workout ? 11 : 9} strokeWidth={3.5} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </div>
  );
}

// ---------- Meal ----------

function MealItem({ date, meal, past, last }: { date: string; meal: TimelineMeal; past: boolean; last: boolean }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<MealOption | null>(null);
  const [otherOpen, setOtherOpen] = useState(false);
  const [jobId, setJobId] = useState<number | null>(null);
  const panelId = useId();
  const logMeal = useLogMeal();
  const deleteLog = useDeleteMealLog(date);
  const startMore = useStartJob((v: { date: string; slotIndex: number }) => endpoints.moreOptions(v.date, v.slotIndex));
  const moreJob = useJob(jobId);
  const findingMore = jobId != null && (!moreJob.data || moreJob.data.status === "queued" || moreJob.data.status === "running");

  useEffect(() => {
    const j = moreJob.data;
    if (!j || j.id !== jobId) return;
    if (j.status === "succeeded") {
      const n = Array.isArray(j.result) ? j.result.length : 0;
      toast(n ? `Added ${n} more option${n === 1 ? "" : "s"}` : "New options added");
      setJobId(null);
    } else if (j.status === "failed") {
      toast(j.error ?? "Couldn't find more options", { tone: "error" });
      setJobId(null);
    }
  }, [moreJob.data, jobId]);

  const log = meal.log;
  // The planned dish is what you have groceries for; without a plan the first option is the suggestion.
  const planned = meal.plannedOptionId ? (meal.options.find((o) => o.id === meal.plannedOptionId) ?? null) : null;
  const featured = planned ?? meal.options[0];
  const role = roleTag(meal.role, meal.label);
  const others = meal.options.filter((o) => o.id !== planned?.id);
  const home = others.filter((o) => o.kind === "home");
  const out = others.filter((o) => o.kind === "out");
  const state = log ? (log.status === "skipped" ? "skipped" : "done") : "open";

  const ate = (option: MealOption) => {
    logMeal.mutate(
      { date, slotIndex: meal.slotIndex, optionId: option.id, custom: null, status: "eaten" },
      {
        onSuccess: (l) => {
          toast(`Logged ${l.name}`, { action: { label: "Undo", onClick: () => deleteLog.mutate(l.id) } });
          setDetail(null);
          setOpen(false);
        },
      },
    );
  };

  const skip = () =>
    logMeal.mutate(
      { date, slotIndex: meal.slotIndex, optionId: null, custom: null, status: "skipped" },
      { onSuccess: () => setOpen(false) },
    );

  const undo = () => {
    if (log && log.id > 0) deleteLog.mutate(log.id);
  };

  const pendingOption = logMeal.isPending ? logMeal.variables?.optionId : undefined;

  return (
    <div className="flex gap-3">
      <TimeLabel time={meal.time} dim={past && !log} />
      <Rail state={state} last={last} />
      <div className="min-w-0 flex-1 pb-5">
        <div className="-mx-2 -mt-1 flex items-start gap-1">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((o) => !o)}
            className="group flex min-w-0 flex-1 items-start gap-3 rounded-xl px-2 py-1 text-left transition-colors hover:bg-surface"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[13px] font-medium text-ink-3">{meal.label}</span>
                {role && <Badge tone="outline">{role}</Badge>}
              </div>
              <p
                className={cn(
                  "mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug",
                  state === "skipped" || !featured ? "text-ink-3" : "text-ink",
                )}
              >
                {log ? (log.status === "skipped" ? "Skipped" : log.name) : featured ? featured.name : "No options yet"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 pt-0.5">
              <span className="tnum text-[13px] text-ink-3">
                {fmtKcal(log?.status === "eaten" ? log.macros.kcal : (featured?.macros.kcal ?? meal.targets.kcal))} kcal
              </span>
              <ChevronDown
                size={16}
                className={cn("text-ink-3 transition-transform duration-200", open && "rotate-180")}
                aria-hidden
              />
            </div>
          </button>
          {!log && featured && (
            <IconButton
              icon={Check}
              size="sm"
              variant="outline"
              label={`Ate ${featured.name}`}
              loading={logMeal.isPending && pendingOption === featured.id}
              onClick={() => ate(featured)}
              className="mt-0.5 rounded-full"
            />
          )}
        </div>

        <Collapse open={open} id={panelId}>
          <div className="pt-3">
            {log ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface px-3.5 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-ink-3">{log.status === "skipped" ? "Marked as skipped" : "You ate"}</p>
                  {log.status === "eaten" && (
                    <>
                      <p className="mt-0.5 truncate text-[15px] font-medium text-ink">{log.name}</p>
                      <MacroLine macros={log.macros} className="mt-1" />
                    </>
                  )}
                </div>
                <Button size="sm" variant="ghost" icon={Undo2} onClick={undo} loading={deleteLog.isPending} disabled={log.id < 0}>
                  Undo
                </Button>
              </div>
            ) : (
              <p className="text-[13px] text-ink-3">
                Target <MacroLine macros={meal.targets} />
              </p>
            )}

            {meal.options.length > 0 && (
              <div className="mt-2">
                {planned && optionGroup("Planned", [planned], true)}
                {home.length > 0 && optionGroup(planned ? "Other home dishes" : "Home", home)}
                {out.length > 0 && optionGroup("Grab and go", out)}
              </div>
            )}

            <AnimatePresence>
              {findingMore && (
                <motion.p
                  role="status"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={easeOut}
                  className="flex items-center gap-2.5 overflow-hidden py-2 text-sm text-ink-2"
                >
                  <WorkingGlyph />
                  Finding more options
                </motion.p>
              )}
            </AnimatePresence>

            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setOtherOpen(true)}>
                Something else
              </Button>
              {!log && (
                <Button size="sm" variant="secondary" icon={Ban} onClick={skip} loading={logMeal.isPending && logMeal.variables?.status === "skipped"}>
                  Skipped
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                icon={Sparkles}
                loading={startMore.isPending}
                disabled={findingMore}
                onClick={() => startMore.mutate({ date, slotIndex: meal.slotIndex }, { onSuccess: (j) => setJobId(j.id) })}
              >
                More options
              </Button>
            </div>
          </div>
        </Collapse>
      </div>

      <OptionSheet
        option={detail}
        onClose={() => setDetail(null)}
        context={`${meal.label}, ${fmtTime(meal.time)}`}
        footer={
          detail && (
            <Button
              variant="primary"
              size="lg"
              block
              icon={Check}
              loading={logMeal.isPending && pendingOption === detail.id}
              disabled={log?.optionId === detail.id}
              onClick={() => ate(detail)}
            >
              {log?.optionId === detail.id ? "Logged" : "Ate this"}
            </Button>
          )
        }
      />
      <LogOtherSheet
        open={otherOpen}
        onClose={() => setOtherOpen(false)}
        date={date}
        slotIndex={meal.slotIndex}
        slotLabel={`${meal.label}, ${fmtTime(meal.time)}`}
      />
    </div>
  );

  function optionGroup(title: string, options: MealOption[], primary = false) {
    return (
      <div className="mt-2" key={title}>
        <h4 className="pt-2 text-[13px] font-medium text-ink-3">{title}</h4>
        <div className="divide-y divide-line">
          {options.map((o) => (
            <OptionRow
              key={o.id}
              option={o}
              selected={log?.optionId === o.id}
              onOpen={() => setDetail(o)}
              action={
                log?.optionId === o.id ? undefined : (
                  <AteButton
                    onClick={() => ate(o)}
                    loading={logMeal.isPending && pendingOption === o.id}
                    label={log ? "Ate this instead" : "Ate this"}
                    primary={primary && !log}
                  />
                )
              }
            />
          ))}
        </div>
      </div>
    );
  }
}

// ---------- Workout ----------

function WorkoutItem({ workout, past, last }: { workout: TimelineWorkout; past: boolean; last: boolean }) {
  const done = workout.status === "completed";
  const skipped = workout.status === "skipped";
  const cta = done ? "View" : workout.status === "in_progress" ? "Continue" : "Start";
  return (
    <div className="flex gap-3">
      <TimeLabel time={workout.time} dim={past && !done} />
      <Rail state={done ? "done" : skipped ? "skipped" : "open"} last={last} workout />
      <div className="min-w-0 flex-1 pb-5">
        <div
          className={cn(
            "-mt-1 rounded-2xl border p-4",
            done || skipped ? "border-line bg-surface" : "border-accent/25 bg-surface shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="tnum text-[13px] text-ink-3">
                {fmtTime(workout.time)} to {fmtTime(workout.endTime)}
              </p>
              <h3 className="mt-0.5 text-lg font-semibold tracking-tight text-ink">{workout.label}</h3>
            </div>
            {done && <Badge tone="accent" icon={Check}>Done</Badge>}
            {skipped && <Badge>Skipped</Badge>}
            {workout.status === "in_progress" && <Badge tone="warn">In progress</Badge>}
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-3">
            <span className="inline-flex items-center gap-1">
              <MapPin size={13} aria-hidden />
              {LOCATION_LABEL[workout.location]}
            </span>
            <span className="tnum">
              {workout.exerciseCount} exercises, {workout.setCount} sets
            </span>
          </p>
          {!skipped && (
            <Link
              to={`/sessions/${workout.sessionId}`}
              className={cn(
                "mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-medium transition-[filter,background-color,transform] active:scale-[0.98] sm:w-auto sm:px-5",
                done ? "bg-raised text-ink hover:bg-hover" : "bg-accent text-accent-ink hover:brightness-105",
              )}
            >
              {cta}
              <ArrowRight size={17} aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/** Button to add a meal outside the plan's slots. */
export function AddExtraMeal({ date }: { date: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" icon={Plus} onClick={() => setOpen(true)}>
        Add a meal
      </Button>
      <LogOtherSheet open={open} onClose={() => setOpen(false)} date={date} slotIndex={null} />
    </>
  );
}

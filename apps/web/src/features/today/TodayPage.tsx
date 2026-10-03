import { addDays, type TodayResponse } from "@strike/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BedDouble, ChevronLeft, ChevronRight, Dumbbell, SlidersHorizontal, Trash, Utensils } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { CoachStatus, WorkingGlyph } from "../../components/CoachStatus.tsx";
import { MacroLine } from "../../components/Macros.tsx";
import { Page, PageHeader, Section } from "../../components/Page.tsx";
import { Button, IconButton } from "../../components/ui/Button.tsx";
import { Badge, EmptyState, ErrorState, Skeleton } from "../../components/ui/States.tsx";
import { endpoints } from "../../lib/endpoints.ts";
import { fmtClock, fmtDateLong, fmtRelativeDay, fmtWeekday } from "../../lib/format.ts";
import { LOCATION_LABEL } from "../../lib/labels.ts";
import { itemVariants } from "../../lib/motion.ts";
import { keys, useServerToday, useToday } from "../../lib/queries.ts";
import { useDeleteMealLog } from "../meals/mealMutations.ts";
import { CheckInCard } from "./CheckInCard.tsx";
import { DaySheet } from "./DaySheet.tsx";
import { MacroSummary } from "./MacroSummary.tsx";
import { AddExtraMeal, Timeline } from "./Timeline.tsx";
import { UpcomingWeekCard } from "./UpcomingWeekCard.tsx";
import { WeighInCard } from "./WeighInCard.tsx";

export function TodayPage() {
  const serverToday = useServerToday();
  const [params, setParams] = useSearchParams();
  const date = params.get("date") ?? serverToday;
  const isToday = date === serverToday;
  const query = useToday(date);
  const [dayOpen, setDayOpen] = useState(false);

  const goTo = (d: string) => {
    if (d === serverToday) setParams({}, { replace: true });
    else setParams({ date: d }, { replace: true });
  };

  const t = query.data;

  return (
    <Page wide>
      <PageHeader
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3">
            {fmtDateLong(date)}
            {!isToday && (
              <button type="button" onClick={() => goTo(serverToday)} className="font-medium text-accent hover:underline">
                Back to today
              </button>
            )}
          </span>
        }
        title={isToday ? "Today" : ["Yesterday", "Tomorrow"].includes(fmtRelativeDay(date, serverToday)) ? fmtRelativeDay(date, serverToday) : fmtWeekday(date)}
        actions={
          <>
            <IconButton icon={ChevronLeft} label="Previous day" onClick={() => goTo(addDays(date, -1))} />
            <IconButton icon={ChevronRight} label="Next day" onClick={() => goTo(addDays(date, 1))} />
            <IconButton icon={SlidersHorizontal} label="Adjust day" onClick={() => setDayOpen(true)} disabled={!t} />
          </>
        }
      >
        {t && <DayBadges today={t} />}
        {t && <CoachStatus jobs={t.pendingJobs} className="mt-3" />}
      </PageHeader>

      {query.isPending ? (
        <TodaySkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <TodayBody t={query.data} date={date} isToday={isToday} />
      )}

      {t && <DaySheet open={dayOpen} onClose={() => setDayOpen(false)} today={t} />}
    </Page>
  );
}

function TodayBody({ t, date, isToday }: { t: TodayResponse; date: string; isToday: boolean }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
      <aside className="flex flex-col gap-3 lg:sticky lg:top-10 lg:order-2 lg:self-start">
        {isToday && t.upcomingWeek && <UpcomingWeekCard upcoming={t.upcomingWeek} />}
        <MacroSummary consumed={t.consumed} targets={t.targets} />
        {(isToday || t.weight.loggedKg != null) && <WeighInCard key={date} today={t} />}
        {isToday && <CheckInCard due={t.checkIn.due} />}
      </aside>

      <div className="min-w-0 lg:order-1">
        <Section title="Plan">
          {t.dayType === "rest" && <RestNote today={t} />}
          {!t.menuReady && <MenuPending today={t} />}
          {t.timeline.length === 0 ? (
            <EmptyState icon={Utensils} title="Nothing planned">
              Meals appear here once your menu is ready.
            </EmptyState>
          ) : (
            <Timeline date={date} items={t.timeline} isToday={isToday} />
          )}
        </Section>

        <ExtraMeals today={t} />
      </div>
    </div>
  );
}

function DayBadges({ today }: { today: TodayResponse }) {
  const m = today.meso;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {today.dayType === "training" ? (
        <Badge tone="accent" icon={Dumbbell}>
          Training day
        </Badge>
      ) : (
        <Badge icon={BedDouble}>Rest day</Badge>
      )}
      {m &&
        (m.isDeload ? (
          <Badge tone="outline">Deload week</Badge>
        ) : (
          <Badge tone="outline">
            Week {m.week + 1} of {m.hardWeeks}, {m.targetRir} RIR
          </Badge>
        ))}
    </div>
  );
}

function RestNote({ today }: { today: TodayResponse }) {
  const qc = useQueryClient();
  const train = useMutation({
    mutationFn: () => endpoints.makeTrainingDay(today.date),
    onSuccess: (res) => qc.setQueryData(keys.today(today.date), res),
  });
  const next = today.nextSession;
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3">
      <p className="text-sm text-ink-2">
        {next ? (
          <>
            Next up: <span className="font-medium text-ink">{next.label}</span>
            <span className="text-ink-3">, {LOCATION_LABEL[next.location].toLowerCase()}</span>
          </>
        ) : (
          "No session planned"
        )}
      </p>
      {next && (
        <Button size="sm" variant="ghost" icon={Dumbbell} loading={train.isPending} onClick={() => train.mutate()}>
          Train today
        </Button>
      )}
    </div>
  );
}

function MenuPending({ today }: { today: TodayResponse }) {
  const writing = today.pendingJobs.some((j) => j.kind === "meal_menu");
  return (
    <p role="status" className="mb-5 flex items-center gap-2.5 text-sm text-ink-2">
      {writing && <WorkingGlyph />}
      {writing ? "Your coach is writing this week's menu. Options show up here when it's done." : "This week's menu isn't ready yet."}
    </p>
  );
}

function ExtraMeals({ today }: { today: TodayResponse }) {
  const del = useDeleteMealLog(today.date);
  const meals = today.extraMeals;
  return (
    <Section
      title="Extra meals"
      className="mt-6"
      action={<AddExtraMeal date={today.date} />}
    >
      {meals.length === 0 ? (
        <p className="text-sm text-ink-3">Anything eaten outside the plan.</p>
      ) : (
        <ul className="divide-y divide-line">
          <AnimatePresence initial={false}>
            {meals.map((m) => (
              <motion.li
                key={m.id}
                layout
                variants={itemVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium text-ink">{m.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5">
                    <MacroLine macros={m.macros} />
                    <span className="text-[13px] text-ink-3">{fmtClock(m.loggedAt)}</span>
                  </p>
                </div>
                <IconButton
                  icon={Trash}
                  label={`Remove ${m.name}`}
                  size="sm"
                  disabled={m.id < 0}
                  onClick={() => del.mutate(m.id)}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Section>
  );
}

function TodaySkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-3 lg:order-2">
        <Skeleton className="h-[156px] rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <div className="flex flex-col gap-6 lg:order-1">
        <Skeleton className="h-6 w-20" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-9 w-11" />
            <Skeleton className="h-14 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

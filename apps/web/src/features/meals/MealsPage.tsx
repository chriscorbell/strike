import { addDays, weekdayOf, weekStartOn, type DayType, type MealMenu, type MealOption, type MenuSlot } from "@strike/core";
import { useQueryClient } from "@tanstack/react-query";
import { BedDouble, CalendarClock, ChefHat, Dumbbell, Lightbulb, RefreshCw, Sparkles, Utensils } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { WorkingGlyph } from "../../components/CoachStatus.tsx";
import { MacroBars, MacroLine } from "../../components/Macros.tsx";
import { Page, PageHeader, Section } from "../../components/Page.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { Field, TextArea } from "../../components/ui/Field.tsx";
import { Segmented } from "../../components/ui/Segmented.tsx";
import { Sheet } from "../../components/ui/Sheet.tsx";
import { Badge, EmptyState, ErrorState, Skeleton, SkeletonList } from "../../components/ui/States.tsx";
import { toast } from "../../components/ui/Toast.tsx";
import { cn } from "../../lib/cn.ts";
import { endpoints, type MenuWeek } from "../../lib/endpoints.ts";
import { fmtDateShort, fmtKcal, fmtRelativeDay } from "../../lib/format.ts";
import { roleTag, WEEKDAY_LONG } from "../../lib/labels.ts";
import { easeOut, itemVariants, listVariants } from "../../lib/motion.ts";
import { keys, useMealHistory, useMenu, useProfile, useServerToday, useStartJob, useToday } from "../../lib/queries.ts";
import { planReadyDay } from "../../lib/week.ts";
import { GroceriesView } from "./GroceriesView.tsx";
import { OptionRow, OptionSheet } from "./MealOption.tsx";
import { PlanView } from "./PlanView.tsx";

type Tab = "plan" | "groceries" | "prep" | "history";
const TABS: readonly Tab[] = ["plan", "groceries", "prep", "history"];

export function MealsPage() {
  const [params, setParams] = useSearchParams();
  const week: MenuWeek = params.get("week") === "next" ? "next" : "current";
  const rawTab = params.get("tab") as Tab | null;
  const tab: Tab = rawTab && TABS.includes(rawTab) ? rawTab : "plan";
  const setView = (next: { week?: MenuWeek; tab?: Tab }) =>
    setParams(
      (p) => {
        const w = next.week ?? week;
        const t = next.tab ?? tab;
        if (w === "next") p.set("week", "next");
        else p.delete("week");
        if (t === "plan") p.delete("tab");
        else p.set("tab", t);
        return p;
      },
      { replace: true },
    );

  const profile = useProfile();
  const today = useServerToday();
  const menuQuery = useMenu(week);
  const [regenOpen, setRegenOpen] = useState(false);
  const menu = menuQuery.data?.menu ?? null;
  const pending = menuQuery.data?.pendingJob ?? null;
  const weekStart = menu?.weekStart ?? addDays(weekStartOn(today, profile.schedule.checkInDay), week === "next" ? 7 : 0);
  const history = tab === "history";

  return (
    <Page wide>
      <PageHeader
        title="Meals"
        subtitle={history ? "Last two weeks" : `Week of ${fmtDateShort(weekStart)}`}
        actions={
          menu &&
          !history && (
            <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => setRegenOpen(true)} disabled={!!pending}>
              New plan
            </Button>
          )
        }
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
          {!history && (
            <Segmented
              label="Week"
              value={week}
              onChange={(w) => setView({ week: w })}
              options={[
                { value: "current", label: "This week" },
                { value: "next", label: "Next week" },
              ]}
            />
          )}
          <Segmented
            label="Meals view"
            value={tab}
            onChange={(t) => setView({ tab: t })}
            options={[
              { value: "plan", label: "Plan" },
              { value: "groceries", label: "Groceries" },
              { value: "prep", label: "Prep" },
              { value: "history", label: "History" },
            ]}
          />
        </div>
      </PageHeader>

      <AnimatePresence>
        {pending && menu && !history && (
          <motion.p
            role="status"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={easeOut}
            className="flex items-center gap-2.5 overflow-hidden pb-6 text-sm text-ink-2"
          >
            <WorkingGlyph />
            Your coach is writing a new plan. This one stays until it's ready.
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={history ? "history" : `${week}-${tab}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {history ? (
            <HistoryView />
          ) : menuQuery.isPending ? (
            <MenuSkeleton />
          ) : menuQuery.isError ? (
            <ErrorState error={menuQuery.error} onRetry={() => void menuQuery.refetch()} />
          ) : !menu ? (
            <NoMenu week={week} writing={!!pending} onWrite={() => setRegenOpen(true)} />
          ) : tab === "groceries" ? (
            <GroceriesView menu={menu} />
          ) : tab === "prep" ? (
            <PrepView menu={menu} />
          ) : menu.plan.length > 0 ? (
            <PlanView menu={menu} week={week} />
          ) : (
            <LegacyMenuView menu={menu} />
          )}
        </motion.div>
      </AnimatePresence>

      <RegenerateSheet open={regenOpen} week={week} onClose={() => setRegenOpen(false)} />
    </Page>
  );
}

/** No menu for the selected week: being written, not due yet (next week), or missing. */
function NoMenu({ week, writing, onWrite }: { week: MenuWeek; writing: boolean; onWrite: () => void }) {
  const profile = useProfile();
  if (writing) {
    return (
      <EmptyState icon={ChefHat} title={week === "next" ? "Next week's plan is being written" : "Your plan is on its way"}>
        <span className="inline-flex items-center gap-2.5">
          <WorkingGlyph />
          The coach is planning the meals and the grocery list.
        </span>
      </EmptyState>
    );
  }
  if (week === "next") {
    return (
      <EmptyState
        icon={CalendarClock}
        title={`Ready ${WEEKDAY_LONG[planReadyDay(profile.schedule)]} evening`}
        action={
          <Button size="sm" icon={Sparkles} onClick={onWrite}>
            Plan it now
          </Button>
        }
      >
        Next week's meal plan and grocery list are written the evening before grocery day.
      </EmptyState>
    );
  }
  return (
    <EmptyState
      icon={ChefHat}
      title="No plan this week"
      action={
        <Button variant="primary" icon={RefreshCw} onClick={onWrite}>
          Write a plan
        </Button>
      }
    />
  );
}

/** Prep tips and the coach's note for the week. */
function PrepView({ menu }: { menu: MealMenu }) {
  return (
    <div className="grid max-w-5xl gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-14">
      <Section title="Prep">
        {menu.prepTips.length === 0 ? (
          <p className="text-sm text-ink-3">No prep tips this week.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {menu.prepTips.map((tip, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-ink-2">
                <Lightbulb size={17} className="mt-1 shrink-0 text-ink-3" aria-hidden />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      {(menu.coachNote || menu.source === "fallback") && (
        <Section title="From your coach" className="lg:mt-0">
          {menu.source === "fallback" && (
            <Badge tone="outline" className="mb-2">
              Template plan
            </Badge>
          )}
          {menu.coachNote && <p className="max-w-[68ch] text-[15px] leading-relaxed text-ink-2">{menu.coachNote}</p>}
        </Section>
      )}
    </div>
  );
}

// ---------- Fallback: options per slot, for menus written before day-by-day plans ----------

function LegacyMenuView({ menu }: { menu: MealMenu }) {
  const serverToday = useServerToday();
  const today = useToday(serverToday);
  const profile = useProfile();
  const [dayType, setDayType] = useState<DayType>(
    today.data?.dayType ?? (profile.training.days.includes(weekdayOf(serverToday)) ? "training" : "rest"),
  );
  const [detail, setDetail] = useState<{ option: MealOption; slot: MenuSlot } | null>(null);

  useEffect(() => {
    if (today.data) setDayType(today.data.dayType);
  }, [today.data?.dayType]); // eslint-disable-line react-hooks/exhaustive-deps

  const slots = menu.slots.filter((s) => s.dayType === dayType).sort((a, b) => a.slotIndex - b.slotIndex);

  return (
    <div>
      <Segmented
        label="Day type"
        size="sm"
        value={dayType}
        onChange={setDayType}
        options={[
          { value: "training", label: "Training day", icon: Dumbbell },
          { value: "rest", label: "Rest day", icon: BedDouble },
        ]}
      />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={dayType}
          variants={listVariants}
          initial="initial"
          animate="animate"
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          className="mt-6 grid gap-x-12 gap-y-10 lg:grid-cols-2"
        >
          {slots.length === 0 && <p className="text-sm text-ink-3">No meals planned for this day type.</p>}
          {slots.map((slot) => (
            <motion.section key={`${slot.dayType}-${slot.slotIndex}`} variants={itemVariants} aria-label={slot.label}>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h2 className="text-[17px] font-semibold tracking-tight text-ink">{slot.label}</h2>
                {roleTag(slot.role, slot.label) && <Badge tone="outline">{roleTag(slot.role, slot.label)}</Badge>}
              </div>
              <p className="mt-1 text-[13px] text-ink-3">
                Target <MacroLine macros={slot.targets} />
              </p>
              <SlotOptions slot={slot} onOpen={(option) => setDetail({ option, slot })} />
            </motion.section>
          ))}
        </motion.div>
      </AnimatePresence>

      <OptionSheet
        option={detail?.option ?? null}
        onClose={() => setDetail(null)}
        context={detail ? `${detail.slot.label}, ${detail.slot.dayType === "training" ? "training day" : "rest day"}` : undefined}
      />
    </div>
  );
}

function SlotOptions({ slot, onOpen }: { slot: MenuSlot; onOpen: (o: MealOption) => void }) {
  const groups = [
    { title: "Home", options: slot.options.filter((o) => o.kind === "home") },
    { title: "Grab and go", options: slot.options.filter((o) => o.kind === "out") },
  ].filter((g) => g.options.length > 0);
  return (
    <div className="mt-2">
      {groups.map((g) => (
        <div key={g.title} className="mt-2">
          <h3 className="pt-2 text-[13px] font-medium text-ink-3">{g.title}</h3>
          <div className="divide-y divide-line">
            {g.options.map((o) => (
              <OptionRow key={o.id} option={o} onOpen={() => onOpen(o)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- History ----------

function HistoryView() {
  const history = useMealHistory(14);
  const serverToday = useServerToday();
  if (history.isPending) return <SkeletonList rows={5} rowClassName="h-28" />;
  if (history.isError) return <ErrorState error={history.error} onRetry={() => void history.refetch()} />;
  const days = history.data;
  if (days.length === 0) return <EmptyState icon={Utensils} title="No meals logged yet" />;

  return (
    <motion.ol variants={listVariants} initial="initial" animate="animate" className="grid gap-x-12 lg:grid-cols-2">
      {days.map((d) => {
        const eaten = d.logs.filter((l) => l.status === "eaten");
        const empty = d.logs.length === 0;
        return (
          <motion.li key={d.date} variants={itemVariants} className="border-b border-line py-5">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-2.5">
                <h2 className="text-[15px] font-semibold text-ink">{fmtRelativeDay(d.date, serverToday)}</h2>
                <span className="text-[13px] text-ink-3">{d.dayType === "training" ? "Training" : "Rest"}</span>
              </div>
              <p className="tnum text-[13px] text-ink-3">
                <span className={cn("font-semibold", empty ? "text-ink-3" : "text-ink")}>{fmtKcal(d.consumed.kcal)}</span> / {fmtKcal(d.targets.kcal)} kcal
              </p>
            </div>
            {empty ? (
              <p className="mt-2 text-sm text-ink-3">Nothing logged</p>
            ) : (
              <>
                <MacroBars consumed={d.consumed} targets={d.targets} compact className="mt-3" />
                <ul className="mt-3 flex flex-col gap-1">
                  {d.logs.map((l) => (
                    <li key={l.id} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className={cn("min-w-0 truncate", l.status === "skipped" ? "text-ink-3" : "text-ink-2")}>
                        {l.status === "skipped" ? "Skipped" : l.name}
                      </span>
                      {l.status === "eaten" && <span className="tnum shrink-0 text-[13px] text-ink-3">{fmtKcal(l.macros.kcal)} kcal</span>}
                    </li>
                  ))}
                </ul>
                {eaten.length === 0 && <p className="mt-2 text-sm text-ink-3">All skipped</p>}
              </>
            )}
          </motion.li>
        );
      })}
    </motion.ol>
  );
}

// ---------- Regenerate ----------

function RegenerateSheet({ open, week, onClose }: { open: boolean; week: MenuWeek; onClose: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const start = useStartJob((n: string) => endpoints.regenerateMenu(n || undefined, week));
  useEffect(() => {
    if (open) setNote("");
  }, [open]);
  const which = week === "next" ? "next week" : "this week";
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`New plan for ${which}`}
      description="The coach writes the meals and the grocery list. The current plan stays until the new one is ready."
      footer={
        <Button
          variant="primary"
          size="lg"
          block
          icon={RefreshCw}
          loading={start.isPending}
          onClick={() =>
            start.mutate(note.trim(), {
              onSuccess: () => {
                void qc.invalidateQueries({ queryKey: keys.menuWeek(week) });
                void qc.invalidateQueries({ queryKey: keys.today() });
                toast(`Writing a plan for ${which}`);
                onClose();
              },
            })
          }
        >
          Write new plan
        </Button>
      }
    >
      <Field label="Anything to change?" optional>
        <TextArea data-autofocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="More fish, less cooking on weekdays" rows={3} />
      </Field>
    </Sheet>
  );
}

function MenuSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="h-5 w-2/3 max-w-md" />
      <Skeleton className="mt-6 h-8 w-56 rounded-full" />
      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

import type { DayType, MealMenu, MealOption, MenuResponse } from "@strike/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BedDouble, Check, ChevronRight, Dumbbell, Info, Sparkles, Store } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { WorkingGlyph } from "../../components/CoachStatus.tsx";
import { MacroLine } from "../../components/Macros.tsx";
import { Button, IconButton } from "../../components/ui/Button.tsx";
import { Sheet } from "../../components/ui/Sheet.tsx";
import { Badge } from "../../components/ui/States.tsx";
import { toast } from "../../components/ui/Toast.tsx";
import { cn } from "../../lib/cn.ts";
import { endpoints, type MenuWeek } from "../../lib/endpoints.ts";
import { fmtDate, fmtDateLong } from "../../lib/format.ts";
import { roleTag } from "../../lib/labels.ts";
import { easeOut, itemVariants, listVariants } from "../../lib/motion.ts";
import { keys, useJob, useServerToday, useStartJob } from "../../lib/queries.ts";
import { OptionDetail, OptionMeta } from "./MealOption.tsx";

interface Target {
  date: string;
  dayType: DayType;
  slotIndex: number;
}

const slotOf = (menu: MealMenu, dayType: DayType, slotIndex: number) =>
  menu.slots.find((s) => s.dayType === dayType && s.slotIndex === slotIndex);

/** The week day by day: every meal with the dish it's planned as. Tap a meal to swap its dish. */
export function PlanView({ menu, week }: { menu: MealMenu; week: MenuWeek }) {
  const today = useServerToday();
  const [target, setTarget] = useState<Target | null>(null);
  const [open, setOpen] = useState(false);

  const optionById = useMemo(() => {
    const map = new Map<string, MealOption>();
    for (const slot of menu.slots) for (const o of slot.options) if (!map.has(o.id)) map.set(o.id, o);
    return map;
  }, [menu.slots]);

  return (
    <>
      <motion.div variants={listVariants} initial="initial" animate="animate" className="grid gap-4 lg:grid-cols-2 lg:gap-5">
        {menu.plan.map((day) => (
          <motion.section
            key={day.date}
            variants={itemVariants}
            aria-label={fmtDateLong(day.date)}
            className="rounded-2xl border border-line bg-surface"
          >
            <header className="flex items-center justify-between gap-3 px-4 pb-1 pt-4 sm:px-5">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                {fmtDate(day.date)}
                {day.date === today && <Badge tone="accent">Today</Badge>}
              </h2>
              <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-3">
                {day.dayType === "training" ? <Dumbbell size={14} aria-hidden /> : <BedDouble size={14} aria-hidden />}
                {day.dayType === "training" ? "Training" : "Rest"}
              </span>
            </header>
            <ul className="divide-y divide-line">
              {[...day.meals]
                .sort((a, b) => a.slotIndex - b.slotIndex)
                .map((m) => {
                  const slot = slotOf(menu, day.dayType, m.slotIndex);
                  const option = slot?.options.find((o) => o.id === m.optionId) ?? optionById.get(m.optionId);
                  const role = slot ? roleTag(slot.role, slot.label) : null;
                  return (
                    <li key={m.slotIndex}>
                      <button
                        type="button"
                        onClick={() => {
                          setTarget({ date: day.date, dayType: day.dayType, slotIndex: m.slotIndex });
                          setOpen(true);
                        }}
                        aria-label={`${slot?.label ?? "Meal"}: ${option?.name ?? "not planned"}. Change`}
                        className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-raised/40 sm:px-5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] text-ink-3">
                            {slot?.label ?? `Meal ${m.slotIndex + 1}`}
                            {role && <span>, {role.toLowerCase()}</span>}
                          </p>
                          <p className="mt-0.5 text-[15px] font-medium leading-snug text-ink transition-colors group-hover:text-accent">
                            {option?.name ?? "Not planned"}
                          </p>
                          {option && (
                            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                              <MacroLine macros={option.macros} />
                              {option.kind === "out" && option.place && (
                                <span className="inline-flex items-center gap-1 text-[13px] text-ink-3">
                                  <Store size={12} aria-hidden />
                                  {option.place}
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                        <ChevronRight size={17} className="shrink-0 text-ink-3" aria-hidden />
                      </button>
                    </li>
                  );
                })}
            </ul>
          </motion.section>
        ))}
      </motion.div>
      <PlanMealSheet open={open} onClose={() => setOpen(false)} menu={menu} week={week} target={target} />
    </>
  );
}

interface PlanMealSheetProps {
  open: boolean;
  onClose: () => void;
  menu: MealMenu;
  week: MenuWeek;
  target: Target | null;
}

/** Choose the dish for one meal: home dishes (groceries follow) or grab and go (no groceries). */
function PlanMealSheet({ open, onClose, menu, week, target }: PlanMealSheetProps) {
  const qc = useQueryClient();
  const [detail, setDetail] = useState<MealOption | null>(null);
  const [jobId, setJobId] = useState<number | null>(null);
  const slot = target ? slotOf(menu, target.dayType, target.slotIndex) : undefined;
  const current = target
    ? menu.plan.find((d) => d.date === target.date)?.meals.find((m) => m.slotIndex === target.slotIndex)?.optionId
    : undefined;

  useEffect(() => {
    if (open) {
      setDetail(null);
      setJobId(null);
    }
  }, [open, target?.date, target?.slotIndex]);

  const choose = useMutation({
    mutationFn: (option: MealOption) =>
      endpoints.setPlanMeal(menu.id, { date: target!.date, slotIndex: target!.slotIndex, optionId: option.id }),
    onSuccess: (updated, option) => {
      qc.setQueryData<MenuResponse>(keys.menuWeek(week), (old) => (old ? { ...old, menu: updated } : old));
      void qc.invalidateQueries({ queryKey: keys.menuWeek(week) });
      void qc.invalidateQueries({ queryKey: keys.today() });
      toast(option.kind === "out" ? `Planned ${option.name}. No groceries needed.` : `Planned ${option.name}`);
      onClose();
    },
  });

  const startMore = useStartJob(() => endpoints.moreOptions(target!.date, target!.slotIndex));
  const moreJob = useJob(jobId);
  const finding = jobId != null && (!moreJob.data || moreJob.data.status === "queued" || moreJob.data.status === "running");
  useEffect(() => {
    const j = moreJob.data;
    if (!j || j.id !== jobId) return;
    if (j.status === "succeeded") {
      void qc.invalidateQueries({ queryKey: keys.menu });
      const n = Array.isArray(j.result) ? j.result.length : 0;
      toast(n ? `${n} new ${n === 1 ? "option" : "options"} added` : "New options added");
      setJobId(null);
    } else if (j.status === "failed") {
      toast(j.error ?? "Couldn't find more options", { tone: "error" });
      setJobId(null);
    }
  }, [moreJob.data, jobId, qc]);

  const home = slot?.options.filter((o) => o.kind === "home") ?? [];
  const out = slot?.options.filter((o) => o.kind === "out") ?? [];
  const pendingId = choose.isPending ? choose.variables?.id : undefined;

  const row = (o: MealOption) => {
    const planned = o.id === current;
    return (
      <li key={o.id} className="flex items-stretch gap-1">
        <button
          type="button"
          onClick={() => (planned ? onClose() : choose.mutate(o))}
          disabled={choose.isPending}
          aria-current={planned || undefined}
          aria-label={planned ? `${o.name}, planned` : `Plan ${o.name}`}
          className={cn(
            "flex min-w-0 flex-1 items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors",
            planned ? "bg-accent-soft" : "hover:bg-raised",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
              planned ? "border-accent bg-accent text-accent-ink" : "border-line-strong",
            )}
          >
            {planned && <Check size={12} strokeWidth={3} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className={cn("block text-[15px] font-medium leading-snug", planned ? "text-accent" : "text-ink")}>{o.name}</span>
            {o.kind === "home" && o.summary && <span className="mt-0.5 line-clamp-1 block text-sm text-ink-3">{o.summary}</span>}
            <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <MacroLine macros={o.macros} />
              <OptionMeta option={o} />
            </span>
          </span>
          {pendingId === o.id && <WorkingGlyph className="mt-1.5 shrink-0" />}
        </button>
        <IconButton icon={Info} label={`Details for ${o.name}`} size="sm" onClick={() => setDetail(o)} className="mt-2 shrink-0" />
      </li>
    );
  };

  return (
    <Sheet
      open={open && !!slot}
      onClose={onClose}
      title={detail ? detail.name : (slot?.label ?? "Meal")}
      description={target ? fmtDateLong(target.date) : undefined}
      footer={
        detail ? (
          <div className="flex gap-2">
            <Button icon={ArrowLeft} onClick={() => setDetail(null)}>
              Back
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              icon={Check}
              loading={pendingId === detail.id}
              disabled={detail.id === current}
              onClick={() => choose.mutate(detail)}
            >
              {detail.id === current ? "Planned" : "Plan this"}
            </Button>
          </div>
        ) : (
          <Button
            block
            icon={Sparkles}
            loading={startMore.isPending}
            disabled={finding}
            onClick={() => startMore.mutate(undefined, { onSuccess: (j) => setJobId(j.id) })}
          >
            {finding ? "Finding more options" : "Suggest more"}
          </Button>
        )
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {detail ? (
          <motion.div key="detail" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={easeOut}>
            {detail.kind === "out" && <p className="mb-4 text-sm text-ink-3">No groceries needed.</p>}
            <OptionDetail option={detail} />
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={easeOut}>
            {finding && (
              <p role="status" className="mb-3 flex items-center gap-2.5 text-sm text-ink-2">
                <WorkingGlyph />
                The coach is finding more options for this meal
              </p>
            )}
            {home.length > 0 && (
              <section aria-label="Home">
                <h3 className="mb-1 text-[13px] font-medium text-ink-3">Home</h3>
                <ul className="-mx-3 flex flex-col gap-0.5">{home.map(row)}</ul>
              </section>
            )}
            {out.length > 0 && (
              <section aria-label="Grab and go" className="mt-5">
                <h3 className="mb-1 text-[13px] font-medium text-ink-3">
                  Grab and go<span className="font-normal">, no groceries needed</span>
                </h3>
                <ul className="-mx-3 flex flex-col gap-0.5">{out.map(row)}</ul>
              </section>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  );
}

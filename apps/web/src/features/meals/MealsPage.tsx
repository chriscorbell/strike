import { weekdayOf, type DayType, type MealMenu, type MealOption, type MenuSlot } from "@strike/core";
import { useQueryClient } from "@tanstack/react-query";
import { BedDouble, ChefHat, Dumbbell, Lightbulb, RefreshCw, ShoppingCart, Utensils } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { WorkingGlyph } from "../../components/CoachStatus.tsx";
import { MacroBars, MacroLine } from "../../components/Macros.tsx";
import { Page, PageHeader, Section } from "../../components/Page.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { Checkbox, Field, TextArea } from "../../components/ui/Field.tsx";
import { Segmented } from "../../components/ui/Segmented.tsx";
import { Sheet } from "../../components/ui/Sheet.tsx";
import { Badge, EmptyState, ErrorState, Skeleton, SkeletonList } from "../../components/ui/States.tsx";
import { toast } from "../../components/ui/Toast.tsx";
import { cn } from "../../lib/cn.ts";
import { endpoints } from "../../lib/endpoints.ts";
import { fmtDateShort, fmtKcal, fmtRelativeDay, fmtUsd } from "../../lib/format.ts";
import { roleTag } from "../../lib/labels.ts";
import { easeOut, itemVariants, listVariants } from "../../lib/motion.ts";
import { keys, useMealHistory, useMenu, useProfile, useServerToday, useStartJob, useToday } from "../../lib/queries.ts";
import { OptionRow, OptionSheet } from "./MealOption.tsx";

type Tab = "menu" | "groceries" | "history";

export function MealsPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab | null) ?? "menu";
  const setTab = (t: Tab) => setParams(t === "menu" ? {} : { tab: t }, { replace: true });
  const menuQuery = useMenu();
  const [regenOpen, setRegenOpen] = useState(false);
  const menu = menuQuery.data?.menu ?? null;
  const pending = menuQuery.data?.pendingJob ?? null;

  return (
    <Page wide>
      <PageHeader
        title="Meals"
        subtitle={menu ? `Week of ${fmtDateShort(menu.weekStart)}` : undefined}
        actions={
          menu && (
            <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => setRegenOpen(true)} disabled={!!pending}>
              New menu
            </Button>
          )
        }
      >
        <Segmented
          label="Meals view"
          value={tab}
          onChange={setTab}
          options={[
            { value: "menu", label: "Menu" },
            { value: "groceries", label: "Groceries" },
            { value: "history", label: "History" },
          ]}
        />
      </PageHeader>

      <AnimatePresence>
        {pending && menu && (
          <motion.p
            role="status"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={easeOut}
            className="flex items-center gap-2.5 overflow-hidden pb-6 text-sm text-ink-2"
          >
            <WorkingGlyph />
            Your coach is writing a new menu. This one stays until it's ready.
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {tab === "history" ? (
            <HistoryView />
          ) : menuQuery.isPending ? (
            <MenuSkeleton />
          ) : menuQuery.isError ? (
            <ErrorState error={menuQuery.error} onRetry={() => void menuQuery.refetch()} />
          ) : !menu ? (
            pending ? (
              <EmptyState icon={ChefHat} title="Your menu is on its way">
                <span className="inline-flex items-center gap-2.5">
                  <WorkingGlyph />
                  The coach is planning this week's meals.
                </span>
              </EmptyState>
            ) : (
              <EmptyState
                icon={ChefHat}
                title="No menu this week"
                action={
                  <Button variant="primary" icon={RefreshCw} onClick={() => setRegenOpen(true)}>
                    Write a menu
                  </Button>
                }
              />
            )
          ) : tab === "menu" ? (
            <MenuView menu={menu} />
          ) : (
            <GroceriesView menu={menu} />
          )}
        </motion.div>
      </AnimatePresence>

      <RegenerateSheet open={regenOpen} onClose={() => setRegenOpen(false)} />
    </Page>
  );
}

// ---------- Menu ----------

function MenuView({ menu }: { menu: MealMenu }) {
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
      {(menu.coachNote || menu.source === "fallback") && (
        <div className="mb-8 max-w-[68ch]">
          {menu.source === "fallback" && (
            <Badge tone="outline" className="mb-2">
              Template menu
            </Badge>
          )}
          {menu.coachNote && <p className="text-[15px] leading-relaxed text-ink-2">{menu.coachNote}</p>}
        </div>
      )}

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

// ---------- Groceries ----------

function useCheckedItems(menuId: number) {
  const storageKey = `strike.groceries.${menuId}`;
  const [checked, setChecked] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(storageKey) ?? "[]") as string[]);
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...checked]));
    } catch {
      // Storage unavailable: checks last for this visit only.
    }
  }, [checked, storageKey]);
  const toggle = (item: string, on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(item);
      else next.delete(item);
      return next;
    });
  return { checked, toggle, clear: () => setChecked(new Set()) };
}

function GroceriesView({ menu }: { menu: MealMenu }) {
  const profile = useProfile();
  const { checked, toggle, clear } = useCheckedItems(menu.id);
  const sections = useMemo(() => {
    const map = new Map<string, MealMenu["groceryList"]>();
    for (const g of menu.groceryList) map.set(g.section, [...(map.get(g.section) ?? []), g]);
    return [...map.entries()];
  }, [menu.groceryList]);
  const total = menu.groceryList.reduce((sum, g) => sum + g.costUsd, 0);
  const budget = profile.nutrition.weeklyBudgetUsd;
  const done = menu.groceryList.filter((g) => checked.has(g.item)).length;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-14">
      <div className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-ink-3">Estimated total</p>
            <p className="tnum mt-1 text-[28px] font-semibold leading-none tracking-tight text-ink">{fmtUsd(total)}</p>
            {budget > 0 && (
              <p className="tnum mt-2 text-[13px] text-ink-3">
                {total <= budget ? `${fmtUsd(budget - total)} under` : `${fmtUsd(total - budget)} over`} your {fmtUsd(budget)} budget
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="tnum text-sm text-ink-3">
              {done} of {menu.groceryList.length}
            </span>
            {done > 0 && (
              <Button size="sm" variant="ghost" onClick={clear}>
                Uncheck all
              </Button>
            )}
          </div>
        </div>

        {menu.groceryList.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="No groceries listed" />
        ) : (
          <div className="mt-8 columns-1 gap-10 md:columns-2">
            {sections.map(([section, items]) => (
              <section key={section} className="mb-8 break-inside-avoid">
                <h2 className="mb-1 text-[15px] font-semibold text-ink">{section}</h2>
                <ul className="divide-y divide-line">
                  {items.map((g) => {
                    const on = checked.has(g.item);
                    return (
                      <li key={g.item} className="py-2.5">
                        <Checkbox checked={on} onChange={(v) => toggle(g.item, v)}>
                          <span className="flex items-baseline justify-between gap-3">
                            <span className={cn("min-w-0 text-[15px] transition-colors", on ? "text-ink-3 line-through decoration-ink-3/60" : "text-ink")}>
                              {g.item}
                              <span className="ml-2 text-[13px] text-ink-3">{g.quantity}</span>
                            </span>
                            <span className="tnum shrink-0 text-[13px] text-ink-3">{fmtUsd(g.costUsd)}</span>
                          </span>
                        </Checkbox>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      {menu.prepTips.length > 0 && (
        <Section title="Prep" className="lg:mt-0">
          <ul className="flex flex-col gap-4">
            {menu.prepTips.map((tip, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-ink-2">
                <Lightbulb size={17} className="mt-1 shrink-0 text-ink-3" aria-hidden />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
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

function RegenerateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const start = useStartJob((n: string) => endpoints.regenerateMenu(n || undefined));
  useEffect(() => {
    if (open) setNote("");
  }, [open]);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New menu"
      description="The coach writes a fresh week of meals. Your current menu stays until it's ready."
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
                void qc.invalidateQueries({ queryKey: keys.menu });
                toast("Writing a new menu");
                onClose();
              },
            })
          }
        >
          Write new menu
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

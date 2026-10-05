import type { MealMenu, PrepSession } from "@strike/core";
import { BellRing, Check, ChefHat, ChevronRight, Lightbulb, Microwave, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { WorkingGlyph } from "../../components/CoachStatus.tsx";
import { Section } from "../../components/Page.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { Field, TextArea } from "../../components/ui/Field.tsx";
import { Sheet } from "../../components/ui/Sheet.tsx";
import { Badge, EmptyState } from "../../components/ui/States.tsx";
import { toast } from "../../components/ui/Toast.tsx";
import { cn } from "../../lib/cn.ts";
import { endpoints, type MenuWeek } from "../../lib/endpoints.ts";
import { fmtDate, fmtDateLong, fmtMinutes, fmtTime } from "../../lib/format.ts";
import { easeOut, itemVariants, listVariants } from "../../lib/motion.ts";
import { keys, useServerToday, useStartJob } from "../../lib/queries.ts";
import { cookHref, stepProgress, usePrepChecks } from "./prepState.ts";

/**
 * Write or rewrite a menu's prep guide, from today on. Progress comes from `menu.prepGuidePending`, which the
 * menu query polls; a quick job can finish before the first poll, so the refetch after starting counts as
 * writing too.
 */
function usePrepGuideJob(menu: MealMenu) {
  const qc = useQueryClient();
  const start = useStartJob((note: string | undefined) => endpoints.writePrepGuide(menu.id, note));
  const [refreshing, setRefreshing] = useState(false);
  const [watching, setWatching] = useState(false);
  const ready = !!menu.prepGuide && !menu.prepGuideStale;

  // Any guide job seen running for this menu gets a word when it finishes.
  useEffect(() => {
    if (menu.prepGuidePending) setWatching(true);
  }, [menu.prepGuidePending]);
  useEffect(() => {
    if (!watching || refreshing || menu.prepGuidePending) return;
    setWatching(false);
    toast(ready ? "Prep guide ready" : "Couldn't write the prep guide", { tone: ready ? "default" : "error" });
  }, [watching, refreshing, menu.prepGuidePending, ready]);

  /** `note` tells the coach what changed, e.g. a missed cook day. */
  const write = (note?: string, opts?: { onStarted?: () => void }) =>
    start.mutate(note?.trim() || undefined, {
      onSuccess: () => {
        setRefreshing(true);
        setWatching(true);
        opts?.onStarted?.();
        void qc.invalidateQueries({ queryKey: keys.menu }).finally(() => setRefreshing(false));
      },
    });
  return { write, writing: menu.prepGuidePending || start.isPending || refreshing, starting: start.isPending };
}

/** The Prep tab: the week's cooking sessions, reminders, reheating and food safety. */
export function PrepView({ menu, week }: { menu: MealMenu; week: MenuWeek }) {
  const guide = menu.prepGuide;
  const today = useServerToday();
  const job = usePrepGuideJob(menu);
  const [redoOpen, setRedoOpen] = useState(false);

  const writingNote = (
    <p role="status" className="flex items-center gap-2.5 text-[15px] text-ink-2">
      <WorkingGlyph />
      Writing your prep guide. It shows up here when it's done.
    </p>
  );

  if (!guide) {
    return (
      <div className="grid max-w-5xl gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-14">
        <div className="min-w-0">
          {menu.plan.length > 0 &&
            (job.writing ? (
              <div className="py-8">{writingNote}</div>
            ) : (
              <EmptyState
                icon={ChefHat}
                title="No prep guide yet"
                action={
                  <Button variant="primary" icon={ChefHat} loading={job.starting} onClick={() => job.write()}>
                    Write prep guide
                  </Button>
                }
              >
                A step-by-step guide to cook and pack the week's meals.
              </EmptyState>
            ))}
          {menu.prepTips.length > 0 && (
            <Section title="Prep tips" className={menu.plan.length > 0 ? "mt-6" : undefined}>
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
        <CoachNote menu={menu} />
      </div>
    );
  }

  const reminders = guide.reminders
    .filter((r) => week === "next" || r.date >= today)
    .sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")));

  return (
    <div className="grid max-w-6xl gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="min-w-0">
        {guide.overview && <p className="max-w-[68ch] text-[17px] leading-relaxed text-ink-2">{guide.overview}</p>}

        {menu.prepGuideStale && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={easeOut}
            className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-5 py-4"
          >
            {job.writing ? (
              writingNote
            ) : (
              <>
                <p className="min-w-0 max-w-[52ch] text-[15px] leading-relaxed text-ink-2">
                  You changed the plan after this guide was written, so some amounts may be off.
                </p>
                <Button icon={RefreshCw} loading={job.starting} onClick={() => job.write()}>
                  Update guide
                </Button>
              </>
            )}
          </motion.div>
        )}
        {!menu.prepGuideStale && job.writing && <div className="mt-6">{writingNote}</div>}

        <Section
          title="Cooking sessions"
          className="mt-10"
          action={
            !job.writing && (
              <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setRedoOpen(true)}>
                {week === "current" ? "Redo from today" : "Rewrite"}
              </Button>
            )
          }
        >
          <motion.ul variants={listVariants} initial="initial" animate="animate" className="flex flex-col gap-3">
            {guide.sessions.map((s, i) => (
              <motion.li key={`${s.date}-${i}`} variants={itemVariants}>
                <SessionEntry menuId={menu.id} index={i} session={s} today={today} />
              </motion.li>
            ))}
          </motion.ul>
        </Section>

        {reminders.length > 0 && (
          <Section title="Reminders">
            <ul className="divide-y divide-line">
              {reminders.map((r, i) => (
                <li key={i} className="flex gap-3.5 py-3.5">
                  <BellRing size={18} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
                  <div className="min-w-0">
                    <p className="tnum text-[13px] text-ink-3">
                      {r.date === today ? "Today" : fmtDate(r.date)}
                      {r.time && `, ${fmtTime(r.time)}`}
                    </p>
                    <p className="mt-0.5 text-[15px] leading-relaxed text-ink">{r.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-10">
        {guide.reheating.length > 0 && (
          <Section title="Reheating">
            <ul className="divide-y divide-line">
              {guide.reheating.map((r, i) => (
                <li key={i} className="flex gap-3 py-3">
                  <Microwave size={17} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-ink">{r.dish}</p>
                    <p className="mt-0.5 text-[15px] leading-relaxed text-ink-2">{r.instructions}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}
        {guide.foodSafety.length > 0 && (
          <Section title="Food safety">
            <ul className="flex flex-col gap-3">
              {guide.foodSafety.map((tip, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-ink-2">
                  <ShieldCheck size={17} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
        <CoachNote menu={menu} guideSource={guide.source} />
      </div>

      <RedoSheet open={redoOpen} onClose={() => setRedoOpen(false)} week={week} job={job} />
    </div>
  );
}

/** Rewrite the guide from today, with a note on what changed. */
function RedoSheet({ open, onClose, week, job }: { open: boolean; onClose: () => void; week: MenuWeek; job: ReturnType<typeof usePrepGuideJob> }) {
  const [note, setNote] = useState("");
  useEffect(() => {
    if (open) setNote("");
  }, [open]);
  const submit = () => job.write(note, { onStarted: onClose });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={week === "current" ? "Redo the guide from today" : "Rewrite the guide"}
      description={`The coach rewrites ${week === "current" ? "the rest of the week's" : "the week's"} cooking around what changed. It takes about 8 minutes; this guide stays until then.`}
      footer={
        <Button variant="primary" size="lg" block icon={RotateCcw} loading={job.starting} onClick={submit}>
          Rewrite guide
        </Button>
      }
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="What changed?" optional>
          <TextArea
            data-autofocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Missed Sunday's cook; the chicken is frozen"
          />
        </Field>
      </form>
    </Sheet>
  );
}

function SessionEntry({ menuId, index, session, today }: { menuId: number; index: number; session: PrepSession; today: string }) {
  const { checks } = usePrepChecks(menuId, index);
  const { done, total } = stepProgress(checks, session);
  const complete = total > 0 && done >= total;
  const isToday = session.date === today;
  return (
    <Link
      to={cookHref(menuId, index)}
      className={cn(
        "group flex items-center gap-4 rounded-2xl border bg-surface p-4 transition-colors sm:p-5",
        isToday && !complete ? "border-accent/30 hover:border-accent/50" : "border-line hover:border-line-strong",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[17px] font-semibold tracking-tight text-ink">{session.title}</h3>
          {isToday && <Badge tone="accent">Today</Badge>}
        </div>
        <p className="mt-0.5 text-sm text-ink-3">{fmtDateLong(session.date)}</p>
        <p className="mt-2 text-[15px] leading-snug text-ink-2">{session.covers}</p>
        <p className="tnum mt-1 text-sm text-ink-3">
          {fmtMinutes(session.activeMinutes)} hands-on, {fmtMinutes(session.totalMinutes)} total
        </p>
        {(done > 0 || complete) && (
          <div className="mt-3 flex items-center gap-3">
            <div className="h-1.5 max-w-48 flex-1 overflow-hidden rounded-full bg-accent/15" aria-hidden>
              <div className="h-full rounded-full bg-accent" style={{ width: `${(done / total) * 100}%` }} />
            </div>
            <span className={cn("tnum inline-flex items-center gap-1 text-[13px]", complete ? "text-accent" : "text-ink-3")}>
              {complete && <Check size={13} strokeWidth={3} aria-hidden />}
              {complete ? "Done" : `${done} of ${total} steps`}
            </span>
          </div>
        )}
      </div>
      <ChevronRight size={20} className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

function CoachNote({ menu, guideSource }: { menu: MealMenu; guideSource?: "coach" | "fallback" }) {
  const template = menu.source === "fallback" || guideSource === "fallback";
  if (!menu.coachNote && !template) return null;
  return (
    <Section title="From your coach" className="lg:mt-0">
      {template && (
        <Badge tone="outline" className="mb-2">
          Template plan
        </Badge>
      )}
      {menu.coachNote && <p className="max-w-[68ch] text-[15px] leading-relaxed text-ink-2">{menu.coachNote}</p>}
    </Section>
  );
}

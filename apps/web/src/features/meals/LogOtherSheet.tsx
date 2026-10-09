import type { Macros, RecentMeal } from "@strike/core";
import { Search, Sparkles } from "lucide-react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { useEffect, useState } from "react";
import { WorkingGlyph } from "../../components/CoachStatus.tsx";
import { MacroLine } from "../../components/Macros.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { Field, NumberInput, TextArea, TextInput } from "../../components/ui/Field.tsx";
import { Segmented, type SegmentedOption } from "../../components/ui/Segmented.tsx";
import { Sheet } from "../../components/ui/Sheet.tsx";
import { toast } from "../../components/ui/Toast.tsx";
import { cn } from "../../lib/cn.ts";
import { endpoints } from "../../lib/endpoints.ts";
import { fmtRelativeDay } from "../../lib/format.ts";
import { easeOut } from "../../lib/motion.ts";
import { useJob, useRecentMeals, useServerToday, useStartJob } from "../../lib/queries.ts";
import { useLogMeal } from "./mealMutations.ts";

interface LogOtherSheetProps {
  open: boolean;
  onClose: () => void;
  date: string;
  /** null logs an extra meal outside the plan. */
  slotIndex: number | null;
  slotLabel?: string;
}

type Mode = "recent" | "describe" | "macros";

const ORDER: Record<Mode, number> = { recent: 0, describe: 1, macros: 2 };

/** Past this many recent meals, a search box filters them. */
const SEARCH_FROM = 7;

/** Panels slide in from the side of the tab they come from. */
const panel: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: 8 * dir }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: -8 * dir }),
};

interface Draft {
  name: string;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

const empty: Draft = { name: "", kcal: null, proteinG: null, carbsG: null, fatG: null };

export function LogOtherSheet({ open, onClose, date, slotIndex, slotLabel }: LogOtherSheetProps) {
  const [mode, setMode] = useState<Mode>("describe");
  const [dir, setDir] = useState(1);
  const [search, setSearch] = useState("");
  const [description, setDescription] = useState("");
  const [draft, setDraft] = useState<Draft>(empty);
  const [kcalTouched, setKcalTouched] = useState(false);
  /** Where the macro form's numbers came from, for the note above it. */
  const [filledFrom, setFilledFrom] = useState<"estimate" | "recent" | null>(null);
  const [jobId, setJobId] = useState<number | null>(null);
  const [appliedJobId, setAppliedJobId] = useState<number | null>(null);
  const startEstimate = useStartJob(endpoints.estimateMeal);
  const job = useJob(jobId);
  const logMeal = useLogMeal();
  const recent = useRecentMeals().data ?? [];
  const today = useServerToday();

  const go = (next: Mode) => {
    setDir(ORDER[next] >= ORDER[mode] ? 1 : -1);
    setMode(next);
  };

  // Reset each time the sheet opens, on past meals when there are any.
  useEffect(() => {
    if (open) {
      setMode(recent.length ? "recent" : "describe");
      setSearch("");
      setDescription("");
      setDraft(empty);
      setKcalTouched(false);
      setFilledFrom(null);
      setJobId(null);
    }
  }, [open]);

  const fill = (name: string, macros: Macros, from: "estimate" | "recent") => {
    setDraft({
      name,
      kcal: Math.round(macros.kcal),
      proteinG: Math.round(macros.proteinG),
      carbsG: Math.round(macros.carbsG),
      fatG: Math.round(macros.fatG),
    });
    setKcalTouched(true);
    setFilledFrom(from);
    go("macros");
  };

  // When the estimate lands, move to the macro form with the numbers filled in.
  useEffect(() => {
    const j = job.data;
    if (!j || j.id !== jobId || j.status !== "succeeded" || appliedJobId === jobId) return;
    const result = j.result as { name?: string; macros?: Macros } | null;
    if (result?.macros) {
      setAppliedJobId(jobId);
      fill(result.name ?? description.trim(), result.macros, "estimate");
    }
  }, [job.data, jobId, appliedJobId, description]);

  const modes: SegmentedOption<Mode>[] = [
    ...(recent.length ? [{ value: "recent" as const, label: "Recent" }] : []),
    { value: "describe", label: "Describe it" },
    { value: "macros", label: recent.length ? "Macros" : "Enter macros" },
  ];
  const query = search.trim().toLowerCase();
  const matches = query ? recent.filter((m) => m.name.toLowerCase().includes(query)) : recent;

  const running = jobId != null && (!job.data || job.data.status === "queued" || job.data.status === "running");
  const failed = job.data?.id === jobId && job.data?.status === "failed";

  const setMacro = (key: "proteinG" | "carbsG" | "fatG", v: number | null) => {
    setDraft((d) => {
      const next = { ...d, [key]: v };
      if (!kcalTouched) {
        const p = next.proteinG ?? 0;
        const c = next.carbsG ?? 0;
        const f = next.fatG ?? 0;
        next.kcal = p || c || f ? Math.round(p * 4 + c * 4 + f * 9) : null;
      }
      return next;
    });
  };

  const valid = draft.name.trim().length > 0 && draft.kcal != null && draft.kcal >= 0;

  const submit = () => {
    if (!valid) return;
    logMeal.mutate(
      {
        date,
        slotIndex,
        optionId: null,
        status: "eaten",
        custom: {
          name: draft.name.trim(),
          macros: { kcal: draft.kcal ?? 0, proteinG: draft.proteinG ?? 0, carbsG: draft.carbsG ?? 0, fatG: draft.fatG ?? 0 },
        },
      },
      {
        onSuccess: (log) => {
          toast(`Logged ${log.name}`);
          onClose();
        },
      },
    );
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={slotIndex == null ? "Add a meal" : "Something else"}
      description={slotLabel}
      footer={
        mode === "recent" ? undefined : mode === "describe" ? (
          <Button
            variant="primary"
            block
            size="lg"
            icon={Sparkles}
            loading={startEstimate.isPending || running}
            disabled={description.trim().length < 3}
            onClick={() =>
              startEstimate.mutate(description.trim(), { onSuccess: (j) => setJobId(j.id) })
            }
          >
            {running ? "Estimating" : "Estimate macros"}
          </Button>
        ) : (
          <Button variant="primary" block size="lg" loading={logMeal.isPending} disabled={!valid} onClick={submit}>
            Log it
          </Button>
        )
      }
    >
      <Segmented label="How to log" block value={mode} onChange={go} options={modes} />
      <AnimatePresence mode="wait" initial={false} custom={dir}>
        {mode === "recent" ? (
          <motion.div
            key="recent"
            custom={dir}
            variants={panel}
            initial="enter"
            animate="center"
            exit="exit"
            transition={easeOut}
            // Searching shouldn't shrink the sheet with every keystroke.
            className={cn("mt-4", recent.length >= SEARCH_FROM && "min-h-80")}
          >
            {recent.length >= SEARCH_FROM && (
              <div className="relative mb-1">
                <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" aria-hidden />
                <TextInput
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search past meals"
                  aria-label="Search past meals"
                  className="pl-10"
                />
              </div>
            )}
            {matches.length ? (
              <ul className="divide-y divide-line">
                {matches.map((m) => (
                  <RecentRow key={m.name} meal={m} today={today} onPick={() => fill(m.name, m.macros, "recent")} />
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-ink-3">Nothing matches "{search.trim()}"</p>
            )}
          </motion.div>
        ) : mode === "describe" ? (
          <motion.div
            key="describe"
            custom={dir}
            variants={panel}
            initial="enter"
            animate="center"
            exit="exit"
            transition={easeOut}
            className="mt-5 flex flex-col gap-4"
          >
            <Field label="What did you eat?" hint="Include amounts and where it's from if you know them.">
              <TextArea
                data-autofocus
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Chipotle chicken bowl, double chicken, no rice, with guac"
                rows={4}
              />
            </Field>
            {running && (
              <p role="status" className="flex items-center gap-2.5 text-sm text-ink-2">
                <WorkingGlyph />
                The coach is estimating this meal
              </p>
            )}
            {failed && (
              <p role="alert" className="text-sm text-danger">
                {job.data?.error ?? "The estimate failed."} Enter the macros instead.
              </p>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="macros"
            custom={dir}
            variants={panel}
            initial="enter"
            animate="center"
            exit="exit"
            transition={easeOut}
            className="mt-5 flex flex-col gap-4"
          >
            {filledFrom === "estimate" && <p className="text-sm text-ink-3">Estimated from your description. Adjust anything that looks off.</p>}
            {filledFrom === "recent" && <p className="text-sm text-ink-3">Same as last time. Change anything that's different.</p>}
            <Field label="Name">
              <TextInput value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Turkey sandwich" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Protein">
                <NumberInput value={draft.proteinG} onChange={(v) => setMacro("proteinG", v)} unit="g" decimals={0} />
              </Field>
              <Field label="Carbs">
                <NumberInput value={draft.carbsG} onChange={(v) => setMacro("carbsG", v)} unit="g" decimals={0} />
              </Field>
              <Field label="Fat">
                <NumberInput value={draft.fatG} onChange={(v) => setMacro("fatG", v)} unit="g" decimals={0} />
              </Field>
              <Field label="Calories" hint={kcalTouched ? undefined : "From the macros"}>
                <NumberInput
                  value={draft.kcal}
                  onChange={(v) => {
                    setKcalTouched(v != null);
                    setDraft((d) => ({ ...d, kcal: v }));
                  }}
                  unit="kcal"
                  decimals={0}
                />
              </Field>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  );
}

/** A past meal: tap to fill the macro form with it. */
function RecentRow({ meal, today, onPick }: { meal: RecentMeal; today: string; onPick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className="group flex w-full items-start gap-3 rounded-lg py-3 text-left focus-visible:outline-offset-2 active:opacity-70"
      >
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 block text-[15px] font-medium leading-snug text-ink transition-colors group-hover:text-accent">{meal.name}</span>
          <MacroLine macros={meal.macros} className="mt-1" />
        </span>
        <span className="tnum shrink-0 pt-0.5 text-[13px] text-ink-3">{fmtRelativeDay(meal.lastDate, today)}</span>
      </button>
    </li>
  );
}

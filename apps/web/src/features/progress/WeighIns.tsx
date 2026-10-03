import { round, type WeightPoint } from "@strike/core";
import { useMutation } from "@tanstack/react-query";
import { Pencil, Trash } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Panel } from "../../components/Page.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { Field, NumberInput } from "../../components/ui/Field.tsx";
import { Sheet } from "../../components/ui/Sheet.tsx";
import { SkeletonList } from "../../components/ui/States.tsx";
import { toast, toastError } from "../../components/ui/Toast.tsx";
import { errorMessage } from "../../lib/api.ts";
import { cn } from "../../lib/cn.ts";
import { endpoints } from "../../lib/endpoints.ts";
import { bodyUnit, fmtBodyWeight, fmtDateLong, fmtRelativeDay, fromDisplayWeight, toDisplayWeight } from "../../lib/format.ts";
import { easeOut } from "../../lib/motion.ts";
import { useServerToday, useUnits } from "../../lib/queries.ts";
import { signed } from "./util.ts";
import { useInvalidateWeights } from "./weightData.ts";

const MIN_KG = 30;
const MAX_KG = 300;

/** Validate a display-unit weight. Returns kg or an error message. */
function useWeightCheck() {
  const units = useUnits();
  return (value: number | null): { kg: number } | { error: string } => {
    if (value == null) return { error: "Enter your weight" };
    const kg = fromDisplayWeight(value, units);
    if (kg < MIN_KG || kg > MAX_KG) {
      const lo = Math.ceil(toDisplayWeight(MIN_KG, units));
      const hi = Math.floor(toDisplayWeight(MAX_KG, units));
      return { error: `Enter a weight between ${lo} and ${hi} ${bodyUnit(units)}` };
    }
    return { kg: round(kg, 2) };
  };
}

/** Quick weigh-in: date (today by default) and weight. Re-posting a date replaces it. */
export function LogWeighIn({ points, className }: { points: WeightPoint[] | undefined; className?: string }) {
  const units = useUnits();
  const today = useServerToday();
  const invalidate = useInvalidateWeights();
  const check = useWeightCheck();
  const [date, setDate] = useState(today);
  const existingKg = points?.find((p) => p.date === date)?.weightKg ?? null;
  const [value, setValue] = useState<number | null>(existingKg == null ? null : toDisplayWeight(existingKg, units));
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  // Show what's already logged for the chosen day so saving reads as an update.
  useEffect(() => {
    setValue(existingKg == null ? null : toDisplayWeight(existingKg, units));
    setError(null);
  }, [date, existingKg, units]);

  const save = useMutation({
    mutationFn: (v: { date: string; kg: number }) => endpoints.logWeight(v.date, v.kg),
    onSuccess: (_res, v) => {
      toast(v.date === today ? "Weigh-in saved" : `Weigh-in saved for ${fmtRelativeDay(v.date, today)}`);
      invalidate();
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const r = check(value);
    if ("error" in r) return setError(r.error);
    setError(null);
    save.mutate({ date, kg: r.kg });
  };

  return (
    <Panel as="section" className={cn("p-4 sm:p-5", className)}>
      <form onSubmit={onSubmit} noValidate>
        <div className="flex items-center justify-between gap-3">
          <h3 id={`${id}-title`} className="text-[15px] font-semibold text-ink">
            Log weigh-in
          </h3>
          <label htmlFor={`${id}-date`} className="sr-only">
            Date
          </label>
          <input
            id={`${id}-date`}
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value || today)}
            className="tnum h-9 min-w-0 rounded-xl border border-line-strong bg-raised px-3 text-sm text-ink-2 transition-colors hover:text-ink focus:border-accent/60 focus:outline-none"
          />
        </div>
        <div className="mt-3 flex items-stretch gap-2.5">
          <label htmlFor={`${id}-weight`} className="sr-only">
            Weight
          </label>
          <NumberInput
            id={`${id}-weight`}
            className="min-w-0 flex-1"
            value={value}
            onChange={(v) => {
              setValue(v);
              if (error) setError(null);
            }}
            unit={bodyUnit(units)}
            placeholder="0.0"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
          />
          <Button type="submit" variant="primary" loading={save.isPending} className="min-w-24">
            {existingKg == null ? "Save" : "Update"}
          </Button>
        </div>
        <AnimatePresence initial={false}>
          {error && (
            <motion.p
              id={`${id}-error`}
              role="alert"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={easeOut}
              className="overflow-hidden pt-2 text-[13px] text-danger"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </form>
    </Panel>
  );
}

const PAGE = 10;

/** Recent weigh-ins, newest first. Doubles as the chart's table view. */
export function WeighInList({ points, loading }: { points: WeightPoint[] | undefined; loading: boolean }) {
  const units = useUnits();
  const today = useServerToday();
  const [limit, setLimit] = useState(PAGE);
  const [target, setTarget] = useState<{ date: string; weightKg: number } | null>(null);
  const [open, setOpen] = useState(false);

  if (loading && !points) return <SkeletonList rows={5} rowClassName="h-11" />;
  const entries = (points ?? []).filter((p): p is WeightPoint & { weightKg: number } => p.weightKg != null).reverse();
  if (entries.length === 0) return <p className="py-2 text-sm text-ink-3">Nothing logged in this range.</p>;
  const shown = entries.slice(0, limit);

  return (
    <>
      <ul className="divide-y divide-line" aria-label="Weigh-ins">
        <AnimatePresence initial={false}>
          {shown.map((p, i) => {
            const prev = entries[i + 1];
            const change = prev ? toDisplayWeight(p.weightKg, units) - toDisplayWeight(prev.weightKg, units) : null;
            const day = fmtRelativeDay(p.date, today);
            return (
              <motion.li
                key={p.date}
                layout="position"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={easeOut}
              >
                <button
                  type="button"
                  onClick={() => {
                    setTarget({ date: p.date, weightKg: p.weightKg });
                    setOpen(true);
                  }}
                  aria-label={`Edit weigh-in for ${day}, ${fmtBodyWeight(p.weightKg, units)}`}
                  className="group -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-surface"
                >
                  <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{day}</span>
                  {change != null && Math.abs(change) >= 0.05 && (
                    <span className="tnum text-[13px] text-ink-3">{signed(change, 1)}</span>
                  )}
                  <span className="tnum w-20 text-right text-[15px] font-medium text-ink">{fmtBodyWeight(p.weightKg, units)}</span>
                  <Pencil size={15} className="shrink-0 text-ink-3 transition-colors group-hover:text-ink-2" aria-hidden />
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {entries.length > limit && (
        <Button variant="ghost" size="sm" className="mt-2 -ml-3" onClick={() => setLimit((l) => l + 20)}>
          Show more
        </Button>
      )}
      <EditWeighInSheet key={target?.date ?? "none"} entry={target} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function EditWeighInSheet({ entry, open, onClose }: { entry: { date: string; weightKg: number } | null; open: boolean; onClose: () => void }) {
  const units = useUnits();
  const invalidate = useInvalidateWeights();
  const check = useWeightCheck();
  const [value, setValue] = useState<number | null>(entry ? toDisplayWeight(entry.weightKg, units) : null);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (v: { date: string; kg: number }) => endpoints.logWeight(v.date, v.kg),
    onSuccess: () => {
      toast("Weigh-in updated");
      invalidate();
      onClose();
    },
  });

  const remove = useMutation({
    mutationFn: (date: string) => endpoints.deleteWeight(date),
    onSuccess: (_res, date) => {
      const kg = entry?.weightKg;
      invalidate();
      onClose();
      toast("Weigh-in deleted", {
        duration: 6000,
        action:
          kg == null
            ? undefined
            : {
                label: "Undo",
                onClick: () => {
                  endpoints
                    .logWeight(date, kg)
                    .then(invalidate)
                    .catch((e: unknown) => toastError(errorMessage(e)));
                },
              },
      });
    },
  });

  if (!entry) return <Sheet open={false} onClose={onClose} title="Edit weigh-in">{null}</Sheet>;

  const submit = () => {
    const r = check(value);
    if ("error" in r) return setError(r.error);
    save.mutate({ date: entry.date, kg: r.kg });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Edit weigh-in"
      description={fmtDateLong(entry.date)}
      footer={
        <div className="flex gap-2.5">
          <Button variant="danger" icon={Trash} loading={remove.isPending} disabled={save.isPending} onClick={() => remove.mutate(entry.date)}>
            Delete
          </Button>
          <Button variant="primary" className="flex-1" loading={save.isPending} disabled={remove.isPending} onClick={submit}>
            Save
          </Button>
        </div>
      }
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Weight" error={error}>
          <NumberInput
            value={value}
            onChange={(v) => {
              setValue(v);
              setError(null);
            }}
            unit={bodyUnit(units)}
            data-autofocus
          />
        </Field>
      </form>
    </Sheet>
  );
}

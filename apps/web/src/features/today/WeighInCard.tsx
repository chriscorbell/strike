import type { TodayResponse } from "@strike/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Scale } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState, type FormEvent } from "react";
import { Panel } from "../../components/Page.tsx";
import { Button, IconButton } from "../../components/ui/Button.tsx";
import { NumberInput } from "../../components/ui/Field.tsx";
import { toast } from "../../components/ui/Toast.tsx";
import { endpoints } from "../../lib/endpoints.ts";
import { bodyUnit, fmtBodyWeight, fmtBodyWeightValue, fromDisplayWeight, toDisplayWeight } from "../../lib/format.ts";
import { easeOut } from "../../lib/motion.ts";
import { keys, useUnits } from "../../lib/queries.ts";

export function WeighInCard({ today }: { today: TodayResponse }) {
  const units = useUnits();
  const qc = useQueryClient();
  const logged = today.weight.loggedKg;
  const [editing, setEditing] = useState(false);
  const seed = logged ?? today.weight.trendKg;
  const [value, setValue] = useState<number | null>(seed != null ? toDisplayWeight(seed, units) : null);

  const save = useMutation({
    mutationFn: (kg: number) => endpoints.logWeight(today.date, kg),
    onSuccess: (res) => {
      qc.setQueryData<TodayResponse>(keys.today(today.date), (old) =>
        old ? { ...old, weight: { ...old.weight, loggedKg: res.weightKg } } : old,
      );
      void qc.invalidateQueries({ queryKey: keys.today(today.date) });
      void qc.invalidateQueries({ queryKey: keys.weights() });
      setEditing(false);
      toast(`Weigh-in saved: ${fmtBodyWeight(res.weightKg, units)}`);
    },
  });

  const valid = value != null && value > 0 && fromDisplayWeight(value, units) >= 30 && fromDisplayWeight(value, units) <= 300;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid) save.mutate(fromDisplayWeight(value!, units));
  };

  const showForm = logged == null || editing;

  return (
    <Panel className="p-5">
      <AnimatePresence mode="wait" initial={false}>
        {showForm ? (
          <motion.form
            key="form"
            onSubmit={submit}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={easeOut}
          >
            <label htmlFor="weigh-in" className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <Scale size={17} className="text-ink-3" aria-hidden />
              Morning weigh-in
            </label>
            <div className="mt-3 flex gap-2">
              <NumberInput id="weigh-in" value={value} onChange={setValue} unit={bodyUnit(units)} className="flex-1" />
              <Button type="submit" variant="primary" loading={save.isPending} disabled={!valid}>
                Save
              </Button>
              {editing && (
                <Button variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              )}
            </div>
            {today.weight.trendKg != null && (
              <p className="mt-2 text-[13px] text-ink-3">Trend {fmtBodyWeight(today.weight.trendKg, units)}</p>
            )}
          </motion.form>
        ) : (
          <motion.div
            key="logged"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={easeOut}
            className="flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm text-ink-3">
                <Scale size={15} aria-hidden />
                Weigh-in
              </p>
              <p className="tnum mt-1 text-[22px] font-semibold leading-none tracking-tight text-ink">
                {fmtBodyWeightValue(logged!, units)}
                <span className="ml-1 text-sm font-normal text-ink-3">{bodyUnit(units)}</span>
              </p>
            </div>
            <div className="flex items-center gap-1">
              {today.weight.trendKg != null && (
                <div className="mr-2 text-right">
                  <p className="text-sm text-ink-3">Trend</p>
                  <p className="tnum mt-1 text-[15px] font-medium text-ink-2">{fmtBodyWeight(today.weight.trendKg, units)}</p>
                </div>
              )}
              <IconButton
                icon={Pencil}
                label="Edit weigh-in"
                size="sm"
                onClick={() => {
                  setValue(toDisplayWeight(logged!, units));
                  setEditing(true);
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  );
}

import type { Macros } from "@strike/core";
import { Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { WorkingGlyph } from "../../components/CoachStatus.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { Field, NumberInput, TextArea, TextInput } from "../../components/ui/Field.tsx";
import { Segmented } from "../../components/ui/Segmented.tsx";
import { Sheet } from "../../components/ui/Sheet.tsx";
import { toast } from "../../components/ui/Toast.tsx";
import { endpoints } from "../../lib/endpoints.ts";
import { easeOut } from "../../lib/motion.ts";
import { useJob, useStartJob } from "../../lib/queries.ts";
import { useLogMeal } from "./mealMutations.ts";

interface LogOtherSheetProps {
  open: boolean;
  onClose: () => void;
  date: string;
  /** null logs an extra meal outside the plan. */
  slotIndex: number | null;
  slotLabel?: string;
}

type Mode = "describe" | "macros";

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
  const [description, setDescription] = useState("");
  const [draft, setDraft] = useState<Draft>(empty);
  const [kcalTouched, setKcalTouched] = useState(false);
  const [estimated, setEstimated] = useState(false);
  const [jobId, setJobId] = useState<number | null>(null);
  const startEstimate = useStartJob(endpoints.estimateMeal);
  const job = useJob(jobId);
  const logMeal = useLogMeal();

  // Reset each time the sheet opens.
  useEffect(() => {
    if (open) {
      setMode("describe");
      setDescription("");
      setDraft(empty);
      setKcalTouched(false);
      setEstimated(false);
      setJobId(null);
    }
  }, [open]);

  // When the estimate lands, move to the macro form with the numbers filled in.
  useEffect(() => {
    const j = job.data;
    if (!j || j.id !== jobId || j.status !== "succeeded" || estimated) return;
    const result = j.result as { name?: string; macros?: Macros } | null;
    if (result?.macros) {
      setDraft({
        name: result.name ?? description.trim(),
        kcal: Math.round(result.macros.kcal),
        proteinG: Math.round(result.macros.proteinG),
        carbsG: Math.round(result.macros.carbsG),
        fatG: Math.round(result.macros.fatG),
      });
      setKcalTouched(true);
      setEstimated(true);
      setMode("macros");
    }
  }, [job.data, jobId, estimated, description]);

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
        mode === "describe" ? (
          <Button
            variant="primary"
            block
            size="lg"
            icon={Sparkles}
            loading={startEstimate.isPending || running}
            disabled={description.trim().length < 3}
            onClick={() =>
              startEstimate.mutate(description.trim(), {
                onSuccess: (j) => {
                  setEstimated(false);
                  setJobId(j.id);
                },
              })
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
      <Segmented
        label="How to log"
        block
        value={mode}
        onChange={setMode}
        options={[
          { value: "describe", label: "Describe it" },
          { value: "macros", label: "Enter macros" },
        ]}
      />
      <AnimatePresence mode="wait" initial={false}>
        {mode === "describe" ? (
          <motion.div
            key="describe"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
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
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={easeOut}
            className="mt-5 flex flex-col gap-4"
          >
            {estimated && <p className="text-sm text-ink-3">Estimated from your description. Adjust anything that looks off.</p>}
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

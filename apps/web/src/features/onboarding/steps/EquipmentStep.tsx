import { loadUnit, type DumbbellSet, type EquipmentItem, type Location, type LocationEquipment, type Units } from "@strike/core";
import { ChevronDown, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/Button.tsx";
import { Field, NumberInput, Stepper, Switch, TextArea } from "../../../components/ui/Field.tsx";
import { Segmented } from "../../../components/ui/Segmented.tsx";
import { cn } from "../../../lib/cn.ts";
import { fmtLoad } from "../../../lib/format.ts";
import { EQUIPMENT_LABEL, LOCATION_LABEL } from "../../../lib/labels.ts";
import { easeOut, spring } from "../../../lib/motion.ts";
import { Collapse, LoadInput, Question, ToggleChips } from "../controls.tsx";
import { dumbbellDefaults, range, type Errors } from "../model.ts";
import { LOCATION_OPTIONS } from "../shared.ts";
import type { StepProps } from "./types.ts";

const RACK_ITEMS: EquipmentItem[] = ["bench_flat", "bench_adjustable", "barbell", "smith_machine", "pullup_bar", "dip_station"];
const MACHINE_ITEMS: EquipmentItem[] = [
  "cable",
  "lat_pulldown",
  "seated_row",
  "chest_press_machine",
  "shoulder_press_machine",
  "pec_deck",
  "leg_press",
  "leg_extension",
  "leg_curl",
];
/** Items loaded by a weight stack, which is what machineStep describes. */
const STACK_ITEMS = new Set<EquipmentItem>([
  "cable",
  "lat_pulldown",
  "seated_row",
  "chest_press_machine",
  "shoulder_press_machine",
  "pec_deck",
  "leg_extension",
  "leg_curl",
]);

const toOptions = (items: EquipmentItem[]) => items.map((value) => ({ value, label: EQUIPMENT_LABEL[value] }));
const RACK_OPTIONS = toOptions(RACK_ITEMS);
const MACHINE_OPTIONS = toOptions(MACHINE_ITEMS);

const DUMBBELL_OPTIONS = [
  { value: "none", label: "None" },
  { value: "adjustable", label: "Adjustable" },
  { value: "fixed", label: "Fixed set" },
] as const satisfies readonly { value: DumbbellSet["kind"]; label: string }[];

const LOCATIONS: Location[] = ["home", "gym"];
const hasErrors = (errors: Errors, loc: Location) => Object.keys(errors).some((k) => k.startsWith(`${loc}.`));

export function EquipmentStep({ draft, update, errors, attempt }: StepProps) {
  const [loc, setLoc] = useState<Location>(draft.training.defaultLocation);
  // Dumbbell setups the user switched away from, so flipping the kind back restores them.
  const stash = useRef(new Map<string, { units: Units; set: DumbbellSet }>());

  // After a blocked Continue, show the location that needs attention.
  useEffect(() => {
    if (attempt === 0 || hasErrors(errors, loc)) return;
    const other = LOCATIONS.find((l) => hasErrors(errors, l));
    if (other) setLoc(other);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const setLocation = (l: Location, next: LocationEquipment) =>
    update((d) => ({ ...d, equipment: { ...d.equipment, [l]: next } }));

  const setDumbbellKind = (kind: DumbbellSet["kind"]) => {
    const current = draft.equipment[loc].dumbbells;
    if (current.kind === kind) return;
    stash.current.set(`${loc}:${current.kind}`, { units: draft.units, set: current });
    const saved = stash.current.get(`${loc}:${kind}`);
    const dumbbells = saved && saved.units === draft.units ? saved.set : dumbbellDefaults(draft.units, kind);
    setLocation(loc, { ...draft.equipment[loc], dumbbells });
  };

  const otherLoc = loc === "home" ? "gym" : "home";

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <Segmented label="Location" options={LOCATION_OPTIONS} value={loc} onChange={setLoc} block />
        {hasErrors(errors, otherLoc) && <p className="text-[13px] text-danger">Check {LOCATION_LABEL[otherLoc]} too</p>}
      </div>

      <div className="relative">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={loc}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: easeOut }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
          >
            <LocationEditor
              loc={loc}
              value={draft.equipment[loc]}
              units={draft.units}
              errors={errors}
              onChange={(next) => setLocation(loc, next)}
              onDumbbellKind={setDumbbellKind}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

interface LocationEditorProps {
  loc: Location;
  value: LocationEquipment;
  units: Units;
  errors: Errors;
  onChange: (next: LocationEquipment) => void;
  onDumbbellKind: (kind: DumbbellSet["kind"]) => void;
}

function LocationEditor({ loc, value, units, errors, onChange, onDumbbellKind }: LocationEditorProps) {
  const unit = loadUnit(units);
  const set = (patch: Partial<LocationEquipment>) => onChange({ ...value, ...patch });
  const db = value.dumbbells;
  const availableError = errors[`${loc}.available`];
  const hasStack = value.items.some((i) => STACK_ITEMS.has(i));

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-2" data-invalid={availableError ? "true" : undefined}>
        <Switch
          checked={value.available}
          onChange={(available) => set({ available })}
          label={loc === "home" ? "I can train at home" : "I can train at a gym"}
        />
        {availableError && (
          <p role="alert" className="text-[13px] leading-snug text-danger">
            {availableError}
          </p>
        )}
      </div>

      <Collapse open={value.available} className="flex flex-col gap-7 pb-1 pt-7">
        <Question label="Dumbbells" error={errors[`${loc}.dumbbells`]}>
          {() => (
            <div>
              <Segmented label="Dumbbells" options={DUMBBELL_OPTIONS} value={db.kind} onChange={onDumbbellKind} block />
              <Collapse open={db.kind === "adjustable"} className="pt-4">
                {db.kind === "adjustable" && (
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Lightest">
                      <LoadInput value={db.min} unit={unit} onChange={(min) => set({ dumbbells: { ...db, min } })} />
                    </Field>
                    <Field label="Heaviest">
                      <LoadInput value={db.max} unit={unit} onChange={(max) => set({ dumbbells: { ...db, max } })} />
                    </Field>
                    <Field label="Step">
                      <LoadInput value={db.step} unit={unit} onChange={(step) => set({ dumbbells: { ...db, step } })} />
                    </Field>
                  </div>
                )}
              </Collapse>
              <Collapse open={db.kind === "fixed"} className="pt-4">
                {db.kind === "fixed" && (
                  <FixedWeights
                    weights={db.weights}
                    unit={unit}
                    onChange={(weights) => set({ dumbbells: { kind: "fixed", weights } })}
                  />
                )}
              </Collapse>
            </div>
          )}
        </Question>

        <Question label="Benches and bars">
          {(a) => (
            <ToggleChips {...a} size="sm" options={RACK_OPTIONS} value={value.items} onChange={(items) => set({ items })} />
          )}
        </Question>

        <div>
          <Question label="Machines">
            {(a) => (
              <ToggleChips {...a} size="sm" options={MACHINE_OPTIONS} value={value.items} onChange={(items) => set({ items })} />
            )}
          </Question>

          <Collapse open={hasStack} className="pt-7">
            <Question
              label="Machine weight step"
              hint="The smallest jump on cable and machine stacks"
              error={errors[`${loc}.machineStep`]}
            >
              {() => (
                <Stepper
                  label="Machine weight step"
                  value={value.machineStep}
                  onChange={(machineStep) => set({ machineStep })}
                  step={units === "imperial" ? 2.5 : 0.5}
                  min={units === "imperial" ? 1 : 0.5}
                  max={units === "imperial" ? 50 : 25}
                  unit={unit}
                  decimals={2}
                  className="max-w-[220px]"
                />
              )}
            </Question>
          </Collapse>
        </div>

        <Field label="Notes" optional>
          <TextArea
            rows={2}
            value={value.notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder={loc === "home" ? "No room for a barbell" : "Busy after 6 PM, cable is often taken"}
            className="min-h-16"
          />
        </Field>
      </Collapse>
    </div>
  );
}

interface FixedWeightsProps {
  weights: number[];
  unit: "lb" | "kg";
  onChange: (weights: number[]) => void;
}

const merge = (a: number[], b: number[]) => [...new Set([...a, ...b])].sort((x, y) => x - y);

/** Editable list of fixed dumbbell weights: tap to remove, type to add, or add a whole range. */
function FixedWeights({ weights, unit, onChange }: FixedWeightsProps) {
  const [entry, setEntry] = useState<number | null>(null);
  const [rangeOpen, setRangeOpen] = useState(false);
  const fallbackStep = unit === "lb" ? 5 : 2.5;
  const [from, setFrom] = useState(weights[0] ?? fallbackStep);
  const [to, setTo] = useState(weights[weights.length - 1] ?? fallbackStep * 10);
  const [step, setStep] = useState(fallbackStep);
  const fill = range(from, to, step);
  const fillNew = fill.length <= 100 ? fill.filter((w) => !weights.includes(w)).length : 0;

  const add = () => {
    if (entry == null || !(entry > 0)) return;
    onChange(merge(weights, [Math.round(entry * 100) / 100]));
    setEntry(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="tnum text-[13px] text-ink-3">
          {weights.length === 1 ? "1 pair" : `${weights.length} pairs`}, in {unit}
        </span>
        <Button size="sm" variant="ghost" className="-mr-3" onClick={() => onChange([])} disabled={weights.length === 0}>
          Clear all
        </Button>
      </div>

      {weights.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={`Dumbbell weights in ${unit}`}>
          <AnimatePresence initial={false}>
            {weights.map((w) => (
              <motion.li
                key={w}
                layout
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.12 } }}
                transition={spring}
              >
                <button
                  type="button"
                  onClick={() => onChange(weights.filter((x) => x !== w))}
                  aria-label={`Remove ${fmtLoad(w)} ${unit}`}
                  className="tnum group inline-flex h-8 items-center gap-1 rounded-full bg-raised pl-3 pr-2 text-[13px] font-medium text-ink transition-colors hover:bg-hover"
                >
                  {fmtLoad(w)}
                  <X size={13} className="text-ink-3 transition-colors group-hover:text-ink-2" aria-hidden />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <NumberInput
            aria-label={`Add a weight in ${unit}`}
            placeholder="Add a weight"
            value={entry}
            onChange={setEntry}
            unit={unit}
            decimals={2}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
        </div>
        <Button onClick={add} disabled={entry == null || !(entry > 0)}>
          Add
        </Button>
      </div>

      <div>
        <button
          type="button"
          aria-expanded={rangeOpen}
          onClick={() => setRangeOpen((o) => !o)}
          className="inline-flex items-center gap-1 text-sm font-medium text-ink-3 transition-colors hover:text-ink-2"
        >
          Add a range
          <ChevronDown size={15} className={cn("transition-transform duration-200", rangeOpen && "rotate-180")} aria-hidden />
        </button>
        <Collapse open={rangeOpen} className="pb-1 pt-3">
          <div className="grid grid-cols-3 items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <Field label="From">
              <LoadInput value={from} unit={unit} onChange={setFrom} />
            </Field>
            <Field label="To">
              <LoadInput value={to} unit={unit} onChange={setTo} />
            </Field>
            <Field label="Step">
              <LoadInput value={step} unit={unit} onChange={setStep} />
            </Field>
            <Button
              variant="outline"
              className="col-span-3 sm:col-span-1"
              disabled={fillNew === 0}
              onClick={() => onChange(merge(weights, fill))}
            >
              {fillNew === 0 ? "Add range" : fillNew === 1 ? "Add 1 weight" : `Add ${fillNew} weights`}
            </Button>
          </div>
        </Collapse>
      </div>
    </div>
  );
}

import { navyBodyFat, round, type MeasurementEntry, type Measurements as MeasurementValues } from "@strike/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Ruler, Trash } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Section } from "../../components/Page.tsx";
import { Button, IconButton } from "../../components/ui/Button.tsx";
import { Field, NumberInput, TextInput } from "../../components/ui/Field.tsx";
import { Sheet } from "../../components/ui/Sheet.tsx";
import { EmptyState, ErrorState, SkeletonList } from "../../components/ui/States.tsx";
import { toast } from "../../components/ui/Toast.tsx";
import { endpoints } from "../../lib/endpoints.ts";
import { fmtDateYear, fmtLength, fmtNum, fromDisplayLength, lengthUnit, toDisplayLength } from "../../lib/format.ts";
import { easeOut } from "../../lib/motion.ts";
import { keys, useMeasurements, useProfile, useServerToday, useUnits } from "../../lib/queries.ts";
import { signed } from "./util.ts";

type LengthKey = Exclude<keyof MeasurementValues, "bodyFatPercent">;

const LENGTHS: { key: LengthKey; label: string }[] = [
  { key: "waistCm", label: "Waist" },
  { key: "neckCm", label: "Neck" },
  { key: "hipsCm", label: "Hips" },
  { key: "chestCm", label: "Chest" },
  { key: "armCm", label: "Arm" },
  { key: "thighCm", label: "Thigh" },
];

/** Measurements list (newest first) with an add/edit sheet. One entry per date. */
export function MeasurementsSection({ className }: { className?: string }) {
  const q = useMeasurements();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MeasurementEntry | null>(null);
  const [formKey, setFormKey] = useState(0);
  const openSheet = (entry: MeasurementEntry | null) => {
    setEditing(entry);
    setFormKey((k) => k + 1);
    setOpen(true);
  };

  let body;
  if (q.isPending) body = <SkeletonList rows={2} rowClassName="h-24" />;
  else if (q.isError) body = <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  else if (q.data.length === 0)
    body = (
      <EmptyState
        icon={Ruler}
        title="No measurements yet"
        action={
          <Button size="sm" icon={Plus} onClick={() => openSheet(null)}>
            Add measurements
          </Button>
        }
      >
        Waist and neck are enough for a body fat estimate.
      </EmptyState>
    );
  else body = <MeasurementList entries={q.data} onEdit={openSheet} />;

  return (
    <Section
      title="Measurements"
      className={className}
      action={
        q.data && q.data.length > 0 ? (
          <Button size="sm" variant="ghost" icon={Plus} onClick={() => openSheet(null)}>
            Add
          </Button>
        ) : undefined
      }
    >
      {body}
      <MeasurementsSheet key={formKey} open={open} entry={editing} entries={q.data ?? []} onClose={() => setOpen(false)} />
    </Section>
  );
}

function MeasurementList({ entries, onEdit }: { entries: MeasurementEntry[]; onEdit: (entry: MeasurementEntry) => void }) {
  const units = useUnits();
  const older = (i: number, key: keyof MeasurementValues) => entries.slice(i + 1).find((e) => e[key] != null)?.[key] ?? null;

  return (
    <ul className="divide-y divide-line" aria-label="Measurements">
      <AnimatePresence initial={false}>
        {entries.map((m, i) => {
          const present = LENGTHS.filter((f) => m[f.key] != null);
          const prevFat = older(i, "bodyFatPercent");
          return (
            <motion.li
              key={m.id}
              layout="position"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={easeOut}
              className="py-4 first:pt-1"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[15px] font-medium text-ink">{fmtDateYear(m.date)}</h3>
                <IconButton icon={Pencil} size="sm" label={`Edit measurements for ${fmtDateYear(m.date)}`} onClick={() => onEdit(m)} className="-my-1.5 -mr-2" />
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-x-4 gap-y-3.5 sm:grid-cols-4">
                {m.bodyFatPercent != null && (
                  <Value
                    label="Body fat"
                    value={`${fmtNum(m.bodyFatPercent, 1)}%`}
                    change={prevFat == null ? null : signed(m.bodyFatPercent - prevFat, 1)}
                  />
                )}
                {present.map((f) => {
                  const cur = m[f.key]!;
                  const prev = older(i, f.key);
                  const diff = prev == null ? null : toDisplayLength(cur, units) - toDisplayLength(prev, units);
                  return (
                    <Value
                      key={f.key}
                      label={f.label}
                      value={fmtLength(cur, units)}
                      change={diff == null ? null : signed(diff, 1)}
                    />
                  );
                })}
              </dl>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

function Value({ label, value, change }: { label: string; value: string; change: string | null }) {
  const show = change != null && change !== "0.0";
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="mt-0.5 flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="tnum text-[15px] text-ink">{value}</span>
        {show && (
          <span className="tnum text-xs text-ink-3">
            <span className="sr-only">change since last time </span>
            {change}
          </span>
        )}
      </dd>
    </div>
  );
}

/** True when the stored body fat is the server's Navy estimate rather than a number you entered. */
function isEstimated(entry: MeasurementEntry, sex: "male" | "female", heightCm: number): boolean {
  if (entry.bodyFatPercent == null || entry.waistCm == null || entry.neckCm == null) return false;
  const est = navyBodyFat(sex, heightCm, entry.waistCm, entry.neckCm, entry.hipsCm);
  return est != null && Math.abs(est - entry.bodyFatPercent) < 0.15;
}

const bodyOf = (e: MeasurementEntry): { date: string } & MeasurementValues => ({
  date: e.date,
  waistCm: e.waistCm,
  neckCm: e.neckCm,
  hipsCm: e.hipsCm,
  chestCm: e.chestCm,
  armCm: e.armCm,
  thighCm: e.thighCm,
  bodyFatPercent: e.bodyFatPercent,
});

interface SheetProps {
  open: boolean;
  /** The entry being edited, or null to add one. */
  entry: MeasurementEntry | null;
  entries: MeasurementEntry[];
  onClose: () => void;
}

function MeasurementsSheet({ open, entry, entries, onClose }: SheetProps) {
  const units = useUnits();
  const profile = useProfile();
  const today = useServerToday();
  const qc = useQueryClient();
  const estimated = entry ? isEstimated(entry, profile.sex, profile.heightCm) : false;
  const display = (cm: number | null | undefined) => (cm == null ? null : toDisplayLength(cm, units));
  const [date, setDate] = useState(entry?.date ?? today);
  const [values, setValues] = useState<Record<LengthKey, number | null>>({
    waistCm: display(entry?.waistCm),
    neckCm: display(entry?.neckCm),
    hipsCm: display(entry?.hipsCm),
    chestCm: display(entry?.chestCm),
    armCm: display(entry?.armCm),
    thighCm: display(entry?.thighCm),
  });
  // An estimated body fat stays automatic so it's recalculated from the new tape numbers.
  const [bodyFat, setBodyFat] = useState<number | null>(entry && !estimated ? entry.bodyFatPercent : null);
  const [fatError, setFatError] = useState<string | null>(null);
  const [lengthError, setLengthError] = useState<string | null>(null);
  const replaces = !entry && entries.some((e) => e.date === date);

  const refresh = () => void qc.invalidateQueries({ queryKey: keys.measurements });

  const save = useMutation({
    mutationFn: (body: { date: string } & MeasurementValues) => endpoints.logMeasurements(body),
    onSuccess: () => {
      toast(entry ? "Measurements updated" : "Measurements saved");
      refresh();
      onClose();
    },
  });

  const remove = useMutation({
    mutationFn: (e: MeasurementEntry) => endpoints.deleteMeasurement(e.id),
    onSuccess: (_r, e) => {
      refresh();
      onClose();
      toast(`Deleted ${fmtDateYear(e.date)}`, {
        action: { label: "Undo", onClick: () => void endpoints.logMeasurements(bodyOf(e)).then(refresh) },
      });
    },
  });

  const empty = bodyFat == null && Object.values(values).every((v) => v == null);
  const unit = lengthUnit(units);

  const submit = () => {
    const bad = LENGTHS.find((f) => values[f.key] != null && values[f.key]! <= 0);
    setLengthError(bad ? `${bad.label} should be more than 0` : null);
    const fatBad = bodyFat != null && (bodyFat < 3 || bodyFat > 60);
    setFatError(fatBad ? "Body fat should be between 3 and 60%" : null);
    if (bad || fatBad) return;
    // Unchanged values go back exactly as stored, so a round trip through display units can't drift them.
    const toCm = (key: LengthKey) => {
      const v = values[key];
      if (v == null) return null;
      const stored = entry?.[key];
      if (stored != null && display(stored) === v) return stored;
      return round(fromDisplayLength(v, units), 1);
    };
    save.mutate({
      date,
      waistCm: toCm("waistCm"),
      neckCm: toCm("neckCm"),
      hipsCm: toCm("hipsCm"),
      chestCm: toCm("chestCm"),
      armCm: toCm("armCm"),
      thighCm: toCm("thighCm"),
      bodyFatPercent: bodyFat,
    });
  };

  const navyNeeds = profile.sex === "female" ? "waist, neck and hips" : "waist and neck";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={entry ? "Edit measurements" : "Add measurements"}
      description={entry ? fmtDateYear(entry.date) : "Fill in what you measured."}
      footer={
        <div className="flex gap-2">
          {entry && (
            <Button
              variant="danger"
              icon={Trash}
              aria-label="Delete these measurements"
              title="Delete"
              loading={remove.isPending}
              onClick={() => remove.mutate(entry)}
            />
          )}
          <Button variant="primary" className="flex-1" loading={save.isPending} disabled={empty} onClick={submit}>
            {entry ? "Save changes" : "Save measurements"}
          </Button>
        </div>
      }
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!empty) submit();
        }}
        className="flex flex-col gap-5"
      >
        {!entry && (
          <Field label="Date" hint={replaces ? "Replaces the measurements already saved for this date." : undefined}>
            <TextInput type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          {LENGTHS.map((f) => (
            <Field key={f.key} label={f.label}>
              <NumberInput
                value={values[f.key]}
                onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
                unit={unit}
                placeholder={units === "imperial" ? "0.0" : "0"}
              />
            </Field>
          ))}
        </div>
        {lengthError && (
          <p role="alert" className="-mt-2 text-[13px] text-danger">
            {lengthError}
          </p>
        )}
        <Field
          label="Body fat"
          optional
          hint={
            estimated && bodyFat == null
              ? `Estimated ${fmtNum(entry!.bodyFatPercent!, 1)}% from ${navyNeeds}. Leave empty to recalculate.`
              : `Leave empty and it's estimated from ${navyNeeds} (Navy method).`
          }
          error={fatError}
        >
          <NumberInput
            value={bodyFat}
            onChange={(v) => {
              setBodyFat(v);
              setFatError(null);
            }}
            unit="%"
            placeholder="0.0"
          />
        </Field>
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Sheet>
  );
}

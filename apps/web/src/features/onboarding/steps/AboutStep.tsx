import type { Units } from "@strike/core";
import { Button } from "../../../components/ui/Button.tsx";
import { ChoiceChips } from "../../../components/ui/Chip.tsx";
import { Field, NumberInput, TextInput } from "../../../components/ui/Field.tsx";
import { Segmented } from "../../../components/ui/Segmented.tsx";
import { bodyUnit } from "../../../lib/format.ts";
import { Question } from "../controls.tsx";
import { deviceTimeZone, localToday, type Draft } from "../model.ts";
import { tzLabel } from "../shared.ts";
import type { StepProps } from "./types.ts";

const UNIT_OPTIONS = [
  { value: "imperial", label: "Imperial" },
  { value: "metric", label: "Metric" },
] as const satisfies readonly { value: Units; label: string }[];

const SEX_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const satisfies readonly { value: NonNullable<Draft["sex"]>; label: string }[];

export function AboutStep({ draft, update, errors, mode, setUnits }: StepProps) {
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => update((d) => ({ ...d, [key]: value }));
  const device = deviceTimeZone();
  const today = localToday(draft.timezone);

  return (
    <div className="flex flex-col gap-7">
      <Question label="Units" hint={draft.units === "imperial" ? "Pounds, feet and inches" : "Kilograms and centimeters"}>
        {() => <Segmented label="Units" options={UNIT_OPTIONS} value={draft.units} onChange={setUnits} />}
      </Question>

      <Field label="Name" error={errors.name}>
        <TextInput
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
          autoComplete="given-name"
          autoCapitalize="words"
          enterKeyHint="next"
        />
      </Field>

      <div className="grid gap-7 sm:grid-cols-2 sm:gap-5">
        <Question label="Sex" hint="Used for calorie and body-fat math" error={errors.sex}>
          {() => <ChoiceChips label="Sex" options={SEX_OPTIONS} value={draft.sex} onChange={(v) => set("sex", v)} />}
        </Question>
        <Field label="Birth date" error={errors.birthDate}>
          <TextInput
            type="date"
            value={draft.birthDate}
            min="1920-01-01"
            max={today}
            onChange={(e) => set("birthDate", e.target.value)}
            className="tnum min-h-11 appearance-none text-left"
          />
        </Field>
      </div>

      <div className="grid gap-7 sm:grid-cols-2 sm:gap-5">
        {draft.units === "imperial" ? (
          <Question label="Height" error={errors.height}>
            {({ describedBy, invalid }) => (
              <div className="grid grid-cols-2 gap-2">
                <NumberInput
                  aria-label="Feet"
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  value={draft.heightFt}
                  onChange={(v) => set("heightFt", v)}
                  unit="ft"
                  decimals={0}
                  inputMode="numeric"
                />
                <NumberInput
                  aria-label="Inches"
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  value={draft.heightIn}
                  onChange={(v) => set("heightIn", v)}
                  unit="in"
                  decimals={1}
                />
              </div>
            )}
          </Question>
        ) : (
          <Field label="Height" error={errors.height}>
            <NumberInput value={draft.heightCm} onChange={(v) => set("heightCm", v)} unit="cm" decimals={1} />
          </Field>
        )}

        {mode === "new" && (
          <Field label="Current weight" error={errors.weight}>
            <NumberInput value={draft.weight} onChange={(v) => set("weight", v)} unit={bodyUnit(draft.units)} decimals={1} />
          </Field>
        )}
      </div>

      <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line pt-5">
        <p className="text-sm">
          <span className="text-ink-3">Time zone</span>
          <span className="ml-2 text-ink-2">{tzLabel(draft.timezone)}</span>
        </p>
        {draft.timezone !== device && (
          <Button size="sm" variant="ghost" className="-mr-3" onClick={() => set("timezone", device)}>
            Use {tzLabel(device)}
          </Button>
        )}
      </div>
    </div>
  );
}

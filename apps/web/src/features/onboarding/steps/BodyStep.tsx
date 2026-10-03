import { Field, NumberInput } from "../../../components/ui/Field.tsx";
import { lengthUnit } from "../../../lib/format.ts";
import { TAPE_KEYS, TAPE_LABEL } from "../model.ts";
import type { StepProps } from "./types.ts";

export function BodyStep({ draft, update, errors }: StepProps) {
  const unit = lengthUnit(draft.units);
  return (
    <div className="flex flex-col gap-7">
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
        {TAPE_KEYS.map((k) => (
          <Field key={k} label={TAPE_LABEL[k]} error={errors[`tape.${k}`]}>
            <NumberInput
              value={draft.tape[k]}
              onChange={(v) => update((d) => ({ ...d, tape: { ...d.tape, [k]: v } }))}
              unit={unit}
              decimals={1}
            />
          </Field>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-4 border-t border-line pt-6 sm:grid-cols-3">
        <Field label="Body fat" hint="If you know it from a scan" error={errors.bodyFat} className="col-span-2 sm:col-span-1">
          <NumberInput
            value={draft.bodyFat}
            onChange={(v) => update((d) => ({ ...d, bodyFat: v }))}
            unit="%"
            decimals={1}
            className="max-w-[calc(50%-0.5rem)] sm:max-w-none"
          />
        </Field>
      </div>
    </div>
  );
}

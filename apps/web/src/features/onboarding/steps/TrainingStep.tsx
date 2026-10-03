import { Muscle, type Profile } from "@strike/core";
import { Field, Stepper, TextArea, TextInput } from "../../../components/ui/Field.tsx";
import { Segmented } from "../../../components/ui/Segmented.tsx";
import { EXPERIENCE_LABEL, MUSCLE_LABEL } from "../../../lib/labels.ts";
import { OptionList, Question, ToggleChips, WeekdayMulti } from "../controls.tsx";
import { LOCATION_OPTIONS } from "../shared.ts";
import type { StepProps } from "./types.ts";

const EXPERIENCE_OPTIONS = (Object.keys(EXPERIENCE_LABEL) as Profile["training"]["experience"][]).map((value) => ({
  value,
  ...EXPERIENCE_LABEL[value],
}));

const MUSCLE_OPTIONS = Muscle.options.map((value) => ({ value, label: MUSCLE_LABEL[value] }));

export function TrainingStep({ draft, update, errors }: StepProps) {
  const t = draft.training;
  const setTraining = (patch: Partial<Profile["training"]>) => update((d) => ({ ...d, training: { ...d.training, ...patch } }));
  const dayCount = t.days.length;

  return (
    <div className="flex flex-col gap-7">
      <Question label="Experience">
        {(a) => (
          <OptionList {...a} options={EXPERIENCE_OPTIONS} value={t.experience} onChange={(v) => setTraining({ experience: v })} />
        )}
      </Question>

      <Question
        label="Training days"
        hint={dayCount >= 2 ? `${dayCount} days a week${dayCount === 6 ? ", the most a plan can take" : ""}` : "Pick 2 to 6"}
        error={errors.days}
      >
        {(a) => <WeekdayMulti {...a} value={t.days} onChange={(days) => setTraining({ days })} max={6} />}
      </Question>

      <div className="grid grid-cols-2 gap-4">
        <Question label="Session length" error={errors.sessionMinutes}>
          {() => (
            <Stepper
              label="Session length in minutes"
              value={t.sessionMinutes}
              onChange={(v) => setTraining({ sessionMinutes: Math.round(v) })}
              step={5}
              min={20}
              max={120}
              unit="min"
              decimals={0}
              inputMode="numeric"
            />
          )}
        </Question>
        <Field label="Usual time" error={errors.workoutTime}>
          <TextInput
            type="time"
            value={t.workoutTime}
            onChange={(e) => setTraining({ workoutTime: e.target.value })}
            className="tnum min-h-11 appearance-none text-left"
          />
        </Field>
      </div>

      <Question label="Usually train at">
        {() => (
          <Segmented
            label="Usually train at"
            options={LOCATION_OPTIONS}
            value={t.defaultLocation}
            onChange={(v) => setTraining({ defaultLocation: v })}
          />
        )}
      </Question>

      <Question label="Focus muscles" optional hint="Up to 4. They get priority in your plan." error={errors.focusMuscles}>
        {(a) => (
          <ToggleChips
            {...a}
            size="sm"
            options={MUSCLE_OPTIONS}
            value={t.focusMuscles}
            onChange={(focusMuscles) => setTraining({ focusMuscles })}
            max={4}
          />
        )}
      </Question>

      <Field label="Injuries or limitations" optional>
        <TextArea
          rows={3}
          value={t.limitations}
          onChange={(e) => setTraining({ limitations: e.target.value })}
          placeholder="Left shoulder pinches on overhead presses"
          className="min-h-20"
        />
      </Field>
    </div>
  );
}

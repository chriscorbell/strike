import type { Profile } from "@strike/core";
import { Field, TextInput } from "../../../components/ui/Field.tsx";
import { ACTIVITY_LABEL } from "../../../lib/labels.ts";
import { OptionList, Question, WeekdaySingle } from "../controls.tsx";
import type { StepProps } from "./types.ts";

const ACTIVITY_OPTIONS = (Object.keys(ACTIVITY_LABEL) as Profile["activityLevel"][]).map((value) => ({
  value,
  ...ACTIVITY_LABEL[value],
}));

export function DayStep({ draft, update, errors }: StepProps) {
  const setSchedule = (patch: Partial<Profile["schedule"]>) => update((d) => ({ ...d, schedule: { ...d.schedule, ...patch } }));
  return (
    <div className="flex flex-col gap-7">
      <Question label="Activity outside lifting">
        {(a) => (
          <OptionList
            {...a}
            options={ACTIVITY_OPTIONS}
            value={draft.activityLevel}
            onChange={(v) => update((d) => ({ ...d, activityLevel: v }))}
          />
        )}
      </Question>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Wake up" error={errors.wakeTime}>
          <TextInput
            type="time"
            value={draft.schedule.wakeTime}
            onChange={(e) => setSchedule({ wakeTime: e.target.value })}
            className="tnum min-h-11 appearance-none text-left"
          />
        </Field>
        <Field label="Bedtime" error={errors.sleepTime}>
          <TextInput
            type="time"
            value={draft.schedule.sleepTime}
            onChange={(e) => setSchedule({ sleepTime: e.target.value })}
            className="tnum min-h-11 appearance-none text-left"
          />
        </Field>
      </div>

      <Question label="Weekly check-in" hint="Each plan week starts on this day">
        {(a) => <WeekdaySingle {...a} value={draft.schedule.checkInDay} onChange={(v) => setSchedule({ checkInDay: v })} />}
      </Question>
    </div>
  );
}

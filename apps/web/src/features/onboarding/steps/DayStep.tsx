import type { Profile } from "@strike/core";
import { Field, TextInput } from "../../../components/ui/Field.tsx";
import { ACTIVITY_LABEL, WEEKDAY_LONG } from "../../../lib/labels.ts";
import { planReadyDay, shoppingDayChoices, shoppingDayOf, withShoppingDay, withWeekStart } from "../../../lib/week.ts";
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

      <Question label="Week starts on" hint="Your meal plan, grocery list and weekly check-in follow this week.">
        {(a) => (
          <WeekdaySingle
            {...a}
            value={draft.schedule.checkInDay}
            onChange={(v) => update((d) => ({ ...d, schedule: withWeekStart(d.schedule, v) }))}
          />
        )}
      </Question>

      <Question label="Grocery day" hint={`Next week's plan and grocery list are ready ${WEEKDAY_LONG[planReadyDay(draft.schedule)]} evening.`}>
        {(a) => (
          <WeekdaySingle
            {...a}
            days={shoppingDayChoices(draft.schedule.checkInDay)}
            value={shoppingDayOf(draft.schedule)}
            onChange={(v) => update((d) => ({ ...d, schedule: withShoppingDay(d.schedule, v) }))}
          />
        )}
      </Question>
    </div>
  );
}

import type { Profile } from "@strike/core";
import { useState } from "react";
import { ChoiceChips } from "../../../components/ui/Chip.tsx";
import { Field, NumberInput, Stepper } from "../../../components/ui/Field.tsx";
import { bodyUnit, fmtNum, fromDisplayWeight, toDisplayWeight } from "../../../lib/format.ts";
import { GOAL_LABEL } from "../../../lib/labels.ts";
import { Collapse, OptionList, Question } from "../controls.tsx";
import { DEFAULT_RATE, RATE_PRESETS } from "../model.ts";
import type { StepProps } from "./types.ts";

type GoalType = Profile["goal"]["type"];

const GOAL_OPTIONS: { value: GoalType; label: string; hint: string }[] = [
  { value: "lose", label: GOAL_LABEL.lose, hint: "Eat in a deficit and keep your muscle" },
  { value: "maintain", label: GOAL_LABEL.maintain, hint: "Hold your weight while you get stronger" },
  { value: "gain", label: GOAL_LABEL.gain, hint: "A small surplus for steady gains" },
];

export function GoalStep({ draft, update, errors, currentWeightKg }: StepProps) {
  const { type, rate, targetWeight } = draft.goal;
  const presets = type === "maintain" ? [] : RATE_PRESETS[type];
  const preset = presets.find((p) => p.value === rate);
  const [custom, setCustom] = useState(type !== "maintain" && !preset);
  const unit = bodyUnit(draft.units);

  const setGoal = (patch: Partial<typeof draft.goal>) => update((d) => ({ ...d, goal: { ...d.goal, ...patch } }));

  const setType = (next: GoalType) => {
    if (next === type) return;
    setCustom(false);
    setGoal({ type: next, rate: DEFAULT_RATE[next] });
  };

  const weeklyKg = currentWeightKg != null && rate > 0 ? (currentWeightKg * rate) / 100 : null;
  const weekly = weeklyKg != null ? `About ${fmtNum(toDisplayWeight(weeklyKg, draft.units), 1)} ${unit} a week.` : null;
  const rateHint = [weekly, !custom && preset ? preset.note : null].filter(Boolean).join(" ") || undefined;

  const targetKg = targetWeight != null ? fromDisplayWeight(targetWeight, draft.units) : null;
  const towardTarget =
    targetKg != null && currentWeightKg != null && weeklyKg != null && !errors.targetWeight
      ? type === "lose"
        ? currentWeightKg - targetKg
        : targetKg - currentWeightKg
      : null;
  const weeks = towardTarget != null && towardTarget > 0 ? Math.max(1, Math.round(towardTarget / weeklyKg!)) : null;

  return (
    <div className="flex flex-col gap-7">
      <div>
        <Question label="Goal">{(a) => <OptionList {...a} options={GOAL_OPTIONS} value={type} onChange={setType} />}</Question>

        <Collapse open={type !== "maintain"} className="flex flex-col gap-7 pb-1 pt-7">
          <div>
            <Question label="Rate per week" hint={rateHint} error={errors.rate}>
              {() => (
                <ChoiceChips
                  label="Rate per week"
                  options={[
                    ...presets.map((p) => ({ value: String(p.value), label: `${p.value}%` })),
                    { value: "custom", label: "Custom" },
                  ]}
                  value={custom ? "custom" : preset ? String(preset.value) : null}
                  onChange={(v) => {
                    if (v === "custom") {
                      setCustom(true);
                      return;
                    }
                    setCustom(false);
                    setGoal({ rate: Number(v) });
                  }}
                />
              )}
            </Question>
            <Collapse open={custom} className="pt-3">
              <Stepper
                label="Custom rate, percent of body weight per week"
                value={rate}
                onChange={(v) => setGoal({ rate: v })}
                step={0.05}
                min={0.05}
                max={1.5}
                unit="%"
                decimals={2}
                className="max-w-[220px]"
              />
            </Collapse>
          </div>

          <Field
            label="Target weight"
            optional
            hint={weeks != null ? `About ${weeks} ${weeks === 1 ? "week" : "weeks"} at this rate` : undefined}
            error={errors.targetWeight}
          >
            <NumberInput
              value={targetWeight}
              onChange={(v) => setGoal({ targetWeight: v })}
              unit={unit}
              decimals={1}
              className="max-w-[220px]"
            />
          </Field>
        </Collapse>
      </div>
    </div>
  );
}

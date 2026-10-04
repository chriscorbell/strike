import type { Profile } from "@strike/core";
import { ChoiceChips, TagInput } from "../../../components/ui/Chip.tsx";
import { Field, NumberInput, TextArea, TextInput } from "../../../components/ui/Field.tsx";
import { Segmented } from "../../../components/ui/Segmented.tsx";
import { COOKING_LABEL, DIET_LABEL, KITCHEN_LABEL, type KitchenItem } from "../../../lib/labels.ts";
import { OptionList, Question, ToggleChips } from "../controls.tsx";
import type { Draft } from "../model.ts";
import type { StepProps } from "./types.ts";

type Nutrition = Draft["nutrition"];

const MEAL_OPTIONS = [2, 3, 4, 5, 6].map((value) => ({ value, label: String(value) }));

const DIET_OPTIONS = (Object.keys(DIET_LABEL) as Profile["nutrition"]["dietStyle"][]).map((value) => ({
  value,
  label: DIET_LABEL[value],
}));

const COOKING_OPTIONS = (Object.keys(COOKING_LABEL) as Profile["nutrition"]["cookingTime"][]).map((value) => ({
  value,
  ...COOKING_LABEL[value],
}));

const KITCHEN_OPTIONS = (Object.keys(KITCHEN_LABEL) as KitchenItem[]).map((value) => ({ value, label: KITCHEN_LABEL[value] }));

const ALLERGY_SUGGESTIONS = ["Peanuts", "Tree nuts", "Dairy", "Eggs", "Gluten", "Shellfish", "Fish", "Soy", "Sesame"];

const GRAB_SUGGESTIONS = [
  "Chipotle",
  "Chick-fil-A",
  "Starbucks",
  "Subway",
  "Panera",
  "CAVA",
  "Sweetgreen",
  "Wawa",
  "7-Eleven",
  "Whole Foods hot bar",
];

export function FoodStep({ draft, update, errors }: StepProps) {
  const n = draft.nutrition;
  const setFood = (patch: Partial<Nutrition>) => update((d) => ({ ...d, nutrition: { ...d.nutrition, ...patch } }));

  return (
    <div className="flex flex-col gap-7">
      <Question label="Meals a day">
        {() => (
          <Segmented
            label="Meals a day"
            options={MEAL_OPTIONS}
            value={n.mealsPerDay}
            onChange={(mealsPerDay) => setFood({ mealsPerDay })}
            className="max-w-72"
            block
          />
        )}
      </Question>

      <Question label="Diet">
        {() => (
          <ChoiceChips label="Diet" options={DIET_OPTIONS} value={n.dietStyle} onChange={(dietStyle) => setFood({ dietStyle })} />
        )}
      </Question>

      <Question label="Allergies" optional>
        {() => (
          <TagInput
            label="Allergies"
            placeholder="Add an allergy"
            values={n.allergies}
            onChange={(allergies) => setFood({ allergies })}
            suggestions={ALLERGY_SUGGESTIONS}
          />
        )}
      </Question>

      <Field label="Foods to avoid" optional>
        <TextInput
          value={n.avoidFoods}
          onChange={(e) => setFood({ avoidFoods: e.target.value })}
          placeholder="Mushrooms, olives"
          enterKeyHint="next"
        />
      </Field>

      <Field label="Favorite foods" optional>
        <TextArea
          rows={2}
          value={n.favoriteFoods}
          onChange={(e) => setFood({ favoriteFoods: e.target.value })}
          placeholder="Chicken, rice, Greek yogurt, Mexican food"
          className="min-h-16"
        />
      </Field>

      <Question label="Time for cooking">
        {(a) => (
          <OptionList
            {...a}
            options={COOKING_OPTIONS}
            value={n.cookingTime}
            onChange={(cookingTime) => setFood({ cookingTime })}
          />
        )}
      </Question>

      <Field label="Weekly grocery budget" error={errors.weeklyBudgetUsd}>
        <NumberInput
          value={n.weeklyBudgetUsd}
          onChange={(weeklyBudgetUsd) => setFood({ weeklyBudgetUsd })}
          unit="USD"
          decimals={0}
          className="max-w-[220px]"
        />
      </Field>

      <Question label="Grab-and-go places" optional>
        {() => (
          <TagInput
            label="Grab-and-go places"
            placeholder="Add a place"
            values={n.grabAndGo}
            onChange={(grabAndGo) => setFood({ grabAndGo })}
            suggestions={GRAB_SUGGESTIONS}
          />
        )}
      </Question>

      <Question label="Kitchen">
        {(a) => (
          <ToggleChips
            {...a}
            size="sm"
            options={KITCHEN_OPTIONS}
            value={n.kitchen}
            onChange={(kitchen) => setFood({ kitchen })}
          />
        )}
      </Question>
    </div>
  );
}

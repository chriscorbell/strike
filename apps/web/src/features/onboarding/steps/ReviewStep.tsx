import { LocalDate, ageOn, loadUnit, type DumbbellSet, type LocationEquipment, type Units } from "@strike/core";
import { Pencil } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Button } from "../../../components/ui/Button.tsx";
import {
  bodyUnit,
  fmtDateYear,
  fmtHeight,
  fmtLoad,
  fmtNum,
  fmtTime,
  fmtUsd,
  lengthUnit,
  toDisplayWeight,
} from "../../../lib/format.ts";
import {
  ACTIVITY_LABEL,
  COOKING_LABEL,
  DIET_LABEL,
  EQUIPMENT_LABEL,
  EXPERIENCE_LABEL,
  GOAL_LABEL,
  KITCHEN_LABEL,
  LOCATION_LABEL,
  MUSCLE_LABEL,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
} from "../../../lib/labels.ts";
import { shoppingDayOf } from "../../../lib/week.ts";
import { STEP_LABEL, TAPE_KEYS, TAPE_LABEL, draftHeightCm, localToday, type StepId } from "../model.ts";
import { WEEK_ORDER, tzLabel } from "../shared.ts";
import type { StepProps } from "./types.ts";

const None = ({ children = "None" }: { children?: string }) => <span className="text-ink-3">{children}</span>;

const list = (items: string[], empty = "None") => (items.length ? items.join(", ") : <None>{empty}</None>);

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-3">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </>
  );
}

function Block({ step, onEdit, children }: { step: StepId; onEdit: (step: StepId) => void; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="py-6 first:pt-0 last:pb-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={id} className="text-[17px] font-semibold tracking-tight text-ink">
          {STEP_LABEL[step]}
        </h2>
        <Button
          size="sm"
          variant="ghost"
          icon={Pencil}
          className="-mr-3"
          onClick={() => onEdit(step)}
          aria-label={`Edit ${STEP_LABEL[step]}`}
        >
          Edit
        </Button>
      </div>
      <dl className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-[15px] leading-snug sm:grid-cols-[10rem_minmax(0,1fr)]">
        {children}
      </dl>
    </section>
  );
}

function dumbbellText(d: DumbbellSet, unit: string) {
  if (d.kind === "none") return "None";
  if (d.kind === "adjustable")
    return `Adjustable, ${fmtLoad(d.min)}-${fmtLoad(d.max)} ${unit} in ${fmtLoad(d.step)} ${unit} steps`;
  const ws = d.weights;
  if (ws.length === 0) return "No weights yet";
  if (ws.length === 1) return `1 pair, ${fmtLoad(ws[0]!)} ${unit}`;
  return `${ws.length} pairs, ${fmtLoad(ws[0]!)}-${fmtLoad(ws[ws.length - 1]!)} ${unit}`;
}

function LocationRow({ label, eq, units }: { label: string; eq: LocationEquipment; units: Units }) {
  const unit = loadUnit(units);
  return (
    <Row label={label}>
      {eq.available ? (
        <span className="flex flex-col gap-0.5">
          <span>Dumbbells: {dumbbellText(eq.dumbbells, unit)}</span>
          <span>{eq.items.length ? eq.items.map((i) => EQUIPMENT_LABEL[i]).join(", ") : <None>No other equipment</None>}</span>
          {eq.notes.trim() && <span className="text-ink-2">{eq.notes.trim()}</span>}
        </span>
      ) : (
        <None>Not available</None>
      )}
    </Row>
  );
}

export function ReviewStep({ draft: d, mode, goTo, currentWeightKg }: StepProps) {
  const units = d.units;
  const bw = bodyUnit(units);
  const cm = draftHeightCm(d);
  const birthValid = LocalDate.safeParse(d.birthDate).success;
  const tape = TAPE_KEYS.filter((k) => d.tape[k] != null);
  const t = d.training;
  const n = d.nutrition;
  const weeklyKg = currentWeightKg != null ? (currentWeightKg * d.goal.rate) / 100 : null;

  return (
    <div className="divide-y divide-line">
      <Block step="about" onEdit={goTo}>
        <Row label="Name">{d.name.trim() || <None>Missing</None>}</Row>
        <Row label="Sex">{d.sex === "male" ? "Male" : d.sex === "female" ? "Female" : <None>Missing</None>}</Row>
        <Row label="Born">
          {birthValid ? `${fmtDateYear(d.birthDate)}, age ${ageOn(d.birthDate, localToday(d.timezone))}` : <None>Missing</None>}
        </Row>
        <Row label="Height">{cm != null ? fmtHeight(cm, units) : <None>Missing</None>}</Row>
        {mode === "new" && <Row label="Weight">{d.weight != null ? `${fmtNum(d.weight, 1)} ${bw}` : <None>Missing</None>}</Row>}
        <Row label="Units">{units === "imperial" ? "Imperial" : "Metric"}</Row>
        <Row label="Time zone">{tzLabel(d.timezone)}</Row>
      </Block>

      {mode === "new" && (
        <Block step="body" onEdit={goTo}>
          {tape.length === 0 && d.bodyFat == null ? (
            <Row label="Measurements">
              <None>Skipped</None>
            </Row>
          ) : (
            <>
              {tape.map((k) => (
                <Row key={k} label={TAPE_LABEL[k]}>
                  {fmtNum(d.tape[k]!, 1)} {lengthUnit(units)}
                </Row>
              ))}
              {d.bodyFat != null && <Row label="Body fat">{fmtNum(d.bodyFat, 1)}%</Row>}
            </>
          )}
        </Block>
      )}

      <Block step="goal" onEdit={goTo}>
        <Row label="Goal">{GOAL_LABEL[d.goal.type]}</Row>
        {d.goal.type !== "maintain" && (
          <>
            <Row label="Rate">
              {d.goal.rate}% a week
              {weeklyKg != null && (
                <span className="text-ink-3">
                  , about {fmtNum(toDisplayWeight(weeklyKg, units), 1)} {bw}
                </span>
              )}
            </Row>
            <Row label="Target">{d.goal.targetWeight != null ? `${fmtNum(d.goal.targetWeight, 1)} ${bw}` : <None />}</Row>
          </>
        )}
      </Block>

      <Block step="day" onEdit={goTo}>
        <Row label="Activity">{ACTIVITY_LABEL[d.activityLevel].label}</Row>
        <Row label="Wake up">{fmtTimeSafe(d.schedule.wakeTime)}</Row>
        <Row label="Bedtime">{fmtTimeSafe(d.schedule.sleepTime)}</Row>
        <Row label="Week starts">{WEEKDAY_LONG[d.schedule.checkInDay]}</Row>
        <Row label="Grocery day">{WEEKDAY_LONG[shoppingDayOf(d.schedule)]}</Row>
      </Block>

      <Block step="training" onEdit={goTo}>
        <Row label="Experience">{EXPERIENCE_LABEL[t.experience].label}</Row>
        <Row label="Days">{list(WEEK_ORDER.filter((x) => t.days.includes(x)).map((x) => WEEKDAY_SHORT[x]))}</Row>
        <Row label="Sessions">
          {t.sessionMinutes} min at {fmtTimeSafe(t.workoutTime)}
        </Row>
        <Row label="Usually at">{LOCATION_LABEL[t.defaultLocation]}</Row>
        <Row label="Focus">{list(t.focusMuscles.map((m) => MUSCLE_LABEL[m]))}</Row>
        <Row label="Limitations">{t.limitations.trim() || <None />}</Row>
      </Block>

      <Block step="equipment" onEdit={goTo}>
        <LocationRow label="Home" eq={d.equipment.home} units={units} />
        <LocationRow label="Gym" eq={d.equipment.gym} units={units} />
      </Block>

      <Block step="food" onEdit={goTo}>
        <Row label="Meals">{n.mealsPerDay} a day</Row>
        <Row label="Diet">{DIET_LABEL[n.dietStyle]}</Row>
        <Row label="Allergies">{list(n.allergies)}</Row>
        <Row label="Avoid">{n.avoidFoods.trim() || <None />}</Row>
        <Row label="Favorites">{n.favoriteFoods.trim() || <None />}</Row>
        <Row label="Cooking">{COOKING_LABEL[n.cookingTime].label}</Row>
        <Row label="Budget">{n.weeklyBudgetUsd != null ? `${fmtUsd(n.weeklyBudgetUsd)} a week` : <None>Missing</None>}</Row>
        <Row label="Grab-and-go">{list(n.grabAndGo)}</Row>
        <Row label="Kitchen">{list(n.kitchen.map((k) => KITCHEN_LABEL[k]))}</Row>
      </Block>
    </div>
  );
}

const fmtTimeSafe = (hhmm: string) => (/^\d{2}:\d{2}$/.test(hhmm) ? fmtTime(hhmm) : <None>Missing</None>);

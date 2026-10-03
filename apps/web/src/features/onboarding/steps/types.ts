import type { Units } from "@strike/core";
import type { Draft, Errors, Mode, StepId } from "../model.ts";

export interface StepProps {
  draft: Draft;
  update: (fn: (d: Draft) => Draft) => void;
  /** Inline errors, present once the user tried to continue from this step. */
  errors: Errors;
  mode: Mode;
  /** Increments on every blocked Continue, so a step can react (for example, switch tabs). */
  attempt: number;
  setUnits: (units: Units) => void;
  /** Best known body weight in kg: typed in during onboarding, the trend when editing. */
  currentWeightKg: number | null;
  goTo: (step: StepId) => void;
}

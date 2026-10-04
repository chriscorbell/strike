// Print the exact prompts the coach would send right now for the next training block and next week's
// meal plan, without calling Claude. Point STRIKE_DATA_DIR at a database (or a copy of a backup).
import { addDays, planWeekStart } from "@strike/core";
import { SYSTEM } from "../src/coach/context.ts";
import { menuPrompt, mesoPrompt, planDates } from "../src/coach/tasks.ts";
import { menuSlotsTemplate } from "../src/services/meals.ts";
import { requireProfile, today } from "../src/services/profile.ts";
import { activeMeso } from "../src/services/training.ts";

const profile = requireProfile();
const week = addDays(planWeekStart(profile, today(profile)), 7);
const dates = planDates(profile, week);
console.log(`=== SYSTEM PROMPT (every request) ===\n${SYSTEM}\n`);
console.log(`=== NEXT TRAINING BLOCK ===\n${mesoPrompt(profile, activeMeso(), null)}\n`);
console.log(`=== MEAL PLAN, WEEK OF ${week} ===\n${menuPrompt(profile, week, dates, menuSlotsTemplate(profile, dates[0]!.date), null)}`);

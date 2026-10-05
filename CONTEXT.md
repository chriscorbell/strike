# Strike domain language

| Term | Meaning |
| --- | --- |
| **Profile** | Everything onboarding collects: body, goal, schedule, training days, equipment per location, food preferences. One per server. |
| **Location** | `home` or `gym`. Each has its own equipment and dumbbells; an exercise is available at a location when all its requirements are met there. |
| **Load unit** | lb for imperial profiles, kg for metric. Training loads use it; dumbbell loads are per dumbbell. Body weight is always stored in kg. |
| **Mesocycle (block)** | A training plan of 3-6 hard weeks plus a deload week: one **day** per lifting weekday, each with exercises, sets and rep ranges. Written by the coach, or by the fallback planner. |
| **Session** | One block day in one week, created when it is next. Sessions run in order; a missed one slides to the next lifting day rather than being lost. |
| **RIR** | Reps in reserve: how many more reps were possible. Targets fall from 3 to 0 across a block; 4 on the deload. |
| **e1RM** | Estimated one-rep max from a set: `weight × (1 + (reps + RIR) / 30)`. |
| **Prescription** | The load and reps for each set of a session exercise, decided by the progression engine from the last time that exercise was done. |
| **Form guide** | How to do one library exercise: setup, the rep step by step, common mistakes, and one YouTube technique video. Opened by tapping an exercise on a workout day. |
| **Feedback** | Per muscle per session: soreness, pump, workload, joint pain. It adds or removes sets on the same day next week. |
| **Targets** | Daily calories and macros for training days and rest days, with the maintenance estimate behind them. Versioned by effective date. |
| **Trend weight** | Exponentially smoothed daily weigh-ins (10% per weigh-in). Its 14-day slope is the measured rate of change. |
| **Plan week** | Seven days starting on the profile's week-start day (`schedule.checkInDay`). Menus and check-ins belong to a plan week. |
| **Shopping day** | The day before a plan week starts unless set otherwise (`schedule.shoppingDay`). One grocery trip covers the week. |
| **Prep evening** | 18:00 the evening before shopping day, when the week's check-in runs and the coach writes its meal plan, so the grocery list is ready before the trip. |
| **Check-in** | The weekly review on the prep evening: trend vs goal rate, the calorie adjustment for the coming week, training and meal adherence, and the coach's note. |
| **Menu** | A plan week's meals: for each **slot** of a training day and a rest day, home-cooked and grab-and-go **options** sized to the slot's macro targets, and the **plan**. |
| **Plan** | One option per meal per day, built from a few batch-cooked dishes. Swapping a planned meal changes the grocery list. |
| **Prep guide** | The week's step-by-step meal prep, written from the plan: cooking **sessions** (usually the first day and midweek, since cooked food keeps about four days), each with equipment, ingredients, steps, timers and one labeled **container** per planned meal; plus reminders, reheating and food safety. Followed in **cook mode**. |
| **Grocery list** | The plan's home-cooked ingredients, totaled per **catalog** item (how a store sells it) and rounded to packages; **staples** are listed to check, not buy. |
| **Slot** | One meal in a day's plan, with a time, a role (regular, pre-workout, post-workout, bedtime) and macro targets. |
| **Coach** | Claude, called through the Agent SDK on the Claude subscription. It writes blocks, menus, extra options, meal estimates and check-in notes as background **jobs**. |
| **Fallback** | The rule-based planner and meal generator used when the coach is off or fails, so there is always a plan. |

# Strike HTTP API

The server in `apps/server` serves this API under `/api` and the web app at `/`. Request bodies are validated with the zod schemas in [`packages/core/src/schemas.ts`](../packages/core/src/schemas.ts); response shapes are the types in [`packages/core/src/api.ts`](../packages/core/src/api.ts) and `schemas.ts`. The iOS app mirrors those types in `apps/ios/Strike/Models`. When a shape changes, all three change together.

## Conventions

- JSON in and out, camelCase keys.
- **Auth:** every `/api` route except `/api/health` needs `Authorization: Bearer <token>`, where the token is the server's `STRIKE_TOKEN`. A server started without `STRIKE_TOKEN` (local development) skips the check. A bad or missing token gets `401 {"error": "Unauthorized"}`.
- **Errors:** `4xx`/`5xx` with `{"error": "message", "details"?: ...}`. Validation failures are `400` with zod issues in `details`.
- **Dates** are local calendar days, `"YYYY-MM-DD"`, in the profile's time zone. **Times** are `"HH:MM"`, 24-hour, local. Timestamps (`loggedAt`, `createdAt`...) are ISO-8601 UTC strings.
- **Units:** body weight and measurements are always sent and stored in kg and cm (`weightKg`, `waistCm`...). Clients convert for display using `profile.units`. Training loads (`weight`, `targetWeight`, `startWeight`) are in the load unit, `session.loadUnit`: lb for imperial, kg for metric. Dumbbell loads are per dumbbell.
- **Weekdays:** `0` = Sunday through `6` = Saturday.
- **Weeks** of a block are 0-based (`week: 0` is the first week); `week === hardWeeks` is the deload week. Display `week + 1`.
- **Coach jobs:** work that calls Claude runs in the background. Endpoints that start one return a `Job`; poll `GET /api/jobs/:id` (every 2–3 s is fine) until `status` is `succeeded` or `failed`. `TodayResponse.pendingJobs` lists jobs still running so a client can show that the coach is working.

## Endpoints

### Status and profile

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/api/health` | — | `{ ok: true, version: string, coach: { configured: boolean } }` (no auth) |
| GET | `/api/state` | — | `StateResponse` |
| POST | `/api/onboarding` | `OnboardingRequest` | `StateResponse`. Stores the profile, the first weigh-in and measurements, computes targets, and queues the first mesocycle and meal menu. Calling it again re-onboards (keeps history). |
| PUT | `/api/profile` | `Profile` | `StateResponse`. Targets are recomputed when goal, activity or training settings change. |

### Today

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/api/today?date=` | — | `TodayResponse`. `date` defaults to today in the profile's time zone. |
| PUT | `/api/days/:date/workout-time` | `{ time: "HH:MM" \| null }` | `TodayResponse`. Moves the workout for that day (meal times follow); `null` clears the override. |
| POST | `/api/days/:date/train` | — | `TodayResponse`. Makes the day a training day (the next session is planned for it). |
| POST | `/api/days/:date/rest` | — | `TodayResponse`. Makes the day a rest day; the next session waits for the next training day. |

`TodayResponse.timeline` is sorted by time and mixes meals (`kind: "meal"`) and the workout (`kind: "workout"`). Each meal carries its macro `targets`, its `options` (home-cooked and grab-and-go `MealOption`s, featured one first) and its `log` if one was logged.

### Body weight and measurements

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/api/weights?days=90` | — | `WeightsResponse` (one point per day, `weightKg` null on days without a weigh-in) |
| POST | `/api/weights` | `{ date, weightKg, source: "manual" \| "healthkit" }` | `{ date, weightKg, source }`. One weigh-in per day; a manual entry wins over Apple Health, and an Apple Health entry never replaces a manual one. |
| POST | `/api/weights/batch` | `{ entries: [{ date, weightKg }], source: "healthkit" }` | `{ imported: number }`. For Apple Health sync; send each day's first morning reading. |
| DELETE | `/api/weights/:date` | — | `{ ok: true }` |
| GET | `/api/measurements` | — | `MeasurementEntry[]`, newest first |
| POST | `/api/measurements` | `{ date, ...Measurements }` | `MeasurementEntry`. One entry per date; posting the same date replaces it. Body fat is estimated (Navy method) when waist and neck are given and `bodyFatPercent` is null. |
| DELETE | `/api/measurements/:id` | — | `{ ok: true }` |

### Training

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/api/meso` | — | `MesoOverview` or `null` while the first one is being built. Grid cells are `null` until that session is next (sessions are created one at a time). |
| POST | `/api/meso/regenerate` | `{ note?: string }` | `Job`. Builds a new mesocycle starting with the next session. |
| GET | `/api/sessions?limit=30` | — | `SessionSummary[]`, completed and skipped sessions, newest first |
| GET | `/api/sessions/:id` | — | `Session` |
| POST | `/api/sessions/:id/start` | `{ location?: "home" \| "gym" }` | `Session`. Refreshes prescriptions from the latest history and swaps exercises that the chosen location can't support. |
| POST | `/api/sessions/:id/location` | `{ location }` | `Session`. Same swap without starting. |
| GET | `/api/sessions/:id/exercises/:seId/alternatives` | — | `ExerciseInfo[]` available at the session's location |
| POST | `/api/sessions/:id/exercises/:seId/swap` | `{ exerciseId, permanent: boolean }` | `Session`. `permanent` also changes the mesocycle so future weeks use it. `409` once the exercise has logged sets. |
| POST | `/api/sessions/:id/sets` | `LogSetRequest` | `Session`. Upserts the set at `setIndex`; logging a set past the planned count adds a set. Starts the session if needed. |
| DELETE | `/api/sessions/:id/sets/:setId` | — | `Session`. Deleting a set added during the session (`extra: true`) removes the set itself. |
| PUT | `/api/sessions/:id/feedback` | `MuscleFeedback` | `Session`. Per muscle: soreness (asked at the start), pump and workload (after its last exercise), joint pain. Drives next week's set counts. |
| POST | `/api/sessions/:id/complete` | — | `CompleteSessionResponse` |
| POST | `/api/sessions/:id/skip` | — | `Session` |
| GET | `/api/exercises?logged=1` | — | `ExerciseInfo[]`; with `logged=1`, only exercises that have logged sets |
| GET | `/api/exercises/:id` | — | `ExerciseDetail`: `ExerciseInfo` plus `guide`, how to do it: `setup`, `steps` and `mistakes` (lists of sentences) and a YouTube `video` (`youtubeId`, `title`, `channel`, `seconds`, and `start`, the offset where this exercise's technique begins) |
| GET | `/api/exercises/:id/history` | — | `ExerciseHistoryResponse` |

Set targets in a `Session`: each `SessionSet` has `targetWeight` (null for bodyweight work), `targetReps`, `targetRir`, the `log` once done, and `extra` for sets added during the session. Bodyweight sets may log a `weight` as added load. Log what was actually done: `weight`, `reps`, and `rir` (reps left in reserve; `0` = to failure; null means "about the target"). The progression engine uses those numbers to decide the next session's weight and reps; `SessionExercise.prescriptionNote` explains today's choice in one sentence. `SessionExercise.loadOptions` lists every load available for the exercise at the session's location (step weight controls through it), and `restSeconds` is the suggested rest between sets.

### Meals

Each plan week has a menu: options for every meal slot of a training day and a rest day, and a **plan** that assigns one option (normally a home-cooked, batch-cooked dish) to every meal of every remaining day. The grocery list is totaled from the plan's home-cooked meals and rounded to store packages, so it changes when the plan does. Next week's menu is prepared on the evening before shopping day (18:00 local), together with the weekly check-in.

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/api/menu?week=current\|next` | — | `MenuResponse`: the `menu`, any pending plan job, `prepAt` (when that week's plan is prepared) and `shoppingDate`. `current` (default) is this plan week; `next` is the coming week, whose `menu` is `null` until it's prepared. |
| GET | `/api/menus/:id` | — | `MealMenu`, any week |
| PUT | `/api/menu/:id/plan` | `{ date, slotIndex, optionId }` | `MealMenu`. Plans a different option for one meal; any option on the menu is allowed, and grab-and-go needs no groceries. |
| POST | `/api/menu/:id/prep-guide` | — | `Job`. Writes or rewrites the menu's prep guide (one is also queued after every new plan). |
| POST | `/api/menu/regenerate` | `{ note?, week?: "current" \| "next" }` | `Job` |
| POST | `/api/meals/log` | `MealLogRequest` | `MealLog`. Pick an `optionId`, or send `custom` macros, or `status: "skipped"`. Logging the same slot again replaces it. Logging doesn't change the plan. |
| DELETE | `/api/meals/log/:id` | — | `{ ok: true }` |
| GET | `/api/meals/history?days=14` | — | `MealHistoryDay[]`, newest first |
| POST | `/api/meals/estimate` | `{ description: string }` | `Job`; its `result` is `{ name, macros }` for "what I actually ate" logging |
| POST | `/api/meals/more-options` | `{ date, slotIndex }` | `Job`; its `result` is `MealOption[]`, also added to that week's menu slot (plan one with `PUT /api/menu/:id/plan`) |

`MealMenu.prepGuide` is the week's meal-prep guide, written from the finished plan with each planned meal's exact portion: cooking sessions (equipment, ingredient totals, ordered steps with optional `timerMinutes` and doneness `tip`, one labeled container per meal with fridge or freezer and eat-by date), `reminders` for prep tasks on other days, `reheating` per dish and `foodSafety`. `prepGuideStale` means a meal was swapped after it was written; `prepGuidePending` that one is being written. `TodayResponse.prep` lists the day's sessions and reminders.

`GroceryItem.quantity` is what to buy ("2 x 32 oz tub"), `needed` how much the plan uses ("about 3.2 lb"), and `staple` marks pantry items to check rather than buy. `TodayResponse.upcomingWeek` is set from the prep evening until the week starts, with whether the plan is ready and the grocery count and cost (staples excluded). `TimelineMeal.plannedOptionId` names the planned dish, which is `options[0]`.

### Check-ins and jobs

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/api/checkins` | — | `CheckIn[]`, newest first |
| GET | `/api/checkins/status` | — | `CheckInStatus`: `{ due, latest }` |
| POST | `/api/checkins/run` | `{ note?: string }` | `CheckIn`. Runs the check-in now if it hasn't run: weight trend, calorie adjustment, adherence, then queues the coach's note and the week's meal plan. It runs automatically on the evening before shopping day for the coming week; before that, for the current week. |
| POST | `/api/coach/note` | `{ note: string }` | `{ ok: true }`. A note for the coach ("traveling next week", "left knee is sore") used by the next plan it writes. |
| GET | `/api/jobs?pending=1` | — | `Job[]`: pending jobs, or the 20 most recent without `pending` (failed ones included) |
| GET | `/api/jobs/:id` | — | `Job` |

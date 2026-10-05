# Ask Coach proposes; Chris applies

Status: accepted, 2026-10-05

Plans meet real life: a missed cook day, a workout that has to move, food that's still frozen. Strike's coach only wrote plans in the background, so these situations had no place to go. Chris asked for a chat inside the app that can answer and also change meals, workouts and the rest when needed.

Ask Coach is a conversation with Claude through the Agent SDK, like every other coach request (ADR 0002), but with tools: read-only lookups of the day, the meal plan, groceries, the prep guide, training, sessions, weight and meal logs, and one tool per change the app already supports (swap a meal, log a meal, re-plan a week's meals, rewrite the prep guide, make a day a training or rest day, move a workout, swap an exercise, change a session's location, skip a session, write a new block, save a note).

- **Changes are proposals.** A change tool doesn't change anything. It checks the change by applying it inside a database transaction that is rolled back, so the coach hears about a bad id or a finished session at once, and records it on the reply. Chris taps Apply to make all of a reply's proposals happen together, or none if one no longer fits. A later reply's proposals replace earlier ones he didn't apply. Reading needs no approval.
- **Rules still decide the numbers** (ADR 0001). There is no tool for loads, reps or calorie targets; the coach changes what feeds the rules instead.
- **Chat speed.** Replies run at `medium` effort (`STRIKE_CHAT_EFFORT`), not the `xhigh` of plan writing (Chris's earlier instruction for coach requests): about 5 to 30 seconds per reply on 2026-10-05, against minutes at `xhigh`. Work that needs the slow, careful coach (a meal plan, a prep guide, a block) is proposed as a background job and runs at `xhigh` as before.
- **Outside the job queue.** A reply runs alongside the queue rather than waiting behind a 20-minute meal plan, one reply per conversation at a time. Replies stream to the app as server-sent events, keep running if the app disconnects, and are saved, so a conversation survives closing the app.

Consequences: the coach can act on the plan without a second source of truth for what's allowed, since every proposal goes through the same service functions as the app's own buttons. The cost is a second Claude process at times, still on the subscription and still a trickle for one person.

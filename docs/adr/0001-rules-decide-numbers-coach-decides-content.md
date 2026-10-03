# Rules decide the numbers; the coach decides the content

Status: accepted, 2026-10-03

Strike has to tell Chris exactly what weight to lift, how much to eat and when, every day, and adapt from what he logs. Two jobs hide in that: arithmetic that must be consistent and auditable (load progression, calorie targets, the weekly adjustment, meal timing, set volume from feedback), and judgment that benefits from a model (which exercises fit this equipment and this body, what cheap meals hit these macros, what to say in a check-in).

The arithmetic lives in `packages/core` as plain, tested functions. Claude writes plans and menus, and every coach output passes a validator (`validateMeso`) or is reshaped by the server (slot targets, ids) before it is stored. Claude never sets a weight after the first session or a calorie number.

Consequences: progression and targets behave the same every time and can be tested; a coach outage degrades to the rule-based fallback instead of stopping the app; the coach can be improved through prompts without touching the math.

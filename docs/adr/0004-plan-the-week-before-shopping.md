# Plan the week before the grocery trip

Status: accepted, 2026-10-03

Chris shops once a week. A menu of options per meal didn't tell him what he would cook on a given day, and a menu written on the morning the week started arrived after the trip, so a planned breakfast could need ingredients he didn't have.

Each plan week now has a concrete plan: every meal of every day is assigned one option, built from three to five batch-cooked dishes (Chris's choice over more variety), with grab-and-go options kept as the no-groceries backup. The coach also returns a grocery catalog (how each ingredient is sold, and its price), and every home ingredient names its catalog item and purchased quantity, so the server totals the list deterministically and recomputes it when a planned meal is swapped. Pantry staples are listed to check rather than buy.

The week's check-in and plan are prepared at 18:00 the evening before shopping day (Friday for a Sunday week with Saturday shopping). The calorie adjustment then uses weigh-ins through Friday and takes effect when the week starts, and even a slow `xhigh` generation (about 16 minutes for a menu) finishes before the trip. Onboarding late in a week gets an instant rule-based plan for the remaining days and the coach's plan for the next week.

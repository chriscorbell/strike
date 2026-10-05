# Strike

A self-hosted training and nutrition coach for one person, with a web app and a native iPhone app. Strike is an alternative to RP Hypertrophy and RP Diet Coach.

After onboarding, Strike tells you each day:

- which workout to do and when, with the weight and reps for every set, and how to do each exercise (tap it for a form guide and a technique video)
- what to eat and when, with home-cooked and grab-and-go options for each meal

You log the reps you actually did, and Strike decides whether next time's weight goes up, down or stays the same. Daily weigh-ins feed a smoothed weight trend. A weekly check-in adjusts calories to keep you on pace for your goal. Claude, running on your Claude subscription, writes the training blocks, the weekly menus and the check-in notes.

When plans meet real life ("I missed my cook day", "move today's workout to tomorrow"), ask the coach in the Coach tab. It reads your plan and logs, answers, and proposes changes that happen only when you tap Apply.

## How it works

| Part | Where | What it does |
| --- | --- | --- |
| Core engines | `packages/core` | Rule-based logic shared by every part: schemas, the exercise library and its form guides, the progression engine, calorie targets and weekly adjustments, weight trend, meal timing, set-volume feedback, and the fallback block planner |
| Server | `apps/server` | Hono API, SQLite through Drizzle, a background job queue for Claude work, a scheduler, daily backups. It also serves the web app |
| Web app | `apps/web` | Vite + React |
| iPhone app | `apps/ios` | SwiftUI, with Apple Health sync and meal and workout notifications |

Rules decide the numbers and Claude decides the content ([ADR 0001](docs/adr/0001-rules-decide-numbers-coach-decides-content.md)). If Claude is unavailable, Strike falls back to rule-based plans and menus. The API is documented in [docs/api.md](docs/api.md), and the domain terms are defined in [CONTEXT.md](CONTEXT.md).

## Development

You need Node 24 and pnpm 12.

```sh
pnpm install
pnpm --filter @strike/server dev       # API on :3090, reloads on change
pnpm --filter @strike/web dev          # web app on :5173, proxies /api to :3090
```

The server reads these environment variables (it also loads `apps/server/.env` in dev):

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3090` | HTTP port |
| `STRIKE_TOKEN` | unset | Bearer token required on `/api`. Leave it unset only for local development |
| `STRIKE_COACH` | `claude` | `claude` calls Claude. `mock` returns rule-based results instantly, for development. `off` uses rule-based results only |
| `STRIKE_MODEL` | `claude-opus-5-5` | Model for coach requests |
| `STRIKE_EFFORT` | `xhigh` | Reasoning effort for coach requests |
| `STRIKE_CHAT_EFFORT` | `medium` | Reasoning effort for Ask Coach replies, kept lower so a conversation answers in seconds |
| `CLAUDE_CODE_OAUTH_TOKEN` | unset | Subscription token from `claude setup-token`. A local `claude` login also works on a dev machine |
| `STRIKE_DATA_DIR` | `apps/server/data` | SQLite database and backups |
| `STRIKE_BACKUP_COPY_DIR` | unset | Second location for the daily database snapshot, such as a NAS share |

To load a sample profile with three weeks of history into a fresh dev server, run `STRIKE_COACH=mock pnpm --filter @strike/server dev`, then `pnpm --filter @strike/server seed`.

In mock mode, Ask Coach streams a canned reply, and a message containing "remember" also gets a proposed change, so the chat UI can be exercised without Claude. To try the real coach from the terminal against a copy of a database, run `STRIKE_DATA_DIR=<dir> node apps/server/scripts/ask.ts "question"` (add `--prompt` to print what it would send).

Checks: `pnpm -r typecheck` and `pnpm -r test`.

After changing `apps/server/src/db/schema.ts`, run `pnpm --filter @strike/server db:generate` to write a migration. Migrations run when the server starts.

## Deployment

Every push to `main` triggers CI (`.github/workflows/ci.yml`), which publishes `ghcr.io/chriscorbell/strike:latest`. On minicore, the Compose stack in the fleet repo (`hosts/minicore/stacks/strike`) runs that image with its data in `/home/chris/docker/data/strike`, and Watchtower restarts the container when a new image lands. The app is reached over Tailscale at `http://minicore.tail047de3.ts.net:3090` ([ADR 0003](docs/adr/0003-tailscale-only-single-user.md)). The stack's untracked `.env` holds `STRIKE_TOKEN` and `CLAUDE_CODE_OAUTH_TOKEN`.

## iPhone app

See [apps/ios/README.md](apps/ios/README.md).

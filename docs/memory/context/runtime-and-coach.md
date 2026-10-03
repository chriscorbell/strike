# Server runtime and coach timing

Read when: changing how the server starts or is packaged, the Dockerfile, or coach prompts and timeouts.
Status: verified
Scope: apps/server, Dockerfile
Verified: 2026-10-03
Source: `Dockerfile`, `apps/server/src/coach/`; timings measured on mbp and minicore on 2026-10-03
Recheck when: the Dockerfile layout, Node version, model or effort changes

- The server has no build step: Node 24 runs `src/index.ts` with native type stripping, so server code must stay erasable-only TypeScript (no enums, namespaces or parameter properties; `erasableSyntaxOnly` enforces it). Node refuses to strip types under `node_modules`, so `@strike/core` (TS source) must resolve through the pnpm workspace symlink to `packages/core`. The Dockerfile keeps the workspace layout for that reason; `pnpm deploy` would copy core into `node_modules` and break startup.
- Coach timings at `xhigh` (every request, Chris 2026-10-03): a block about 2 min; a weekly menu about 16 min, and the day-by-day plan with grocery catalog about 17 min (measured 2026-10-03). That is why the plan is prepared the evening before shopping day (ADR 0004) and onboarding saves a rule-based starter plan immediately. Timeouts: 20 min default, 45 min for weekly plans.
- The Agent SDK's bundled Claude Code binary works inside the `node:24-slim` image with `CLAUDE_CODE_OAUTH_TOKEN` (verified on minicore). `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN` are stripped from the child environment so the subscription token is always used.

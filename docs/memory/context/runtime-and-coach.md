# Server runtime and coach timing

Read when: changing how the server starts or is packaged, the Dockerfile, or coach prompts and timeouts.
Status: verified
Scope: apps/server, Dockerfile
Verified: 2026-10-03
Source: `Dockerfile`, `apps/server/src/coach/`; timings measured on mbp and minicore on 2026-10-03
Recheck when: the Dockerfile layout, Node version, model or effort changes

- The server has no build step: Node 24 runs `src/index.ts` with native type stripping, so server code must stay erasable-only TypeScript (no enums, namespaces or parameter properties; `erasableSyntaxOnly` enforces it). Node refuses to strip types under `node_modules`, so `@strike/core` (TS source) must resolve through the pnpm workspace symlink to `packages/core`. The Dockerfile keeps the workspace layout for that reason; `pnpm deploy` would copy core into `node_modules` and break startup.
- Coach timings at medium effort: a block about 50 s, a weekly menu about 4.5 min. Every request now runs at `xhigh` (Chris, 2026-10-03), which is slower, so onboarding saves a rule-based starter menu immediately and the coach's menu replaces it when done. Timeouts: 20 min default, 30 min for menus.
- The Agent SDK's bundled Claude Code binary works inside the `node:24-slim` image with `CLAUDE_CODE_OAUTH_TOKEN` (verified on minicore). `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN` are stripped from the child environment so the subscription token is always used.

# Strike v1 build

Read when: continuing the first build or first deployment of Strike.
Status: active
Branch: main (no remote yet at time of writing)

Objective: Strike v1 — core engines, server, web app, iOS app, CI to GHCR, running on minicore over Tailscale.

Decisions (Chris, 2026-10-03): native SwiftUI iOS app; Tailscale-only access (no public tunnel); Apple Health read weight / write workouts; public GitHub repo `chriscorbell/strike`; reuse kardboard's `CLAUDE_CODE_OAUTH_TOKEN` from minicore's kardboard `.env` for Strike's `.env`; every Claude call uses `claude-opus-5-5` at `xhigh` effort. See `docs/adr/`.

Done: `packages/core` (tests pass), `apps/server` (integration tests pass; real Claude block generation verified locally in 48 s), Dockerfile, CI workflow, fleet stack draft at `~/Code/fleet/hosts/minicore/stacks/strike/compose.yaml` (uncommitted in fleet).

Remaining: web app and iOS app (built by subagents in `apps/web`, `apps/ios`), first push + CI, minicore `.env` (STRIKE_TOKEN generated, Claude token copied), `docker compose up -d`, verify over Tailscale, give Chris the token and iPhone install steps.

Close when: the image runs on minicore and the web app and iOS app work against it.

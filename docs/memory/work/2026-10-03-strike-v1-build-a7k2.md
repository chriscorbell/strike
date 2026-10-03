# Strike v1 build

Read when: continuing the first build or first deployment of Strike.
Status: active
Branch: main, github.com/chriscorbell/strike (public)

Objective: Strike v1 — core engines, server, web app, iOS app, CI to GHCR, running on minicore over Tailscale.

Decisions (Chris, 2026-10-03): native SwiftUI iOS app; Tailscale-only access (no public tunnel); Apple Health read weight / write workouts; public GitHub repo `chriscorbell/strike`; reuse kardboard's `CLAUDE_CODE_OAUTH_TOKEN` from minicore's kardboard `.env` for Strike's `.env`; every Claude call uses `claude-opus-5-5` at `xhigh` effort. See `docs/adr/`.

Done: core, server, web and iOS apps; CI publishes `ghcr.io/chriscorbell/strike`; the fleet stack is on fleet `main` (89a7708) and running on minicore with `.env` (generated STRIKE_TOKEN, Claude token copied from kardboard's `.env`); verified over Tailscale (health, 401 without token, web 200), Claude call inside the container verified, daily backup verified locally and on the NAS.

Remaining: Chris onboards for real (web or iPhone) and installs the iOS app from Xcode (needs his Apple ID in Xcode; see `apps/ios/README.md`). Open question for Chris: the stack commit also landed on fleet branch `refresh-mbp-desired-state` (ba36762, pushed) because the local clone was on that branch; harmless (identical file), removing it needs a force-push back to 2f7253a.

Close when: the image runs on minicore and the web app and iOS app work against it.

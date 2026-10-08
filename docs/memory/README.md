# Workspace memory

Read this index and [the protocol](protocol.md) when starting or resuming a session. Load topic notes only when their retrieval cue matches the task.

| When needed | Read |
| --- | --- |
| Workspace constraints, non-obvious structure, or recurring procedures | [Context](context/README.md) |
| A failure, gotcha, or previously corrected assumption | [Lessons](lessons/README.md) |
| Continuing unfinished work | [Work](work/README.md) |
| Writing or updating a memory note | [Note format](note-format.md) |
| Deciding which document owns a fact, whether a change owes a documentation edit, or repairing `AGENTS.md` | [Document maintenance](documents.md) |
| Finish step 4, a category over its threshold, or a requested memory review | [Bounded review](maintenance.md) |
| Several agents writing memory at once | [Concurrency](concurrency.md) |

## Canonical project documents

- [`README.md`](../../README.md): setup, configuration, deployment
- [`CONTEXT.md`](../../CONTEXT.md): domain vocabulary (block, session, RIR, plan week, slot...)
- [`docs/api.md`](../api.md): the HTTP API contract shared by server, web and iOS
- [`docs/adr/`](../adr/): why rules decide numbers and Claude decides content, subscription auth, Tailscale-only deployment, planning the week before the grocery trip, Ask Coach proposing changes that Chris applies
- [`apps/ios/README.md`](../../apps/ios/README.md): building and installing the iPhone app

## Review record

2026-10-07: ordinary review after moving Strike to HTTPS behind Tailscale Serve. Sampled from the start of `context/`: [runtime and coach](context/runtime-and-coach.md) retained (checked: the Dockerfile still keeps the workspace layout and runs `node src/index.ts`; timings not rechecked, date unchanged); [iOS builds on mbp](context/ios-builds-on-mbp.md) retained and re-dated (checked: still no Simulator runtime, iPhone paired and installable); [pnpm 12 native builds](lessons/pnpm12-native-builds.md) retained and re-dated (checked: `allowBuilds` still lists `better-sqlite3: false`, `esbuild: true`). `work/` has no notes. Next cursor: start of `context/`.

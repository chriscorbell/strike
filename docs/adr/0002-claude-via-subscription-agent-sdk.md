# Claude through the Agent SDK on the Claude subscription

Status: accepted, 2026-10-03

Chris wants the AI to run on his Claude subscription, not pay-per-token API billing. The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) runs Claude Code as a library and authenticates with `CLAUDE_CODE_OAUTH_TOKEN`, the one-year token from `claude setup-token`, which bills against the subscription. Anthropic's restriction on claude.ai login applies to third-party products offered to other people; Strike is a private, single-user tool.

Each coach request is one `query()` with no built-in tools, no filesystem settings and no saved session, returning JSON validated against a zod schema (structured output). The model is `claude-opus-5-5` at `xhigh` effort for every request (Chris's instruction, 2026-10-03), overridable with `STRIKE_MODEL` and `STRIKE_EFFORT`. `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` are removed from the child environment so an API key can never outrank the subscription token.

Requests run one at a time through a persistent job queue, so the subscription's rate limits see a trickle, not a burst. Failures retry once, then fall back to rule-based output (ADR 0001).

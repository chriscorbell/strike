// One structured request to Claude through the Agent SDK, authenticated by the Claude subscription
// (CLAUDE_CODE_OAUTH_TOKEN from `claude setup-token`, or a local `claude` login in development).
// No built-in tools, no filesystem settings, no saved session: a prompt in, validated JSON out.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { env } from "../env.ts";

export const workdir = path.join(os.tmpdir(), "strike-coach");
fs.mkdirSync(workdir, { recursive: true });

/**
 * The SDK replaces the child's environment when `env` is set, so pass ours through. An API key would
 * outrank the subscription token, and only the subscription is meant to be used here.
 */
export function childEnv(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: `strike/${env.version}` };
  delete out.ANTHROPIC_API_KEY;
  delete out.ANTHROPIC_AUTH_TOKEN;
  return out;
}

export interface StructuredRequest<T extends z.ZodType> {
  label: string;
  system: string;
  prompt: string;
  schema: T;
  timeoutMs?: number;
}

export class CoachError extends Error {}

export async function askClaude<T extends z.ZodType>(req: StructuredRequest<T>): Promise<z.infer<T>> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), req.timeoutMs ?? 20 * 60_000);
  const started = Date.now();
  try {
    let result: unknown;
    let failure: string | null = null;
    for await (const message of query({
      prompt: req.prompt,
      options: {
        model: env.model,
        systemPrompt: req.system,
        tools: [],
        settingSources: [],
        persistSession: false,
        maxTurns: 4,
        effort: env.effort,
        outputFormat: { type: "json_schema", schema: z.toJSONSchema(req.schema, { target: "draft-7" }) as Record<string, unknown> },
        cwd: workdir,
        env: childEnv(),
        abortController: abort,
      },
    })) {
      if (message.type === "result") {
        if (message.subtype === "success" && message.structured_output != null) result = message.structured_output;
        else failure = message.subtype === "success" ? "The coach finished without a structured answer." : `The coach stopped: ${message.subtype}.`;
      }
    }
    if (result == null) throw new CoachError(failure ?? "The coach returned nothing.");
    const parsed = req.schema.safeParse(result);
    if (!parsed.success) throw new CoachError(`The coach's answer didn't match the expected shape: ${parsed.error.message.slice(0, 500)}`);
    console.log(`[coach] ${req.label} answered in ${Math.round((Date.now() - started) / 1000)}s`);
    return parsed.data;
  } catch (err) {
    if (abort.signal.aborted) throw new CoachError(`The coach timed out on ${req.label}.`);
    throw err instanceof CoachError ? err : new CoachError(err instanceof Error ? err.message : String(err));
  } finally {
    clearTimeout(timer);
  }
}

export const coachEnabled = () => env.coach === "claude";

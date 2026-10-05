// Ask Coach: a conversation with the coach that can read Strike's data through tools and propose
// changes. A reply runs on its own once started, so it finishes and is saved even if the app that asked
// goes away; clients follow it as a stream of events.
import { createSdkMcpServer, query, tool } from "@anthropic-ai/claude-agent-sdk";
import type { SSEStreamingApi } from "hono/streaming";
import { z } from "zod";
import { CoachActionKind, formatTime, LocalDate, minutesNowIn, type CoachMessageRequest, type CoachStreamEvent } from "@strike/core";
import { env } from "../env.ts";
import { HttpError } from "../http.ts";
import { createThread, insertMessage, messagesOf, recentMessages, threadRow, toMessage, toThreadSummary, touchThread, updateMessage } from "../services/coach-chat.ts";
import { requireProfile, today } from "../services/profile.ts";
import { ACTIONS, clockLabel, dayLabel, propose } from "./actions.ts";
import { childEnv, coachEnabled, workdir } from "./claude.ts";
import { personContext, SYSTEM } from "./context.ts";
import { bodyText, dayText, exerciseOptionsText, groceriesText, mealLogText, mealOptionText, mealPlanText, momentLabel, prepGuideText, sessionText, trainingText, weekOverviewText } from "./lookups.ts";

const HOW_STRIKE_WORKS = `## How Strike works
- Training runs in blocks: 3 to 6 hard weeks, then a deload week. Each lifting day of the week has one session; sessions run in order, so a missed one waits for the next lifting day instead of being lost. Skipping one drops it.
- Loads and reps are set by rules, never by you: when a session comes up, each exercise's prescription comes from the last time it was done. Logged weight, reps and reps in reserve give an estimated max; beating last time's target moves the load or reps up, falling short brings them down, and big dumbbell jumps become extra reps first. Target reps in reserve fall from 3 to 0 across the block; the deload is lighter (about 85%) with about half the sets.
- Per-muscle feedback after a session (soreness, pump, workload, joint pain) adds or removes sets on the same day next week.
- Calories and macros are set by rules too. There are targets for training days and rest days. The weekly check-in runs at 18:00 the evening before shopping day: it compares the 14-day weight trend with the goal rate and closes half the gap, at most 250 kcal a day per week, through carbs and then fat, with protein held. It holds steady until there are two weeks of weigh-ins and at least four in the last seven days. Changing the goal or activity in settings recalculates targets.
- Meals: each plan week has a menu with home-cooked and grab-and-go options for every meal, and a plan assigning one home-cooked dish (from a few batch-cooked dishes) to each meal of each day. The plan is written on the check-in evening, so one grocery trip on shopping day covers the week. The grocery list is totaled from the plan, so swapping a planned meal changes it. Grab-and-go options need no groceries.
- The prep guide turns the plan into cooking sessions (usually the first day and midweek, since cooked food keeps about four days in the fridge; anything later goes in the freezer), with containers labeled by meal, thaw reminders and reheating.`;

const CHAT_SYSTEM = `${SYSTEM}

You're answering in Strike's Ask Coach chat: Chris asks a question or says what happened, and you help, using tools to look things up and to propose changes to his plan.

How to answer:
- Lead with the answer or the recommendation. Plain words, like a coach texting: short paragraphs, hyphen bullets only for steps or options. No headings, tables or emoji. Usually under 150 words; longer only when he asks for detail.
- Look things up with the tools rather than guessing or asking him for what the app already knows. Don't announce or narrate lookups; just answer.
- When the request is ambiguous in a way that changes what you'd do, ask one short question instead.
- The app doesn't know whether a cooking session actually happened or what's in the fridge. When it matters, don't assume prepped food exists: go by what Chris said (here or in other recent conversations), or ask.
- Food safety and injuries: be specific and conservative. Pain that's sharp, or that doesn't settle, is a reason to see a professional.

Changing things:
- The change tools don't change anything on their own. Each call adds a proposed change under your reply, and Chris taps Apply to make all of them happen, or dismisses them. Propose, then say in a sentence what you proposed. Never say a change is done.
- Propose only what serves what he asked about, and prefer the smallest change that solves it: a meal swap before re-planning the week, a prep-guide rewrite before a new meal plan. Mention other useful housekeeping in a sentence instead of proposing it.
- Coach work runs in the background after Apply: a week's meal plan takes about 20 minutes and is followed by a new prep guide (about 8 more), a prep guide alone about 8, a new training block about 2. Say so when you propose one, and put everything that work needs to know in its note.
- You can't set lifting weights, reps, or calorie and macro targets; the rules below decide them. Explain the rule when asked, and change what feeds it instead (an exercise, a day, a location, a note).
- Proposals in a new reply replace earlier ones Chris hasn't applied, so propose the complete set you want him to apply, including anything earlier you still recommend. Earlier proposals in the conversation are labeled applied, dismissed (or replaced), or not applied yet.

${HOW_STRIKE_WORKS}`;

type CallToolResult = Awaited<ReturnType<Parameters<typeof tool>[3]>>;

const text = (t: string): CallToolResult => ({ content: [{ type: "text", text: t }] });
const failed = (err: unknown): CallToolResult => ({ content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }], isError: true });

async function safely(fn: () => string): Promise<CallToolResult> {
  try {
    return text(fn());
  } catch (err) {
    return failed(err);
  }
}

const Week = z.enum(["current", "next"]).describe("current is the plan week holding today; next is the coming one");
const readOnly = { annotations: { readOnlyHint: true } };

function lookupTools() {
  return [
    tool("get_day", "One day: day type, targets and what's logged, each meal's planned option (with ids) and log, the workout, cooking sessions and prep reminders.", { date: LocalDate }, ({ date }) => safely(() => dayText(date)), readOnly),
    tool("get_meal_plan", "A week's meal plan: every day's planned meal per slot and every option on the menu, with ids, macros and cost, plus shopping status.", { week: Week }, ({ week }) => safely(() => mealPlanText(week)), readOnly),
    tool("get_meal_option", "One menu option in full: ingredients and steps, or what to order.", { week: Week, optionId: z.string() }, ({ week, optionId }) => safely(() => mealOptionText(week, optionId)), readOnly),
    tool("get_groceries", "A week's grocery list as totaled from its plan.", { week: Week }, ({ week }) => safely(() => groceriesText(week)), readOnly),
    tool(
      "get_prep_guide",
      "A week's prep guide: cooking sessions by date, containers with eat-by dates and fridge or freezer, reminders. includeSteps adds equipment, ingredients, steps, reheating and food safety.",
      { week: Week, includeSteps: z.boolean() },
      ({ week, includeSteps }) => safely(() => prepGuideText(week, includeSteps)),
      readOnly,
    ),
    tool("get_training", "The current training block: its days and exercises, every session's status by week with ids, and the next session.", {}, () => safely(trainingText), readOnly),
    tool("get_session", "One session: each exercise with its id, target loads and reps, logged sets, and today's prescription reason.", { sessionId: z.number().int().positive() }, ({ sessionId }) => safely(() => sessionText(sessionId)), readOnly),
    tool(
      "get_exercise_options",
      "Exercises that can replace one in a session, available at its location.",
      { sessionId: z.number().int().positive(), sessionExerciseId: z.number().int().positive() },
      ({ sessionId, sessionExerciseId }) => safely(() => exerciseOptionsText(sessionId, sessionExerciseId)),
      readOnly,
    ),
    tool("get_body", "Weight trend and weigh-ins, current calorie targets and why, and recent weekly check-ins.", {}, () => safely(bodyText), readOnly),
    tool("get_meal_log", "What was logged as eaten or skipped each day, against targets.", { days: z.number().int().min(1).max(14) }, ({ days }) => safely(() => mealLogText(days)), readOnly),
  ];
}

function changeTools(reply: Reply) {
  return CoachActionKind.options.map((kind) => {
    const def = ACTIONS[kind];
    return tool(`propose_${kind}`, `${def.description} Proposes it; Chris applies it from your reply.`, def.input, async (input: unknown) => {
      try {
        const action = propose(reply.messageId, kind, input);
        const { input: _input, ...visible } = action;
        reply.emit({ type: "action", action: visible });
        return text(`Proposed: ${action.summary}. It's shown under your reply; nothing changes until Chris applies it.`);
      } catch (err) {
        return failed(err);
      }
    });
  });
}

const STATUS: Record<string, string> = {
  get_day: "Checking the day",
  get_meal_plan: "Reading the meal plan",
  get_meal_option: "Reading a recipe",
  get_groceries: "Checking the grocery list",
  get_prep_guide: "Reading the prep guide",
  get_training: "Looking at your training block",
  get_session: "Looking at the workout",
  get_exercise_options: "Finding other exercises",
  get_body: "Checking your weight trend",
  get_meal_log: "Reading your meal log",
};

/** A reply being written. Keeps every event so a client that connects late sees the whole reply. */
export class Reply {
  text = "";
  private events: CoachStreamEvent[] = [];
  private listeners = new Set<(e: CoachStreamEvent) => void>();
  readonly threadId: number;
  readonly messageId: number;

  constructor(threadId: number, messageId: number) {
    this.threadId = threadId;
    this.messageId = messageId;
  }

  emit(e: CoachStreamEvent) {
    this.events.push(e);
    for (const fn of this.listeners) fn(e);
  }

  delta(t: string) {
    this.text += t;
    this.emit({ type: "delta", text: t });
  }

  /** Replays what has happened so far, then follows along. Returns the unsubscribe function. */
  subscribe(fn: (e: CoachStreamEvent) => void): () => void {
    for (const e of this.events) fn(e);
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

const replies = new Map<number, Reply>();

export const isReplying = (threadId: number) => replies.has(threadId);
export const activeReply = (threadId: number) => replies.get(threadId) ?? null;

/** Saves Chris's message and starts the coach's reply. Throws before anything is saved when it can't. */
export function sendMessage(req: CoachMessageRequest) {
  if (env.coach === "off") throw new HttpError(409, "Ask Coach needs the coach, and it's turned off on the server.");
  requireProfile();
  const thread = req.threadId ? threadRow(req.threadId) : createThread(req.text);
  if (replies.has(thread.id)) throw new HttpError(409, "The coach is still answering your last message.");
  const message = insertMessage(thread.id, "user", req.text, "done");
  const pending = insertMessage(thread.id, "assistant", "", "pending");
  touchThread(thread.id);
  const reply = new Reply(thread.id, pending.id);
  replies.set(thread.id, reply);
  void run(reply);
  return { reply, start: { type: "start", thread: toThreadSummary(threadRow(thread.id)), message: toMessage(message), reply: toMessage(pending) } satisfies CoachStreamEvent };
}

async function run(reply: Reply) {
  let error: string | null = null;
  const started = Date.now();
  try {
    reply.emit({ type: "status", text: "Thinking" });
    if (coachEnabled()) await converse(reply);
    else await mockReply(reply);
    if (!reply.text.trim()) throw new Error("The coach didn't write a reply. Try asking again.");
    console.log(`[coach] chat reply in ${Math.round((Date.now() - started) / 1000)}s`);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    console.error("[coach] chat reply failed:", error);
  }
  const row = updateMessage(reply.messageId, { text: reply.text.trim(), status: error ? "failed" : "done", error });
  replies.delete(reply.threadId);
  touchThread(reply.threadId);
  reply.emit({ type: "done", reply: toMessage(row) });
}

/** Mock mode, for tests and UI work: a streamed canned answer, and a proposal when asked to remember. */
async function mockReply(reply: Reply) {
  const asked = messagesOf(reply.threadId).filter((m) => m.role === "user").at(-1)?.text ?? "";
  const words = "The coach is in mock mode on this server, so this is a stand-in answer. **Nothing here** comes from Claude.\n\n- Ask with the real coach for advice\n- Say \"remember\" to see a proposed change".split(" ");
  for (const [i, word] of words.entries()) {
    reply.delta(i ? ` ${word}` : word);
    await new Promise((r) => setTimeout(r, 15));
  }
  if (/remember/i.test(asked)) {
    reply.emit({ type: "status", text: "Drafting a change" });
    const { input: _input, ...action } = propose(reply.messageId, "save_note", { note: asked.slice(0, 2000) });
    reply.emit({ type: "action", action });
  }
}

/** What Chris said in other conversations lately, so a new one doesn't start from nothing. */
function otherConversationsText(threadId: number): string {
  const since = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const lines = recentMessages(since)
    .filter((m) => m.threadId !== threadId)
    .map((m) => {
      const applied = m.actions.filter((a) => a.status === "applied").map((a) => a.summary);
      return m.role === "user" ? `- [${momentLabel(m.createdAt)}] ${m.text.slice(0, 400)}` : applied.length ? `  - Applied: ${applied.join("; ")}` : "";
    })
    .filter(Boolean)
    .slice(-10);
  return lines.length ? `## ${requireProfile().name}'s other recent conversations (his messages, and changes he applied)\n${lines.join("\n")}` : "";
}

/** Everything the coach sees for this turn: who Chris is, today, the week, and the conversation. */
export function chatPrompt(threadId: number, replyId: number): string {
  const profile = requireProfile();
  const now = today(profile);
  const history = messagesOf(threadId).filter((m) => m.id !== replyId);
  const latest = history.pop();
  const transcript = history.slice(-30).map((m) => {
    const who = m.role === "user" ? profile.name : "Coach";
    const body = m.status === "failed" && !m.text ? "(no reply; it failed)" : m.text;
    const actions = m.actions.map((a) => `  - Proposed: ${a.summary} (${a.status === "applied" ? "applied" : a.status === "dismissed" ? "dismissed or replaced" : "not applied yet"})`);
    return [`[${momentLabel(m.createdAt)}] ${who}: ${body}`, ...actions].join("\n");
  });
  return [
    personContext(profile),
    otherConversationsText(threadId),
    `## Now\n${dayLabel(now)} (${now}), ${clockLabel(formatTime(minutesNowIn(profile.timezone)))}`,
    weekOverviewText(),
    dayText(now),
    transcript.length ? `## Conversation so far\n${transcript.join("\n\n")}` : "",
    `## ${profile.name}'s new message\n${latest?.text ?? ""}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function converse(reply: Reply) {
  const tools = [...lookupTools(), ...changeTools(reply)];
  const server = createSdkMcpServer({ name: "strike", version: env.version, tools, alwaysLoad: true });
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 8 * 60_000);
  let breakBeforeText = false;
  let turns = 0;
  try {
    for await (const message of query({
      prompt: chatPrompt(reply.threadId, reply.messageId),
      options: {
        model: env.model,
        systemPrompt: CHAT_SYSTEM,
        tools: [],
        mcpServers: { strike: server },
        allowedTools: tools.map((t) => `mcp__strike__${t.name}`),
        settingSources: [],
        persistSession: false,
        maxTurns: 24,
        effort: env.chatEffort,
        includePartialMessages: true,
        cwd: workdir,
        env: childEnv(),
        abortController: abort,
      },
    })) {
      if (message.type === "stream_event") {
        const event = message.event;
        if (event.type === "message_start" && turns++ > 0) reply.emit({ type: "status", text: "Thinking" });
        if (event.type === "content_block_start" && event.content_block.type === "text") breakBeforeText = reply.text.length > 0;
        if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
          const name = event.content_block.name.replace(/^mcp__strike__/, "");
          reply.emit({ type: "status", text: STATUS[name] ?? (name.startsWith("propose_") ? "Drafting a change" : "Working") });
        }
        if (event.type === "content_block_delta" && event.delta.type === "text_delta" && event.delta.text) {
          if (breakBeforeText) {
            reply.delta("\n\n");
            breakBeforeText = false;
          }
          reply.delta(event.delta.text);
        }
      } else if (message.type === "result" && message.subtype !== "success") {
        throw new Error(message.subtype === "error_max_turns" ? "The coach ran out of steps before finishing." : `The coach stopped: ${message.subtype}.`);
      }
    }
  } catch (err) {
    if (abort.signal.aborted) throw new Error("The coach took too long to answer. Try again, or ask something narrower.");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Writes a reply's events to an SSE stream until it's done or the client goes away. */
export async function followReply(reply: Reply, stream: SSEStreamingApi) {
  const queue: CoachStreamEvent[] = [];
  let wake: (() => void) | null = null;
  let closed = false;
  stream.onAbort(() => {
    closed = true;
    wake?.();
  });
  const unsubscribe = reply.subscribe((e) => {
    queue.push(e);
    wake?.();
  });
  // Comments keep the connection alive while the coach thinks; iOS gives up after 20 idle seconds.
  const ping = setInterval(() => void stream.write(": ping\n\n").catch(() => {}), 10_000);
  try {
    while (!closed) {
      const e = queue.shift();
      if (!e) {
        await new Promise<void>((resolve) => (wake = resolve));
        wake = null;
        continue;
      }
      await stream.writeSSE({ event: e.type, data: JSON.stringify(e) });
      if (e.type === "done") break;
    }
  } finally {
    clearInterval(ping);
    unsubscribe();
  }
}

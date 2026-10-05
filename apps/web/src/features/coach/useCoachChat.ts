// The open Ask Coach conversation: its messages, kept current from the reply stream. A reply keeps going on
// the server when the stream drops, so a lost stream is picked back up from the saved thread.
import type { CoachMessage, CoachStreamEvent, CoachThread } from "@strike/core";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useReducer, useState, type Dispatch } from "react";
import { toastError } from "../../components/ui/Toast.tsx";
import { errorMessage, isUnauthorized } from "../../lib/api.ts";
import { followCoachReply, sendCoachMessage } from "../../lib/coachStream.ts";
import { endpoints } from "../../lib/endpoints.ts";
import { keys } from "../../lib/queries.ts";

/** A conversation active this recently opens again instead of a fresh one. */
const RESUME_WITHIN_MS = 6 * 60 * 60_000;

export interface ChatState {
  /** null until the first message of a new conversation starts it. */
  threadId: number | null;
  /** Oldest first. The reply being written has status "pending". */
  messages: CoachMessage[];
  /** What the coach is doing, until text arrives after it. */
  status: string | null;
  loading: boolean;
  error: unknown;
  /** Changes whenever a different conversation is shown. */
  view: number;
  /** Messages that were there when it was shown: they appear at once, new ones ease in. */
  shownIds: ReadonlySet<number>;
}

type ChatAction =
  | { type: "loading" }
  | { type: "failed"; error: unknown }
  | { type: "show"; threadId: number | null; messages: CoachMessage[] }
  /** A fresher copy of the open thread. Skipped while a reply streams in, unless forced. */
  | { type: "sync"; thread: CoachThread; force?: boolean }
  /** A followed stream replays the reply from its beginning. */
  | { type: "replay" }
  | { type: "event"; event: CoachStreamEvent }
  | { type: "update"; message: CoachMessage };

export const isPending = (m: CoachMessage) => m.role === "assistant" && m.status === "pending";

const INITIAL: ChatState = { threadId: null, messages: [], status: null, loading: true, error: null, view: 0, shownIds: new Set() };

function reducer(s: ChatState, a: ChatAction): ChatState {
  switch (a.type) {
    case "loading":
      return { ...s, loading: true, error: null };
    case "failed":
      return { ...s, loading: false, error: a.error };
    case "show":
      return {
        threadId: a.threadId,
        messages: a.messages,
        status: null,
        loading: false,
        error: null,
        view: s.view + 1,
        shownIds: new Set(a.messages.map((m) => m.id)),
      };
    case "sync":
      if (a.thread.id !== s.threadId || (!a.force && s.messages.some(isPending))) return s;
      return { ...s, messages: a.thread.messages };
    case "replay":
      return { ...s, status: null, messages: s.messages.map((m) => (isPending(m) ? { ...m, text: "" } : m)) };
    case "update":
      return { ...s, messages: s.messages.map((m) => (m.id === a.message.id ? a.message : m)) };
    case "event":
      return applyEvent(s, a.event);
  }
}

function applyEvent(s: ChatState, e: CoachStreamEvent): ChatState {
  switch (e.type) {
    case "start":
      return { ...s, threadId: e.thread.id, status: null, messages: [...s.messages, e.message, e.reply] };
    case "status":
      return { ...s, status: e.text };
    case "delta":
      return { ...s, status: null, messages: s.messages.map((m) => (isPending(m) ? { ...m, text: m.text + e.text } : m)) };
    case "action":
      return {
        ...s,
        messages: s.messages.map((m) => {
          if (isPending(m)) return m.actions.some((x) => x.id === e.action.id) ? m : { ...m, actions: [...m.actions, e.action] };
          // A reply's proposals replace earlier ones that weren't applied, as on the server.
          if (!m.actions.some((x) => x.status === "proposed")) return m;
          return { ...m, actions: m.actions.map((x) => (x.status === "proposed" ? { ...x, status: "dismissed" as const } : x)) };
        }),
      };
    case "done":
      return { ...s, status: null, messages: s.messages.map((m) => (m.id === e.reply.id ? e.reply : m)) };
  }
}

const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Back off while reconnecting, up to 5 s between tries. */
const backoff = (attempt: number) => Math.min(5000, 1000 * attempt);

interface Run {
  signal: AbortSignal;
  /** False once something newer started (another conversation, a new message) or the page closed. */
  alive: () => boolean;
}

/** Everything that talks to the server. Created once per page; each piece of work runs as a Run. */
function createChat(dispatch: Dispatch<ChatAction>, qc: QueryClient, setSending: (on: boolean) => void) {
  let generation = 0;
  let controller: AbortController | null = null;
  let lastLoad: () => void = () => {};

  const begin = (): Run => {
    controller?.abort();
    const own = new AbortController();
    controller = own;
    const mine = ++generation;
    return { signal: own.signal, alive: () => generation === mine && !own.signal.aborted };
  };

  const stop = () => {
    controller?.abort();
    controller = null;
    generation++;
  };

  const forward = (run: Run) => (event: CoachStreamEvent) => {
    if (run.alive()) dispatch({ type: "event", event });
  };

  /** A reply finished: the list's order changed, and its proposals may have dismissed earlier ones. */
  const finished = (run: Run, threadId: number, reply: CoachMessage | null) => {
    void qc.invalidateQueries({ queryKey: keys.coachThreads });
    if (!reply?.actions.length) return;
    endpoints
      .coachThread(threadId)
      .then((thread) => run.alive() && dispatch({ type: "sync", thread }))
      .catch(() => {});
  };

  /** Load a thread (shown fresh when `show`), and follow its reply if the coach is still writing. */
  const load = async (run: Run, threadId: number, attempt: number, show: boolean): Promise<void> => {
    let thread: CoachThread;
    try {
      thread = await endpoints.coachThread(threadId);
    } catch (err) {
      if (!run.alive() || isUnauthorized(err) || isAbort(err)) return;
      if (show) return void dispatch({ type: "failed", error: err });
      // Mid-reply and offline for a moment: keep trying until the server answers.
      await sleep(backoff(attempt + 1));
      if (run.alive()) return load(run, threadId, attempt + 1, false);
      return;
    }
    if (!run.alive()) return;
    if (show) dispatch({ type: "show", threadId: thread.id, messages: thread.messages });
    else dispatch({ type: "sync", thread, force: true });
    if (thread.replying) return follow(run, threadId, attempt);
    if (!show) finished(run, threadId, null);
  };

  /** Follow the reply being written. When the stream drops, load the thread again and carry on. */
  const follow = async (run: Run, threadId: number, attempt: number): Promise<void> => {
    if (attempt > 0) {
      dispatch({ type: "event", event: { type: "status", text: "Reconnecting" } });
      await sleep(backoff(attempt));
      if (!run.alive()) return;
    }
    dispatch({ type: "replay" });
    try {
      const reply = await followCoachReply(threadId, { signal: run.signal, onEvent: forward(run) });
      if (!run.alive()) return;
      if (reply) return finished(run, threadId, reply);
    } catch (err) {
      if (!run.alive() || isUnauthorized(err) || isAbort(err)) return;
      // 409: the reply finished in the meantime; the saved thread has it.
    }
    return load(run, threadId, attempt + 1, false);
  };

  const start = () => {
    const run = begin();
    lastLoad = start;
    dispatch({ type: "loading" });
    qc.fetchQuery({ queryKey: keys.coachThreads, queryFn: endpoints.coachThreads, staleTime: 0 })
      .then((threads) => {
        if (!run.alive()) return;
        const recent = threads[0];
        if (recent && Date.now() - Date.parse(recent.updatedAt) < RESUME_WITHIN_MS) void load(run, recent.id, 0, true);
        else dispatch({ type: "show", threadId: null, messages: [] });
      })
      .catch((err) => {
        if (run.alive() && !isUnauthorized(err)) dispatch({ type: "failed", error: err });
      });
  };

  const open = (threadId: number) => {
    const run = begin();
    lastLoad = () => open(threadId);
    setSending(false);
    dispatch({ type: "loading" });
    void load(run, threadId, 0, true);
  };

  const reset = () => {
    begin();
    setSending(false);
    dispatch({ type: "show", threadId: null, messages: [] });
  };

  /** Resolves true once the server took the message (its `start` event), false if it refused it. */
  const send = (threadId: number | null, text: string) =>
    new Promise<boolean>((resolve) => {
      const run = begin();
      let started: number | null = null;
      setSending(true);
      const onEvent = (event: CoachStreamEvent) => {
        if (!run.alive()) return;
        if (event.type === "start") {
          started = event.thread.id;
          setSending(false);
          resolve(true);
          void qc.invalidateQueries({ queryKey: keys.coachThreads });
        }
        dispatch({ type: "event", event });
      };
      sendCoachMessage({ threadId, text }, { signal: run.signal, onEvent })
        .then((reply) => {
          if (!run.alive() || started == null) return;
          if (reply) finished(run, started, reply);
          else void load(run, started, 1, false);
        })
        .catch((err) => {
          if (started == null) {
            if (run.alive() && !isUnauthorized(err) && !isAbort(err)) toastError(errorMessage(err));
            return;
          }
          if (run.alive() && !isUnauthorized(err) && !isAbort(err)) void load(run, started, 1, false);
        })
        .finally(() => {
          if (started != null) return;
          if (run.alive()) setSending(false);
          resolve(false);
        });
    });

  return {
    start,
    open,
    reset,
    send,
    stop,
    retry: () => lastLoad(),
    update: (message: CoachMessage) => dispatch({ type: "update", message }),
  };
}

export type CoachChat = ChatState & ReturnType<typeof createChat> & { sending: boolean; replying: boolean };

export function useCoachChat(): CoachChat {
  const qc = useQueryClient();
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [sending, setSending] = useState(false);
  const [chat] = useState(() => createChat(dispatch, qc, setSending));

  useEffect(() => {
    chat.start();
    return chat.stop;
  }, [chat]);

  return { ...state, ...chat, sending, replying: state.messages.some(isPending) };
}


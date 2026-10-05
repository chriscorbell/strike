// Ask Coach replies arrive as server-sent events (docs/api.md, "Ask Coach"). EventSource can't POST or send
// the bearer token, so the stream is read with fetch.
import type { CoachMessage, CoachMessageRequest, CoachStreamEvent } from "@strike/core";
import { apiFetch } from "./api.ts";

interface StreamOptions {
  signal?: AbortSignal;
  onEvent: (event: CoachStreamEvent) => void;
}

/**
 * Send a message and follow the coach's reply. Throws an ApiError before anything streams (409 while the
 * coach is still answering, or when it's off). Resolves with the finished reply, or null if the stream
 * ended before `done`.
 */
export async function sendCoachMessage(body: CoachMessageRequest, opts: StreamOptions): Promise<CoachMessage | null> {
  const res = await apiFetch("/coach/messages", { method: "POST", body, signal: opts.signal, accept: "text/event-stream" });
  return readEvents(res, opts.onEvent);
}

/**
 * Follow the reply being written in a conversation, replayed from its beginning (there's no `start`).
 * Throws an ApiError 409 when nothing is being written; the saved thread has the reply then.
 */
export async function followCoachReply(threadId: number, opts: StreamOptions): Promise<CoachMessage | null> {
  const res = await apiFetch(`/coach/threads/${threadId}/stream`, { signal: opts.signal, accept: "text/event-stream" });
  return readEvents(res, opts.onEvent);
}

async function readEvents(res: Response, onEvent: (event: CoachStreamEvent) => void): Promise<CoachMessage | null> {
  if (!res.body) return null;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let name = "";
  let data: string[] = [];

  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);

        // A blank line ends an event.
        if (line === "") {
          const event = data.length ? parse(name, data.join("\n")) : null;
          name = "";
          data = [];
          if (!event) continue;
          onEvent(event);
          if (event.type === "done") return event.reply;
          continue;
        }
        // Keep-alive comment.
        if (line.startsWith(":")) continue;

        const colon = line.indexOf(":");
        const field = colon === -1 ? line : line.slice(0, colon);
        let value = colon === -1 ? "" : line.slice(colon + 1);
        if (value.startsWith(" ")) value = value.slice(1);
        if (field === "event") name = value;
        else if (field === "data") data.push(value);
      }
      if (done) return null;
    }
  } finally {
    // Stop reading if we returned early (on `done`) or threw; ignore errors from an already-closed stream.
    reader.cancel().catch(() => {});
  }
}

function parse(name: string, json: string): CoachStreamEvent | null {
  try {
    const event = JSON.parse(json) as CoachStreamEvent;
    if (!event.type && name) (event as { type: string }).type = name;
    return event;
  } catch {
    return null;
  }
}

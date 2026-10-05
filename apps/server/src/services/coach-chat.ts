// Ask Coach conversations: threads of messages, stored so a conversation survives the app closing.
import { asc, desc, eq, gte } from "drizzle-orm";
import type { CoachMessage, CoachThread, CoachThreadSummary } from "@strike/core";
import { db, schema } from "../db/index.ts";
import type { StoredCoachAction } from "../db/schema.ts";
import { notFound } from "../http.ts";

type ThreadRow = typeof schema.coachThreads.$inferSelect;
export type MessageRow = typeof schema.coachMessages.$inferSelect;

const nowIso = () => new Date().toISOString();

export const toThreadSummary = (r: ThreadRow): CoachThreadSummary => ({ id: r.id, title: r.title, createdAt: r.createdAt, updatedAt: r.updatedAt });

export const toMessage = (r: MessageRow): CoachMessage => ({
  id: r.id,
  threadId: r.threadId,
  role: r.role,
  text: r.text,
  status: r.status,
  error: r.error,
  actions: r.actions.map(({ input: _input, ...a }) => a),
  createdAt: r.createdAt,
});

export function threadRow(id: number): ThreadRow {
  const row = db.select().from(schema.coachThreads).where(eq(schema.coachThreads.id, id)).get();
  if (!row) throw notFound("Conversation");
  return row;
}

export function createThread(firstMessage: string): ThreadRow {
  const flat = firstMessage.replace(/\s+/g, " ").trim();
  const title = flat.length > 60 ? `${flat.slice(0, 57).trimEnd()}…` : flat;
  return db.insert(schema.coachThreads).values({ title }).returning().get();
}

export function touchThread(id: number) {
  db.update(schema.coachThreads).set({ updatedAt: nowIso() }).where(eq(schema.coachThreads.id, id)).run();
}

export function listThreads(limit = 50): CoachThreadSummary[] {
  return db.select().from(schema.coachThreads).orderBy(desc(schema.coachThreads.updatedAt)).limit(limit).all().map(toThreadSummary);
}

export function deleteThread(id: number) {
  threadRow(id);
  db.delete(schema.coachThreads).where(eq(schema.coachThreads.id, id)).run();
}

export function messagesOf(threadId: number): MessageRow[] {
  return db.select().from(schema.coachMessages).where(eq(schema.coachMessages.threadId, threadId)).orderBy(asc(schema.coachMessages.id)).all();
}

/** Messages from every conversation since a moment, oldest first. */
export function recentMessages(sinceIso: string): MessageRow[] {
  return db.select().from(schema.coachMessages).where(gte(schema.coachMessages.createdAt, sinceIso)).orderBy(asc(schema.coachMessages.id)).all();
}

export function threadView(id: number, replying: boolean): CoachThread {
  return { ...toThreadSummary(threadRow(id)), replying, messages: messagesOf(id).map(toMessage) };
}

export function insertMessage(threadId: number, role: MessageRow["role"], text: string, status: MessageRow["status"]): MessageRow {
  return db.insert(schema.coachMessages).values({ threadId, role, text, status, createdAt: nowIso() }).returning().get();
}

export function messageRow(id: number): MessageRow {
  const row = db.select().from(schema.coachMessages).where(eq(schema.coachMessages.id, id)).get();
  if (!row) throw notFound("Message");
  return row;
}

export function updateMessage(id: number, patch: Partial<Pick<MessageRow, "text" | "status" | "error" | "actions">>): MessageRow {
  return db.update(schema.coachMessages).set(patch).where(eq(schema.coachMessages.id, id)).returning().get()!;
}

export function addAction(messageId: number, action: StoredCoachAction) {
  const row = messageRow(messageId);
  updateMessage(messageId, { actions: [...row.actions, action] });
}

/** A reply's new proposals replace the ones earlier in the conversation that weren't applied. */
export function dismissEarlierProposals(threadId: number, beforeMessageId: number) {
  for (const m of messagesOf(threadId)) {
    if (m.id >= beforeMessageId || !m.actions.some((a) => a.status === "proposed")) continue;
    updateMessage(m.id, { actions: m.actions.map((a) => (a.status === "proposed" ? { ...a, status: "dismissed" as const } : a)) });
  }
}

/** Replies cut off by a restart can never finish; say so instead of leaving them pending forever. */
export function failInterruptedReplies() {
  db.update(schema.coachMessages)
    .set({ status: "failed", error: "The server restarted before the coach finished. Ask again." })
    .where(eq(schema.coachMessages.status, "pending"))
    .run();
}

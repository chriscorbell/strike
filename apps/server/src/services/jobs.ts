// A small persistent job queue for coach work. One job runs at a time, so a burst of requests never
// fans out into parallel Claude sessions against the subscription.
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Job, JobKind } from "@strike/core";
import { db, schema } from "../db/index.ts";
import { notFound } from "../http.ts";

type Row = typeof schema.jobs.$inferSelect;
export type Handler = (input: Record<string, unknown>, job: Row) => Promise<unknown>;

const handlers = new Map<JobKind, Handler>();
const listeners = new Set<(job: Job) => void>();
let running = false;
let wake: (() => void) | null = null;

export const toJob = (r: Row): Job => ({
  id: r.id,
  kind: r.kind,
  status: r.status,
  error: r.error,
  result: r.result ?? null,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

export function registerHandler(kind: JobKind, handler: Handler) {
  handlers.set(kind, handler);
}

export function onJobDone(fn: (job: Job) => void) {
  listeners.add(fn);
}

/** Kinds where one pending job is enough; asking again returns the job already waiting. */
const SINGLETON: JobKind[] = ["mesocycle", "check_in_note"];

export function enqueue(kind: JobKind, input: Record<string, unknown> = {}): Job {
  if (kind === "meal_menu") {
    // One pending plan per week.
    const pending = db
      .select()
      .from(schema.jobs)
      .where(and(eq(schema.jobs.kind, kind), inArray(schema.jobs.status, ["queued", "running"])))
      .all()
      .find((j) => (j.input.weekStart ?? null) === (input.weekStart ?? null));
    if (pending) return toJob(pending);
  }
  if (kind === "prep_guide") {
    // One pending guide per menu.
    const pending = db
      .select()
      .from(schema.jobs)
      .where(and(eq(schema.jobs.kind, kind), inArray(schema.jobs.status, ["queued", "running"])))
      .all()
      .find((j) => j.input.menuId === input.menuId);
    if (pending) return toJob(pending);
  }
  if (SINGLETON.includes(kind)) {
    const pending = db
      .select()
      .from(schema.jobs)
      .where(and(eq(schema.jobs.kind, kind), inArray(schema.jobs.status, ["queued", "running"])))
      .get();
    if (pending) return toJob(pending);
  }
  const row = db.insert(schema.jobs).values({ kind, status: "queued", input }).returning().get();
  wake?.();
  return toJob(row);
}

export function getJob(id: number): Job {
  const row = db.select().from(schema.jobs).where(eq(schema.jobs.id, id)).get();
  if (!row) throw notFound("Job");
  return toJob(row);
}

export function pendingJobs(kind?: JobKind): Job[] {
  const cond = inArray(schema.jobs.status, ["queued", "running"]);
  return db
    .select()
    .from(schema.jobs)
    .where(kind ? and(cond, eq(schema.jobs.kind, kind)) : cond)
    .orderBy(asc(schema.jobs.id))
    .all()
    .map(toJob);
}

/** Pending jobs with their inputs, for matching a job to the thing it works on. */
export function pendingJobRows(kind: JobKind) {
  return db
    .select()
    .from(schema.jobs)
    .where(and(eq(schema.jobs.kind, kind), inArray(schema.jobs.status, ["queued", "running"])))
    .orderBy(asc(schema.jobs.id))
    .all();
}

export function recentJobs(limit = 20): Job[] {
  return db.select().from(schema.jobs).orderBy(desc(schema.jobs.id)).limit(limit).all().map(toJob);
}

function finish(id: number, patch: Partial<Row>) {
  const row = db
    .update(schema.jobs)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(schema.jobs.id, id))
    .returning()
    .get();
  if (row) for (const fn of listeners) fn(toJob(row));
}

async function runNext(): Promise<boolean> {
  const row = db.select().from(schema.jobs).where(eq(schema.jobs.status, "queued")).orderBy(asc(schema.jobs.id)).get();
  if (!row) return false;
  const handler = handlers.get(row.kind);
  db.update(schema.jobs)
    .set({ status: "running", attempts: row.attempts + 1, updatedAt: new Date().toISOString() })
    .where(eq(schema.jobs.id, row.id))
    .run();
  if (!handler) {
    finish(row.id, { status: "failed", error: `No handler for ${row.kind}` });
    return true;
  }
  const started = Date.now();
  try {
    const result = await handler(row.input, row);
    finish(row.id, { status: "succeeded", result: result ?? null, error: null });
    console.log(`[jobs] ${row.kind} #${row.id} succeeded in ${Math.round((Date.now() - started) / 1000)}s`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[jobs] ${row.kind} #${row.id} failed:`, message);
    finish(row.id, { status: "failed", error: message });
  }
  return true;
}

/** Start the worker loop. Jobs left running by a crash go back to the queue. */
export function startWorker() {
  db.update(schema.jobs).set({ status: "queued" }).where(eq(schema.jobs.status, "running")).run();
  if (running) return;
  running = true;
  void (async () => {
    while (running) {
      const didWork = await runNext().catch((err) => {
        console.error("[jobs] worker error", err);
        return false;
      });
      if (!didWork) {
        await new Promise<void>((resolve) => {
          wake = resolve;
          setTimeout(resolve, 5000);
        });
        wake = null;
      }
    }
  })();
}

export function stopWorker() {
  running = false;
  wake?.();
}

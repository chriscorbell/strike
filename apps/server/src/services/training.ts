import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import {
  alternatives,
  distributeDelta,
  e1rm,
  EXERCISES,
  getExercise,
  getExerciseGuide,
  isAvailable,
  loadOptions,
  loadUnit,
  maxSetsForMinutes,
  prescribe,
  requireExercise,
  restSecondsFor,
  rirForWeek,
  setDelta,
  snapDown,
  startingWeight,
  type CompleteSessionResponse,
  type ExerciseDetail,
  type ExerciseHistoryResponse,
  type ExerciseInfo,
  type HistoryEntry,
  type Location,
  type LogSetRequest,
  type MesoOverview,
  type MesoPlan,
  type MuscleFeedback,
  type Profile,
  type Session,
  type SessionSummary,
} from "@strike/core";
import { db, schema } from "../db/index.ts";
import { HttpError, notFound } from "../http.ts";
import { enqueue } from "./jobs.ts";
import { requireProfile, today } from "./profile.ts";
import { currentWeightKg } from "./weights.ts";

type MesoRow = typeof schema.mesocycles.$inferSelect;
type SessionRow = typeof schema.sessions.$inferSelect;
type SERow = typeof schema.sessionExercises.$inferSelect;
type SetRow = typeof schema.setLogs.$inferSelect;

const nowIso = () => new Date().toISOString();

export function activeMeso(): MesoRow | undefined {
  return db.select().from(schema.mesocycles).where(eq(schema.mesocycles.status, "active")).orderBy(desc(schema.mesocycles.id)).get();
}

function mesoById(id: number): MesoRow {
  const row = db.select().from(schema.mesocycles).where(eq(schema.mesocycles.id, id)).get();
  if (!row) throw notFound("Mesocycle");
  return row;
}

function sessionRow(id: number): SessionRow {
  const row = db.select().from(schema.sessions).where(eq(schema.sessions.id, id)).get();
  if (!row) throw notFound("Session");
  return row;
}

function exercisesOf(sessionId: number): SERow[] {
  return db.select().from(schema.sessionExercises).where(eq(schema.sessionExercises.sessionId, sessionId)).orderBy(asc(schema.sessionExercises.order)).all();
}

function logsOf(seIds: number[]): SetRow[] {
  if (seIds.length === 0) return [];
  return db.select().from(schema.setLogs).where(inArray(schema.setLogs.sessionExerciseId, seIds)).orderBy(asc(schema.setLogs.setIndex)).all();
}

/** Store a new mesocycle and retire the active one. Untouched planned sessions of the old one go away. */
export function createMeso(plan: MesoPlan, source: "coach" | "fallback", startDate: string): MesoRow {
  return db.transaction((tx) => {
    const old = tx.select().from(schema.mesocycles).where(eq(schema.mesocycles.status, "active")).all();
    for (const m of old) {
      const open = tx
        .select()
        .from(schema.sessions)
        .where(and(eq(schema.sessions.mesoId, m.id), inArray(schema.sessions.status, ["planned", "in_progress"])))
        .all();
      for (const s of open) {
        const ses = tx.select().from(schema.sessionExercises).where(eq(schema.sessionExercises.sessionId, s.id)).all();
        const logged = ses.length ? tx.select().from(schema.setLogs).where(inArray(schema.setLogs.sessionExerciseId, ses.map((e) => e.id))).all() : [];
        if (logged.length === 0) tx.delete(schema.sessions).where(eq(schema.sessions.id, s.id)).run();
        else tx.update(schema.sessions).set({ status: "completed", completedAt: nowIso() }).where(eq(schema.sessions.id, s.id)).run();
      }
      tx.update(schema.mesocycles).set({ status: "completed", completedAt: nowIso() }).where(eq(schema.mesocycles.id, m.id)).run();
    }
    return tx.insert(schema.mesocycles).values({ plan, source, startDate, status: "active" }).returning().get();
  });
}

interface Slot {
  week: number;
  dayIndex: number;
  row: SessionRow | undefined;
}

function nextSlot(meso: MesoRow): Slot | null {
  const rows = db.select().from(schema.sessions).where(eq(schema.sessions.mesoId, meso.id)).all();
  const weeks = meso.plan.weeks + 1;
  for (let week = 0; week < weeks; week++) {
    for (let dayIndex = 0; dayIndex < meso.plan.days.length; dayIndex++) {
      const row = rows.find((r) => r.week === week && r.dayIndex === dayIndex);
      if (!row || row.status === "planned" || row.status === "in_progress") return { week, dayIndex, row };
    }
  }
  return null;
}

/**
 * The session to do next, created on demand. A finished mesocycle is closed and the coach is asked for
 * the next one; until it arrives there is no next session.
 */
export function ensureNextSession(): SessionRow | null {
  const meso = activeMeso();
  if (!meso) return null;
  const slot = nextSlot(meso);
  if (!slot) {
    db.update(schema.mesocycles).set({ status: "completed", completedAt: nowIso() }).where(eq(schema.mesocycles.id, meso.id)).run();
    enqueue("mesocycle", { reason: "The previous block is finished." });
    return null;
  }
  return slot.row ?? buildSession(meso, slot.week, slot.dayIndex);
}

function usableLocation(profile: Profile, wanted: Location): Location {
  if (profile.equipment[wanted].available) return wanted;
  return wanted === "home" ? "gym" : "home";
}

function buildSession(meso: MesoRow, week: number, dayIndex: number): SessionRow {
  const profile = requireProfile();
  const day = meso.plan.days[dayIndex]!;
  const hardWeeks = meso.plan.weeks;
  const isDeload = week >= hardWeeks;
  const targetRir = rirForWeek(week, hardWeeks);
  const location = usableLocation(profile, day.location);

  // Set counts start from the plan and follow last week's same day plus that day's feedback.
  let counts = day.exercises.map((e) => e.sets);
  if (week > 0) {
    const prev = db
      .select()
      .from(schema.sessions)
      .where(and(eq(schema.sessions.mesoId, meso.id), eq(schema.sessions.week, week - 1), eq(schema.sessions.dayIndex, dayIndex)))
      .get();
    if (prev) {
      const prevEx = exercisesOf(prev.id);
      counts = day.exercises.map((e, i) => prevEx.find((p) => p.order === i)?.targetReps.length ?? e.sets);
      if (isDeload) {
        counts = counts.map((c) => Math.max(1, Math.ceil(c / 2)));
      } else if (prev.status === "completed") {
        const fb = db.select().from(schema.feedback).where(eq(schema.feedback.sessionId, prev.id)).all();
        for (const f of fb) {
          const delta = setDelta(f);
          const idxs = day.exercises.map((e, i) => (getExercise(e.exerciseId)?.primary === f.muscle ? i : -1)).filter((i) => i >= 0);
          if (idxs.length === 0 || delta === 0) continue;
          const spread = distributeDelta(idxs.map((i) => ({ key: String(i), sets: counts[i]! })), delta);
          for (const s of spread) counts[Number(s.key)] = s.sets;
        }
      }
    }
  }
  const cap = maxSetsForMinutes(profile.training.sessionMinutes);
  while (counts.reduce((a, b) => a + b, 0) > cap) {
    const i = counts.indexOf(Math.max(...counts));
    if (counts[i]! <= 1) break;
    counts[i]! -= 1;
  }

  return db.transaction((tx) => {
    const session = tx
      .insert(schema.sessions)
      .values({ mesoId: meso.id, week, dayIndex, label: day.label, location, status: "planned", targetRir, isDeload })
      .returning()
      .get();
    day.exercises.forEach((plan, order) => {
      let exerciseId = plan.exerciseId;
      let substitutedFrom: string | null = null;
      const ex = getExercise(exerciseId);
      if (ex && !isAvailable(ex, profile.equipment[location])) {
        const alt = alternatives(exerciseId, profile.equipment[location])[0];
        if (alt) {
          substitutedFrom = exerciseId;
          exerciseId = alt.id;
        }
      }
      const repMin = substitutedFrom ? requireExercise(exerciseId).repMin : plan.repMin;
      const repMax = substitutedFrom ? requireExercise(exerciseId).repMax : plan.repMax;
      const startWeight = substitutedFrom ? null : plan.startWeight;
      const p = prescriptionFor(profile, exerciseId, location, counts[order]!, repMin, repMax, targetRir, isDeload, startWeight);
      tx.insert(schema.sessionExercises)
        .values({
          sessionId: session.id,
          exerciseId,
          order,
          repMin,
          repMax,
          targetWeight: p.weight,
          targetReps: p.reps,
          plannedSets: p.reps.length,
          targetRir: isDeload ? 4 : targetRir,
          notes: plan.notes,
          prescriptionNote: p.note,
          maxedOut: p.maxedOut,
          substitutedFrom,
          startWeight,
        })
        .run();
    });
    return session;
  });
}

/** Completed history for an exercise, oldest first, optionally excluding one session. */
function historyFor(exerciseId: string, excludeSessionId?: number): (HistoryEntry & { sessionId: number })[] {
  const rows = db
    .select({ se: schema.sessionExercises, s: schema.sessions })
    .from(schema.sessionExercises)
    .innerJoin(schema.sessions, eq(schema.sessionExercises.sessionId, schema.sessions.id))
    .where(and(eq(schema.sessionExercises.exerciseId, exerciseId), eq(schema.sessions.status, "completed"), excludeSessionId ? ne(schema.sessions.id, excludeSessionId) : undefined))
    .orderBy(asc(schema.sessions.completedAt))
    .all();
  const logs = logsOf(rows.map((r) => r.se.id));
  const out: (HistoryEntry & { sessionId: number })[] = [];
  for (const { se, s } of rows) {
    const sets = logs.filter((l) => l.sessionExerciseId === se.id).map((l) => ({ weight: l.weight, reps: l.reps, rir: l.rir }));
    if (sets.length === 0) continue;
    out.push({ sessionId: s.id, date: s.date ?? s.completedAt?.slice(0, 10) ?? "", targetRir: se.targetRir, targetReps: se.targetReps[0] ?? se.repMin, weight: sets[0]!.weight, sets });
  }
  return out;
}

function prescriptionFor(
  profile: Profile,
  exerciseId: string,
  location: Location,
  sets: number,
  repMin: number,
  repMax: number,
  targetRir: number,
  isDeload: boolean,
  startWeight: number | null,
) {
  const ex = requireExercise(exerciseId);
  const unit = loadUnit(profile.units);
  const loads = loadOptions(ex, profile.equipment[location], unit);
  const bw = currentWeightKg(today(profile)) ?? 80;
  const start = startWeight ?? startingWeight(ex, { bodyWeightKg: bw, sex: profile.sex, experience: profile.training.experience, unit });
  return prescribe({
    exercise: ex,
    repMin,
    repMax,
    sets,
    targetRir: isDeload ? 4 : targetRir,
    isDeload,
    loads,
    history: historyFor(exerciseId).slice(-6),
    startWeight: start != null && loads.length ? snapDown(start, loads) : start,
    experience: profile.training.experience,
    unit,
  });
}

function represcribe(profile: Profile, session: SessionRow, se: SERow) {
  const p = prescriptionFor(profile, se.exerciseId, session.location, se.targetReps.length, se.repMin, se.repMax, session.targetRir, session.isDeload, se.substitutedFrom ? null : se.startWeight);
  db.update(schema.sessionExercises)
    .set({ targetWeight: p.weight, targetReps: p.reps, prescriptionNote: p.note, maxedOut: p.maxedOut })
    .where(eq(schema.sessionExercises.id, se.id))
    .run();
}

export function sessionView(id: number): Session {
  const row = sessionRow(id);
  const profile = requireProfile();
  const meso = mesoById(row.mesoId);
  const ses = exercisesOf(id);
  const logs = logsOf(ses.map((e) => e.id));
  const fb = db.select().from(schema.feedback).where(eq(schema.feedback.sessionId, id)).all();
  return {
    id: row.id,
    mesoId: row.mesoId,
    week: row.week,
    dayIndex: row.dayIndex,
    hardWeeks: meso.plan.weeks,
    label: row.label,
    location: row.location,
    status: row.status,
    date: row.date,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    targetRir: row.targetRir,
    isDeload: row.isDeload,
    loadUnit: loadUnit(profile.units),
    feedback: fb.map((f) => ({ muscle: f.muscle, soreness: f.soreness, pump: f.pump, workload: f.workload, jointPain: f.jointPain })),
    exercises: ses.map((se) => {
      const ex = requireExercise(se.exerciseId);
      const mine = logs.filter((l) => l.sessionExerciseId === se.id);
      const count = Math.max(se.targetReps.length, ...mine.map((l) => l.setIndex + 1));
      const last = historyFor(se.exerciseId, id).at(-1);
      return {
        id: se.id,
        exerciseId: se.exerciseId,
        name: ex.name,
        muscle: ex.primary,
        loadType: ex.loadType,
        order: se.order,
        repMin: se.repMin,
        repMax: se.repMax,
        cues: ex.cues,
        notes: se.notes,
        prescriptionNote: se.prescriptionNote,
        maxedOut: se.maxedOut,
        loadOptions: loadOptions(ex, profile.equipment[row.location], loadUnit(profile.units)),
        restSeconds: restSecondsFor(ex),
        substitutedFrom: se.substitutedFrom,
        lastTime: last ? { date: last.date, sets: last.sets.map((s) => ({ weight: s.weight, reps: s.reps, rir: s.rir })) } : null,
        sets: Array.from({ length: count }, (_, index) => {
          const log = mine.find((l) => l.setIndex === index);
          return {
            index,
            targetWeight: se.targetWeight,
            targetReps: se.targetReps[index] ?? se.targetReps.at(-1) ?? se.repMin,
            targetRir: se.targetRir,
            log: log ? { id: log.id, weight: log.weight, reps: log.reps, rir: log.rir, loggedAt: log.loggedAt } : null,
            extra: index >= (se.plannedSets ?? se.targetReps.length),
          };
        }),
      };
    }),
  };
}

function relocate(profile: Profile, session: SessionRow, location: Location) {
  const loc = profile.equipment[location];
  if (!loc.available) throw new HttpError(400, `The ${location} location isn't set up.`);
  const ses = exercisesOf(session.id);
  const logged = new Set(logsOf(ses.map((e) => e.id)).map((l) => l.sessionExerciseId));
  const used = new Set(ses.map((e) => e.exerciseId));
  db.update(schema.sessions).set({ location }).where(eq(schema.sessions.id, session.id)).run();
  const updated = { ...session, location };
  for (const se of ses) {
    if (logged.has(se.id)) continue;
    let current = se;
    const ex = requireExercise(se.exerciseId);
    if (!isAvailable(ex, loc)) {
      // Prefer going back to the original exercise if this location supports it.
      const original = se.substitutedFrom ? getExercise(se.substitutedFrom) : undefined;
      const alt = original && isAvailable(original, loc) ? original : alternatives(se.exerciseId, loc).find((a) => !used.has(a.id));
      if (alt) {
        used.add(alt.id);
        const back = alt.id === se.substitutedFrom;
        db.update(schema.sessionExercises)
          .set({ exerciseId: alt.id, substitutedFrom: back ? null : (se.substitutedFrom ?? se.exerciseId), repMin: alt.repMin, repMax: alt.repMax })
          .where(eq(schema.sessionExercises.id, se.id))
          .run();
        current = { ...se, exerciseId: alt.id, substitutedFrom: back ? null : (se.substitutedFrom ?? se.exerciseId), repMin: alt.repMin, repMax: alt.repMax };
      }
    }
    represcribe(profile, updated, current);
  }
}

export function setLocation(id: number, location: Location): Session {
  const session = sessionRow(id);
  if (session.status === "completed") throw new HttpError(409, "This session is already finished.");
  if (session.location !== location) relocate(requireProfile(), session, location);
  return sessionView(id);
}

export function startSession(id: number, location?: Location): Session {
  const profile = requireProfile();
  let session = sessionRow(id);
  if (session.status === "completed" || session.status === "skipped") throw new HttpError(409, "This session is already done.");
  if (location && location !== session.location) {
    relocate(profile, session, location);
    session = sessionRow(id);
  }
  if (session.status === "planned") {
    const ses = exercisesOf(id);
    const logged = new Set(logsOf(ses.map((e) => e.id)).map((l) => l.sessionExerciseId));
    for (const se of ses) if (!logged.has(se.id)) represcribe(profile, session, se);
    db.update(schema.sessions)
      .set({ status: "in_progress", startedAt: nowIso(), date: session.date ?? today(profile) })
      .where(eq(schema.sessions.id, id))
      .run();
  }
  return sessionView(id);
}

export function exerciseInfo(id: string, profile: Profile | null = null): ExerciseInfo {
  const e = requireExercise(id);
  const availableAt: Location[] = profile ? (["home", "gym"] as const).filter((l) => isAvailable(e, profile.equipment[l])) : [];
  return { id: e.id, name: e.name, primary: e.primary, secondary: e.secondary, loadType: e.loadType, repMin: e.repMin, repMax: e.repMax, cues: e.cues, availableAt };
}

export function exerciseDetail(id: string): ExerciseDetail {
  const guide = getExerciseGuide(id);
  if (!getExercise(id) || !guide) throw notFound("Exercise");
  return { ...exerciseInfo(id, requireProfile()), guide };
}

export function listExercises(loggedOnly = false): ExerciseInfo[] {
  const profile = requireProfile();
  let ids = EXERCISES.map((e) => e.id);
  if (loggedOnly) {
    const logged = new Set(
      db
        .selectDistinct({ exerciseId: schema.sessionExercises.exerciseId })
        .from(schema.setLogs)
        .innerJoin(schema.sessionExercises, eq(schema.setLogs.sessionExerciseId, schema.sessionExercises.id))
        .all()
        .map((r) => r.exerciseId),
    );
    ids = ids.filter((id) => logged.has(id));
  }
  return ids.map((id) => exerciseInfo(id, profile));
}

function seRow(sessionId: number, seId: number): SERow {
  const se = db.select().from(schema.sessionExercises).where(eq(schema.sessionExercises.id, seId)).get();
  if (!se || se.sessionId !== sessionId) throw notFound("Exercise in this session");
  return se;
}

export function alternativesFor(sessionId: number, seId: number): ExerciseInfo[] {
  const profile = requireProfile();
  const session = sessionRow(sessionId);
  const se = seRow(sessionId, seId);
  const inSession = new Set(exercisesOf(sessionId).map((e) => e.exerciseId));
  return alternatives(se.exerciseId, profile.equipment[session.location])
    .filter((e) => !inSession.has(e.id))
    .map((e) => exerciseInfo(e.id, profile));
}

export function swapExercise(sessionId: number, seId: number, exerciseId: string, permanent: boolean): Session {
  const profile = requireProfile();
  const session = sessionRow(sessionId);
  const se = seRow(sessionId, seId);
  const next = getExercise(exerciseId);
  if (!next) throw new HttpError(400, `Unknown exercise ${exerciseId}.`);
  if (!isAvailable(next, profile.equipment[session.location])) throw new HttpError(400, `${next.name} isn't possible at ${session.location}.`);
  if (logsOf([se.id]).length > 0) throw new HttpError(409, "Sets are already logged for this exercise; delete them before swapping.");
  const original = se.substitutedFrom ?? se.exerciseId;
  const updated: SERow = {
    ...se,
    exerciseId,
    substitutedFrom: permanent || exerciseId === original ? null : original,
    repMin: next.repMin,
    repMax: next.repMax,
    startWeight: null,
  };
  db.update(schema.sessionExercises)
    .set({ exerciseId, substitutedFrom: updated.substitutedFrom, repMin: next.repMin, repMax: next.repMax, startWeight: null })
    .where(eq(schema.sessionExercises.id, seId))
    .run();
  represcribe(profile, session, updated);
  if (permanent) {
    const meso = mesoById(session.mesoId);
    const plan = structuredClone(meso.plan);
    const day = plan.days[session.dayIndex];
    const item = day?.exercises[se.order];
    if (item) {
      item.exerciseId = exerciseId;
      item.repMin = next.repMin;
      item.repMax = next.repMax;
      item.startWeight = null;
      db.update(schema.mesocycles).set({ plan }).where(eq(schema.mesocycles.id, meso.id)).run();
    }
  }
  return sessionView(sessionId);
}

export function logSet(sessionId: number, req: LogSetRequest): Session {
  const profile = requireProfile();
  const session = sessionRow(sessionId);
  if (session.status === "skipped") throw new HttpError(409, "This session was skipped.");
  const se = seRow(sessionId, req.sessionExerciseId);
  db.transaction((tx) => {
    tx.insert(schema.setLogs)
      .values({ sessionExerciseId: se.id, setIndex: req.setIndex, weight: req.weight, reps: req.reps, rir: req.rir, loggedAt: nowIso() })
      .onConflictDoUpdate({
        target: [schema.setLogs.sessionExerciseId, schema.setLogs.setIndex],
        set: { weight: req.weight, reps: req.reps, rir: req.rir, loggedAt: nowIso() },
      })
      .run();
    if (req.setIndex >= se.targetReps.length) {
      const reps = [...se.targetReps];
      while (reps.length <= req.setIndex) reps.push(reps.at(-1) ?? se.repMin);
      tx.update(schema.sessionExercises).set({ targetReps: reps }).where(eq(schema.sessionExercises.id, se.id)).run();
    }
    if (session.status === "planned") {
      tx.update(schema.sessions)
        .set({ status: "in_progress", startedAt: nowIso(), date: session.date ?? today(profile) })
        .where(eq(schema.sessions.id, sessionId))
        .run();
    }
  });
  return sessionView(sessionId);
}

export function deleteSet(sessionId: number, setId: number): Session {
  const log = db.select().from(schema.setLogs).where(eq(schema.setLogs.id, setId)).get();
  if (!log) throw notFound("Set");
  const se = seRow(sessionId, log.sessionExerciseId);
  db.delete(schema.setLogs).where(eq(schema.setLogs.id, setId)).run();
  // Removing a set that was added during the session removes the set itself, not just its log.
  const planned = se.plannedSets ?? se.targetReps.length;
  if (log.setIndex >= planned) {
    const highest = Math.max(-1, ...logsOf([se.id]).map((l) => l.setIndex));
    const keep = Math.max(planned, highest + 1);
    if (keep < se.targetReps.length) {
      db.update(schema.sessionExercises).set({ targetReps: se.targetReps.slice(0, keep) }).where(eq(schema.sessionExercises.id, se.id)).run();
    }
  }
  return sessionView(sessionId);
}

export function putFeedback(sessionId: number, fb: MuscleFeedback): Session {
  sessionRow(sessionId);
  const existing = db
    .select()
    .from(schema.feedback)
    .where(and(eq(schema.feedback.sessionId, sessionId), eq(schema.feedback.muscle, fb.muscle)))
    .get();
  const merged = {
    soreness: fb.soreness ?? existing?.soreness ?? null,
    pump: fb.pump ?? existing?.pump ?? null,
    workload: fb.workload ?? existing?.workload ?? null,
    jointPain: fb.jointPain,
  };
  db.insert(schema.feedback)
    .values({ sessionId, muscle: fb.muscle, ...merged })
    .onConflictDoUpdate({ target: [schema.feedback.sessionId, schema.feedback.muscle], set: merged })
    .run();
  return sessionView(sessionId);
}

export function completeSession(id: number): CompleteSessionResponse {
  const profile = requireProfile();
  const session = sessionRow(id);
  const ses = exercisesOf(id);
  const logs = logsOf(ses.map((e) => e.id));
  if (logs.length === 0) throw new HttpError(409, "Log at least one set before finishing.");
  const completedAt = nowIso();
  if (session.status !== "completed") {
    db.update(schema.sessions)
      .set({ status: "completed", completedAt, startedAt: session.startedAt ?? completedAt, date: session.date ?? today(profile) })
      .where(eq(schema.sessions.id, id))
      .run();
  }
  const prs: CompleteSessionResponse["summary"]["prs"] = [];
  for (const se of ses) {
    const mine = logs.filter((l) => l.sessionExerciseId === se.id && l.weight != null && l.weight > 0);
    if (mine.length === 0) continue;
    const best = Math.max(...mine.map((l) => e1rm(l.weight!, l.reps, l.rir ?? se.targetRir)));
    const before = historyFor(se.exerciseId, id).flatMap((h) => h.sets.filter((s) => s.weight != null && s.weight > 0).map((s) => e1rm(s.weight!, s.reps, s.rir ?? h.targetRir)));
    const previous = before.length ? Math.max(...before) : null;
    if (previous != null && best > previous * 1.005) {
      prs.push({ exerciseId: se.exerciseId, name: requireExercise(se.exerciseId).name, e1rm: Math.round(best * 10) / 10, previous: Math.round(previous * 10) / 10 });
    }
  }
  const volume = logs.reduce((a, l) => a + (l.weight ?? 0) * l.reps, 0);
  const startedAt = session.startedAt ?? completedAt;
  const durationMinutes = Math.round((Date.parse(session.completedAt ?? completedAt) - Date.parse(startedAt)) / 60000) || null;
  ensureNextSession();
  return { session: sessionView(id), summary: { setCount: logs.length, volume: Math.round(volume), prs, durationMinutes } };
}

export function skipSession(id: number): Session {
  const session = sessionRow(id);
  if (session.status === "completed") throw new HttpError(409, "This session is already finished.");
  db.update(schema.sessions).set({ status: "skipped", date: session.date ?? today() }).where(eq(schema.sessions.id, id)).run();
  ensureNextSession();
  return sessionView(id);
}

export function sessionSummaries(limit: number): SessionSummary[] {
  const rows = db
    .select()
    .from(schema.sessions)
    .where(inArray(schema.sessions.status, ["completed", "skipped"]))
    .orderBy(desc(schema.sessions.date), desc(schema.sessions.id))
    .limit(limit)
    .all();
  return rows.map((r) => summarize(r));
}

function summarize(r: SessionRow): SessionSummary {
  const ses = exercisesOf(r.id);
  const logs = logsOf(ses.map((e) => e.id));
  return {
    id: r.id,
    mesoId: r.mesoId,
    week: r.week,
    dayIndex: r.dayIndex,
    label: r.label,
    location: r.location,
    status: r.status,
    isDeload: r.isDeload,
    date: r.date,
    completedAt: r.completedAt,
    setCount: logs.length,
    volume: Math.round(logs.reduce((a, l) => a + (l.weight ?? 0) * l.reps, 0)),
  };
}

/** The session already tied to a date (started, done or skipped that day). */
export function sessionOnDate(date: string): SessionRow | undefined {
  return db.select().from(schema.sessions).where(eq(schema.sessions.date, date)).orderBy(desc(schema.sessions.id)).get();
}

export function sessionSetCount(id: number) {
  const ses = exercisesOf(id);
  return { exercises: ses.length, sets: ses.reduce((a, e) => a + e.targetReps.length, 0) };
}

export function mesoOverview(): MesoOverview | null {
  const meso = activeMeso() ?? db.select().from(schema.mesocycles).orderBy(desc(schema.mesocycles.id)).get();
  if (!meso) return null;
  const rows = db.select().from(schema.sessions).where(eq(schema.sessions.mesoId, meso.id)).all();
  const weeks = meso.plan.weeks + 1;
  return {
    id: meso.id,
    name: meso.plan.name,
    split: meso.plan.split,
    rationale: meso.plan.rationale,
    source: meso.source,
    startDate: meso.startDate,
    hardWeeks: meso.plan.weeks,
    status: meso.status,
    days: meso.plan.days.map((d) => ({
      label: d.label,
      location: d.location,
      focus: d.focus,
      exercises: d.exercises.map((e) => {
        const ex = getExercise(e.exerciseId);
        return { exerciseId: e.exerciseId, name: ex?.name ?? e.exerciseId, muscle: ex?.primary ?? "chest", sets: e.sets, repMin: e.repMin, repMax: e.repMax };
      }),
    })),
    grid: Array.from({ length: weeks }, (_, w) =>
      meso.plan.days.map((_, d) => {
        const r = rows.find((x) => x.week === w && x.dayIndex === d);
        return r ? { sessionId: r.id, status: r.status, date: r.date } : null;
      }),
    ),
  };
}

export function exerciseHistoryView(exerciseId: string): ExerciseHistoryResponse {
  const profile = requireProfile();
  if (!getExercise(exerciseId)) throw notFound("Exercise");
  return {
    exercise: exerciseInfo(exerciseId, profile),
    points: historyFor(exerciseId).map((h) => {
      const loaded = h.sets.filter((s) => s.weight != null && s.weight > 0);
      const best = loaded.length ? loaded.reduce((a, s) => (e1rm(s.weight!, s.reps, s.rir ?? h.targetRir) > e1rm(a.weight!, a.reps, a.rir ?? h.targetRir) ? s : a)) : h.sets.reduce((a, s) => (s.reps > a.reps ? s : a));
      return {
        date: h.date,
        sessionId: h.sessionId,
        bestWeight: best.weight,
        bestReps: best.reps,
        e1rm: best.weight != null && best.weight > 0 ? Math.round(e1rm(best.weight, best.reps, best.rir ?? h.targetRir) * 10) / 10 : null,
        sets: h.sets,
      };
    }),
  };
}

/** Training history the coach reads: per exercise, the last few sessions' sets. */
export function trainingDigest(limitSessions = 12) {
  const rows = db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.status, "completed"))
    .orderBy(desc(schema.sessions.completedAt))
    .limit(limitSessions)
    .all()
    .reverse();
  return rows.map((r) => {
    const ses = exercisesOf(r.id);
    const logs = logsOf(ses.map((e) => e.id));
    const fb = db.select().from(schema.feedback).where(eq(schema.feedback.sessionId, r.id)).all();
    return {
      date: r.date,
      label: r.label,
      week: r.week + 1,
      targetRir: r.targetRir,
      exercises: ses.map((se) => ({
        exercise: requireExercise(se.exerciseId).name,
        target: `${se.targetWeight ?? "BW"} x ${se.targetReps.join("/")}`,
        done: logs
          .filter((l) => l.sessionExerciseId === se.id)
          .map((l) => `${l.weight ?? "BW"}x${l.reps}${l.rir != null ? `@${l.rir}` : ""}`)
          .join(", "),
      })),
      feedback: fb.map((f) => ({ muscle: f.muscle, soreness: f.soreness, pump: f.pump, workload: f.workload, jointPain: f.jointPain })),
    };
  });
}

export function sessionsInRange(from: string, to: string) {
  return db
    .select()
    .from(schema.sessions)
    .all()
    .filter((s) => s.date != null && s.date >= from && s.date <= to);
}

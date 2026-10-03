// Every session mutation runs in one TanStack scope, so they reach the server in the order they were
// made. Each applies a light optimistic patch; the server's full Session only replaces the cache when
// no other mutation for this session is still pending, so an older response never overwrites a newer
// optimistic state. Errors refetch the session (the global MutationCache already shows a toast).
import type {
  CompleteSessionResponse,
  Location,
  LogSetRequest,
  Muscle,
  MuscleFeedback,
  Session,
  SessionExercise,
} from "@strike/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { endpoints } from "../../lib/endpoints.ts";
import { keys } from "../../lib/queries.ts";

export type FeedbackChange = Partial<Omit<MuscleFeedback, "muscle">>;

interface DeleteVars {
  seId: number;
  index: number;
  logId: number;
}

interface SwapVars {
  seId: number;
  exerciseId: string;
  permanent: boolean;
}

let tempId = -1;

function mapExercise(s: Session, seId: number, fn: (se: SessionExercise) => SessionExercise): Session {
  return { ...s, exercises: s.exercises.map((se) => (se.id === seId ? fn(se) : se)) };
}

function withLog(s: Session, req: LogSetRequest): Session {
  const now = new Date().toISOString();
  const next = mapExercise(s, req.sessionExerciseId, (se) => {
    const sets = [...se.sets];
    const template = sets[sets.length - 1];
    while (sets.length <= req.setIndex) {
      sets.push({
        index: sets.length,
        targetWeight: template?.targetWeight ?? null,
        targetReps: template?.targetReps ?? se.repMin,
        targetRir: template?.targetRir ?? s.targetRir,
        log: null,
        extra: true,
      });
    }
    const target = sets[req.setIndex]!;
    sets[req.setIndex] = {
      ...target,
      log: { id: target.log?.id ?? tempId--, weight: req.weight, reps: req.reps, rir: req.rir, loggedAt: now },
    };
    return { ...se, sets };
  });
  return s.status === "planned" ? { ...next, status: "in_progress", startedAt: now } : next;
}

/** Planned sets keep their slot with the log cleared; sets added during the session go away entirely. */
function withoutLog(s: Session, seId: number, index: number): Session {
  return mapExercise(s, seId, (se) => {
    const target = se.sets.find((set) => set.index === index);
    if (target?.extra) {
      const sets = se.sets.filter((set) => set.index !== index).map((set, i) => ({ ...set, index: i }));
      return { ...se, sets };
    }
    return { ...se, sets: se.sets.map((set) => (set.index === index ? { ...set, log: null } : set)) };
  });
}

function withFeedback(s: Session, fb: MuscleFeedback): Session {
  const rest = s.feedback.filter((f) => f.muscle !== fb.muscle);
  return { ...s, feedback: [...rest, fb] };
}

const findLogId = (s: Session | null | undefined, seId: number, index: number) =>
  s?.exercises.find((e) => e.id === seId)?.sets.find((set) => set.index === index)?.log?.id;

export function useSessionActions(sessionId: number, opts: { onCompleted?: (res: CompleteSessionResponse) => void } = {}) {
  const qc = useQueryClient();
  const key = keys.session(sessionId);
  const prefix = ["session-mutation", sessionId] as const;
  const scope = { id: `session-${sessionId}` };
  /** The newest Session the server returned, used to resolve sets that were still saving. */
  const latest = useRef<Session | null>(null);
  const onCompleted = useRef(opts.onCompleted);
  onCompleted.current = opts.onCompleted;

  const current = () => qc.getQueryData<Session>(key);
  const patch = (fn: (s: Session) => Session) => {
    void qc.cancelQueries({ queryKey: key });
    qc.setQueryData<Session>(key, (s) => (s ? fn(s) : s));
  };
  const settle = (session: Session) => {
    latest.current = session;
    if (qc.isMutating({ mutationKey: prefix }) <= 1) qc.setQueryData(key, session);
  };
  const common = (kind: string) => ({
    mutationKey: [...prefix, kind],
    scope,
    onError: () => void qc.invalidateQueries({ queryKey: key }),
    onSettled: () => {
      // Only refetches what's mounted; elsewhere it just marks the data stale.
      void qc.invalidateQueries({ queryKey: keys.today() });
      void qc.invalidateQueries({ queryKey: keys.sessions() });
      void qc.invalidateQueries({ queryKey: keys.meso });
      void qc.invalidateQueries({ queryKey: keys.loggedExercises });
    },
  });

  const logSet = useMutation({
    ...common("log"),
    mutationFn: (req: LogSetRequest) => endpoints.logSet(sessionId, req),
    onMutate: (req: LogSetRequest) => patch((s) => withLog(s, req)),
    onSuccess: (s: Session) => settle(s),
  });

  const deleteSet = useMutation({
    ...common("delete"),
    mutationFn: ({ seId, index, logId }: DeleteVars) => {
      // A set logged moments ago has a temporary id; by now its save has finished (same scope).
      const id = logId > 0 ? logId : findLogId(latest.current, seId, index);
      if (id == null || id < 0) return Promise.reject(new Error("That set hasn't saved yet"));
      return endpoints.deleteSet(sessionId, id);
    },
    onMutate: ({ seId, index }: DeleteVars) => patch((s) => withoutLog(s, seId, index)),
    onSuccess: (s: Session) => settle(s),
  });

  const feedback = useMutation({
    ...common("feedback"),
    mutationFn: (fb: MuscleFeedback) => endpoints.putFeedback(sessionId, fb),
    onMutate: (fb: MuscleFeedback) => patch((s) => withFeedback(s, fb)),
    onSuccess: (s: Session) => settle(s),
  });

  /** Change some of a muscle's feedback, keeping its other saved fields. */
  const sendFeedback = (muscle: Muscle, change: FeedbackChange) => {
    const cur = current()?.feedback.find((f) => f.muscle === muscle);
    feedback.mutate({
      muscle,
      soreness: cur?.soreness ?? null,
      pump: cur?.pump ?? null,
      workload: cur?.workload ?? null,
      jointPain: cur?.jointPain ?? false,
      ...change,
    });
  };

  const setLocation = useMutation({
    ...common("location"),
    mutationFn: (location: Location) => endpoints.setSessionLocation(sessionId, location),
    onMutate: (location: Location) => patch((s) => ({ ...s, location })),
    onSuccess: (s: Session) => settle(s),
  });

  const start = useMutation({
    ...common("start"),
    mutationFn: (location: Location) => endpoints.startSession(sessionId, location),
    onSuccess: (s: Session) => settle(s),
  });

  const swap = useMutation({
    ...common("swap"),
    mutationFn: ({ seId, exerciseId, permanent }: SwapVars) => endpoints.swapExercise(sessionId, seId, exerciseId, permanent),
    onSuccess: (s: Session) => settle(s),
  });

  const complete = useMutation({
    ...common("complete"),
    mutationFn: () => endpoints.completeSession(sessionId),
    onSuccess: (res: CompleteSessionResponse) => {
      onCompleted.current?.(res);
      settle(res.session);
    },
  });

  const skip = useMutation({
    ...common("skip"),
    mutationFn: () => endpoints.skipSession(sessionId),
    onSuccess: (s: Session) => settle(s),
  });

  return { logSet, deleteSet, sendFeedback, setLocation, start, swap, complete, skip };
}

export type SessionActions = ReturnType<typeof useSessionActions>;

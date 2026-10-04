// TanStack Query keys and hooks for server state.
import type { Job, JobKind, Profile, StateResponse, Units } from "@strike/core";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { endpoints, type MenuWeek } from "./endpoints.ts";

export const keys = {
  state: ["state"] as const,
  today: (date?: string) => (date ? (["today", date] as const) : (["today"] as const)),
  weights: (days?: number) => (days ? (["weights", days] as const) : (["weights"] as const)),
  measurements: ["measurements"] as const,
  meso: ["meso"] as const,
  sessions: (limit?: number) => (limit ? (["sessions", limit] as const) : (["sessions"] as const)),
  session: (id?: number) => (id === undefined ? (["session"] as const) : (["session", id] as const)),
  alternatives: (sessionId: number, seId: number) => ["alternatives", sessionId, seId] as const,
  exercises: ["exercises"] as const,
  loggedExercises: ["exercises", "logged"] as const,
  exerciseHistory: (id: string) => ["exerciseHistory", id] as const,
  menu: ["menu"] as const,
  menuWeek: (week: MenuWeek) => ["menu", week] as const,
  menuById: (id: number) => ["menu", "id", id] as const,
  mealHistory: (days?: number) => (days ? (["mealHistory", days] as const) : (["mealHistory"] as const)),
  checkins: ["checkins"] as const,
  checkinStatus: ["checkins", "status"] as const,
  pendingJobs: ["jobs", "pending"] as const,
  job: (id: number) => ["job", id] as const,
};

// ---------- Queries ----------

export const useAppState = () => useQuery({ queryKey: keys.state, queryFn: endpoints.state });

/** The onboarded profile. Only call below the onboarding gate. */
export function useProfile(): Profile {
  const { data } = useAppState();
  if (!data?.profile) throw new Error("useProfile called before onboarding");
  return data.profile;
}

export function useUnits(): Units {
  const { data } = useAppState();
  return data?.profile?.units ?? "imperial";
}

/** Today's date in the profile's time zone, as the server sees it. */
export function useServerToday(): string {
  const { data } = useAppState();
  return data?.today ?? new Date().toISOString().slice(0, 10);
}

export const useToday = (date?: string) =>
  useQuery({
    queryKey: keys.today(date),
    queryFn: () => endpoints.today(date),
    refetchInterval: (query) => (query.state.data?.pendingJobs.length ? 3000 : false),
  });

export const useWeights = (days = 90) => useQuery({ queryKey: keys.weights(days), queryFn: () => endpoints.weights(days) });
export const useMeasurements = () => useQuery({ queryKey: keys.measurements, queryFn: endpoints.measurements });
export const useMeso = () => useQuery({ queryKey: keys.meso, queryFn: endpoints.meso });
export const useSessions = (limit = 30) => useQuery({ queryKey: keys.sessions(limit), queryFn: () => endpoints.sessions(limit) });
export const useSession = (id: number) =>
  useQuery({ queryKey: keys.session(id), queryFn: () => endpoints.session(id), enabled: Number.isFinite(id) });
export const useExercises = () =>
  useQuery({ queryKey: keys.exercises, queryFn: endpoints.exercises, staleTime: 60 * 60_000 });
export const useLoggedExercises = () => useQuery({ queryKey: keys.loggedExercises, queryFn: endpoints.loggedExercises });
export const useExerciseHistory = (id: string | null) =>
  useQuery({
    queryKey: keys.exerciseHistory(id ?? ""),
    queryFn: () => endpoints.exerciseHistory(id!),
    enabled: !!id,
  });
export const useMenu = (week: MenuWeek = "current") =>
  useQuery({
    queryKey: keys.menuWeek(week),
    queryFn: () => endpoints.menu(week),
    // Poll while a new plan or its prep guide is being written.
    refetchInterval: (query) => (query.state.data?.pendingJob || query.state.data?.menu?.prepGuidePending ? 3000 : false),
  });

export const useMenuById = (id: number) =>
  useQuery({
    queryKey: keys.menuById(id),
    queryFn: () => endpoints.menuById(id),
    enabled: Number.isFinite(id),
    refetchInterval: (query) => (query.state.data?.prepGuidePending ? 3000 : false),
  });
export const useMealHistory = (days = 14) =>
  useQuery({ queryKey: keys.mealHistory(days), queryFn: () => endpoints.mealHistory(days) });
export const useCheckins = () => useQuery({ queryKey: keys.checkins, queryFn: endpoints.checkins });
export const useCheckinStatus = () => useQuery({ queryKey: keys.checkinStatus, queryFn: endpoints.checkinStatus });

// ---------- Coach jobs ----------

const TERMINAL = new Set<Job["status"]>(["succeeded", "failed"]);
export const isJobDone = (job: Job | undefined | null) => !!job && TERMINAL.has(job.status);

/** Refresh whatever a finished job changed. */
export function invalidateForJob(qc: QueryClient, kind: JobKind) {
  switch (kind) {
    case "mesocycle":
      void qc.invalidateQueries({ queryKey: keys.meso });
      void qc.invalidateQueries({ queryKey: keys.today() });
      void qc.invalidateQueries({ queryKey: keys.session() });
      void qc.invalidateQueries({ queryKey: keys.sessions() });
      break;
    case "meal_menu":
      void qc.invalidateQueries({ queryKey: keys.menu });
      void qc.invalidateQueries({ queryKey: keys.today() });
      break;
    case "check_in_note":
      void qc.invalidateQueries({ queryKey: keys.checkins });
      void qc.invalidateQueries({ queryKey: keys.today() });
      break;
    case "more_options":
      void qc.invalidateQueries({ queryKey: keys.today() });
      void qc.invalidateQueries({ queryKey: keys.menu });
      break;
    case "prep_guide":
      void qc.invalidateQueries({ queryKey: keys.menu });
      void qc.invalidateQueries({ queryKey: keys.today() });
      break;
    case "estimate_meal":
      break;
  }
}

/**
 * Pending coach jobs. Polls while any are running; when a job leaves the pending list, the queries it
 * affects are refreshed. Mount once (CoachStatus does).
 */
export function usePendingJobs() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: keys.pendingJobs,
    queryFn: endpoints.pendingJobs,
    refetchInterval: (q) => (q.state.data?.length ? 2500 : 30_000),
  });
  const previous = useRef<Map<number, JobKind>>(new Map());

  useEffect(() => {
    if (!query.data) return;
    const now = new Map(query.data.map((j) => [j.id, j.kind] as const));
    for (const [id, kind] of previous.current) if (!now.has(id)) invalidateForJob(qc, kind);
    previous.current = now;
  }, [query.data, qc]);

  return query;
}

/** Poll a single job until it finishes. Invalidates affected queries once it succeeds. */
export function useJob(id: number | null | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: keys.job(id ?? -1),
    queryFn: () => endpoints.job(id!),
    enabled: id != null,
    refetchInterval: (q) => (isJobDone(q.state.data) ? false : 2000),
  });
  const handled = useRef<number | null>(null);
  useEffect(() => {
    const job = query.data;
    if (job && isJobDone(job) && handled.current !== job.id) {
      handled.current = job.id;
      invalidateForJob(qc, job.kind);
      void qc.invalidateQueries({ queryKey: keys.pendingJobs });
    }
  }, [query.data, qc]);
  return query;
}

/** Start a coach job and remember its id so its progress can be followed with useJob. */
export function useStartJob<TVars>(start: (vars: TVars) => Promise<Job>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: start,
    onSuccess: (job) => {
      qc.setQueryData(keys.job(job.id), job);
      void qc.invalidateQueries({ queryKey: keys.pendingJobs });
    },
  });
}

/** Apply a fresh StateResponse after onboarding or a profile update. */
export function useApplyState() {
  const qc = useQueryClient();
  return (state: StateResponse) => {
    qc.setQueryData(keys.state, state);
    void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "state" });
  };
}

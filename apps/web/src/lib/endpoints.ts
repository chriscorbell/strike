// One typed function per API endpoint (docs/api.md).
import type {
  CheckIn,
  CheckInStatus,
  CoachMessage,
  CoachThread,
  CoachThreadSummary,
  CompleteSessionResponse,
  ExerciseDetail,
  ExerciseHistoryResponse,
  ExerciseInfo,
  Job,
  Location,
  LogSetRequest,
  MealHistoryDay,
  MealLog,
  MealLogRequest,
  MealMenu,
  Measurements,
  MeasurementEntry,
  MenuResponse,
  MesoOverview,
  MuscleFeedback,
  OnboardingRequest,
  Profile,
  Session,
  SessionSummary,
  StateResponse,
  TodayResponse,
  WeightsResponse,
} from "@strike/core";
import { api } from "./api.ts";

const q = (params: Record<string, string | number | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : "";
};

export type MenuWeek = "current" | "next";

export interface HealthResponse {
  ok: true;
  version: string;
  coach: { configured: boolean };
}

export const endpoints = {
  health: () => api<HealthResponse>("/health"),

  // Status and profile
  state: () => api<StateResponse>("/state"),
  onboard: (body: OnboardingRequest) => api<StateResponse>("/onboarding", { method: "POST", body }),
  updateProfile: (body: Profile) => api<StateResponse>("/profile", { method: "PUT", body }),

  // Today
  today: (date?: string) => api<TodayResponse>(`/today${q({ date })}`),
  setWorkoutTime: (date: string, time: string | null) =>
    api<TodayResponse>(`/days/${date}/workout-time`, { method: "PUT", body: { time } }),
  makeTrainingDay: (date: string) => api<TodayResponse>(`/days/${date}/train`, { method: "POST" }),
  makeRestDay: (date: string) => api<TodayResponse>(`/days/${date}/rest`, { method: "POST" }),

  // Body
  weights: (days = 90) => api<WeightsResponse>(`/weights${q({ days })}`),
  logWeight: (date: string, weightKg: number) =>
    api<{ date: string; weightKg: number; source: string }>("/weights", {
      method: "POST",
      body: { date, weightKg, source: "manual" },
    }),
  deleteWeight: (date: string) => api<{ ok: true }>(`/weights/${date}`, { method: "DELETE" }),
  measurements: () => api<MeasurementEntry[]>("/measurements"),
  /** One entry per date: posting an existing date replaces it. */
  logMeasurements: (body: { date: string } & Measurements) =>
    api<MeasurementEntry>("/measurements", { method: "POST", body }),
  deleteMeasurement: (id: number) => api<{ ok: true }>(`/measurements/${id}`, { method: "DELETE" }),

  // Training
  meso: () => api<MesoOverview | null>("/meso"),
  regenerateMeso: (note?: string) => api<Job>("/meso/regenerate", { method: "POST", body: { note } }),
  sessions: (limit = 30) => api<SessionSummary[]>(`/sessions${q({ limit })}`),
  session: (id: number) => api<Session>(`/sessions/${id}`),
  startSession: (id: number, location?: Location) =>
    api<Session>(`/sessions/${id}/start`, { method: "POST", body: { location } }),
  setSessionLocation: (id: number, location: Location) =>
    api<Session>(`/sessions/${id}/location`, { method: "POST", body: { location } }),
  alternatives: (id: number, seId: number) => api<ExerciseInfo[]>(`/sessions/${id}/exercises/${seId}/alternatives`),
  swapExercise: (id: number, seId: number, exerciseId: string, permanent: boolean) =>
    api<Session>(`/sessions/${id}/exercises/${seId}/swap`, { method: "POST", body: { exerciseId, permanent } }),
  logSet: (id: number, body: LogSetRequest) => api<Session>(`/sessions/${id}/sets`, { method: "POST", body }),
  deleteSet: (id: number, setId: number) => api<Session>(`/sessions/${id}/sets/${setId}`, { method: "DELETE" }),
  putFeedback: (id: number, body: MuscleFeedback) => api<Session>(`/sessions/${id}/feedback`, { method: "PUT", body }),
  completeSession: (id: number) => api<CompleteSessionResponse>(`/sessions/${id}/complete`, { method: "POST" }),
  skipSession: (id: number) => api<Session>(`/sessions/${id}/skip`, { method: "POST" }),
  exercises: () => api<ExerciseInfo[]>("/exercises"),
  /** Only exercises with logged sets. */
  loggedExercises: () => api<ExerciseInfo[]>("/exercises?logged=1"),
  exercise: (id: string) => api<ExerciseDetail>(`/exercises/${encodeURIComponent(id)}`),
  exerciseHistory: (id: string) => api<ExerciseHistoryResponse>(`/exercises/${encodeURIComponent(id)}/history`),

  // Meals
  menu: (week: MenuWeek = "current") => api<MenuResponse>(`/menu${q({ week })}`),
  menuById: (id: number) => api<MealMenu>(`/menus/${id}`),
  regenerateMenu: (note?: string, week: MenuWeek = "current") =>
    api<Job>("/menu/regenerate", { method: "POST", body: { note, week } }),
  /** Write (or rewrite) the menu's prep guide from today on. The note tells the coach what changed. */
  writePrepGuide: (menuId: number, note?: string) =>
    api<Job>(`/menu/${menuId}/prep-guide`, { method: "POST", body: note ? { note } : undefined }),
  /** Put a different option on one meal of the plan; the grocery list follows. */
  setPlanMeal: (menuId: number, body: { date: string; slotIndex: number; optionId: string }) =>
    api<MealMenu>(`/menu/${menuId}/plan`, { method: "PUT", body }),
  logMeal: (body: MealLogRequest) => api<MealLog>("/meals/log", { method: "POST", body }),
  deleteMealLog: (id: number) => api<{ ok: true }>(`/meals/log/${id}`, { method: "DELETE" }),
  mealHistory: (days = 14) => api<MealHistoryDay[]>(`/meals/history${q({ days })}`),
  estimateMeal: (description: string) => api<Job>("/meals/estimate", { method: "POST", body: { description } }),
  moreOptions: (date: string, slotIndex: number) =>
    api<Job>("/meals/more-options", { method: "POST", body: { date, slotIndex } }),

  // Check-ins and jobs
  checkins: () => api<CheckIn[]>("/checkins"),
  checkinStatus: () => api<CheckInStatus>("/checkins/status"),
  runCheckin: (note?: string) => api<CheckIn>("/checkins/run", { method: "POST", body: { note } }),
  coachNote: (note: string) => api<{ ok: true }>("/coach/note", { method: "POST", body: { note } }),
  pendingJobs: () => api<Job[]>("/jobs?pending=1"),
  job: (id: number) => api<Job>(`/jobs/${id}`),

  // Ask Coach (sending a message and following a reply stream: lib/coachStream.ts)
  coachThreads: () => api<CoachThreadSummary[]>("/coach/threads"),
  coachThread: (id: number) => api<CoachThread>(`/coach/threads/${id}`),
  deleteCoachThread: (id: number) => api<{ ok: true }>(`/coach/threads/${id}`, { method: "DELETE" }),
  /** Apply every proposed change on a reply, together. */
  applyCoachMessage: (id: number) => api<CoachMessage>(`/coach/messages/${id}/apply`, { method: "POST" }),
  dismissCoachMessage: (id: number) => api<CoachMessage>(`/coach/messages/${id}/dismiss`, { method: "POST" }),
};

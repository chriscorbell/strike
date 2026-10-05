// Response shapes for the HTTP API. Requests are validated with the zod schemas in schemas.ts;
// responses are plain types. docs/api.md documents both, and the iOS models mirror them.
import type { ExerciseGuide } from "./exercise-guides.ts";
import type {
  CheckIn,
  CoachAction,
  CoachMessage,
  DayType,
  Job,
  Location,
  Macros,
  MealLog,
  MealMenu,
  MealOption,
  MealRole,
  Measurements,
  Muscle,
  NutritionTargets,
  Profile,
  Session,
  SessionStatus,
} from "./schemas.ts";

export interface StateResponse {
  onboarded: boolean;
  profile: Profile | null;
  targets: NutritionTargets | null;
  /** Whether the coach (Claude) is configured on the server. */
  coachAvailable: boolean;
  today: string;
}

export interface TimelineMeal {
  kind: "meal";
  time: string;
  slotIndex: number;
  label: string;
  role: MealRole;
  targets: Macros;
  /** The planned dish first, then the other options for this meal. */
  options: MealOption[];
  /** The option the week's plan assigns to this meal (you have its groceries); null without a plan. */
  plannedOptionId: string | null;
  log: MealLog | null;
}

export interface TimelineWorkout {
  kind: "workout";
  time: string;
  endTime: string;
  sessionId: number;
  label: string;
  location: Location;
  status: SessionStatus;
  exerciseCount: number;
  setCount: number;
}

export type TimelineItem = TimelineMeal | TimelineWorkout;

export interface TodayResponse {
  date: string;
  dayType: DayType;
  /** True when the workout time differs from the profile default for this date. */
  workoutTimeOverride: string | null;
  weight: { loggedKg: number | null; trendKg: number | null };
  targets: Macros;
  consumed: Macros;
  timeline: TimelineItem[];
  /** Meals logged outside the plan's slots. */
  extraMeals: MealLog[];
  meso: { id: number; name: string; week: number; hardWeeks: number; isDeload: boolean; targetRir: number } | null;
  /** The next session not yet done, which may be today's. */
  nextSession: { id: number; label: string; location: Location; week: number; dayIndex: number } | null;
  checkIn: { due: boolean; latest: CheckIn | null };
  /** Coach jobs still queued or running, so clients can show progress. */
  pendingJobs: Job[];
  menuReady: boolean;
  /**
   * Next plan week, from the evening before shopping day until it starts: whether its meal plan and
   * grocery list are ready.
   */
  /** Prep for this date: cooking sessions planned for it and reminders (thaw tonight, etc.). */
  prep: {
    menuId: number;
    sessions: { index: number; title: string; covers: string; activeMinutes: number; totalMinutes: number }[];
    reminders: { time: string | null; text: string }[];
  } | null;
  upcomingWeek: {
    weekStart: string;
    shoppingDate: string;
    ready: boolean;
    menuId: number | null;
    /** Items to buy, not counting pantry staples. */
    itemCount: number;
    costUsd: number;
  } | null;
}

export interface WeightPoint {
  date: string;
  weightKg: number | null;
  trendKg: number;
}

export interface WeightsResponse {
  points: WeightPoint[];
  rateKgPerWeek: number | null;
  targetRateKgPerWeek: number;
  latestTrendKg: number | null;
}

export interface MeasurementEntry extends Measurements {
  id: number;
  date: string;
}

export interface SessionSummary {
  id: number;
  mesoId: number;
  week: number;
  dayIndex: number;
  label: string;
  location: Location;
  status: SessionStatus;
  isDeload: boolean;
  date: string | null;
  completedAt: string | null;
  setCount: number;
  /** Sum of weight x reps for loaded sets, in the load unit. */
  volume: number;
}

export interface CompleteSessionResponse {
  session: Session;
  summary: {
    setCount: number;
    volume: number;
    prs: { exerciseId: string; name: string; e1rm: number; previous: number | null }[];
    durationMinutes: number | null;
  };
}

export interface MesoOverview {
  id: number;
  name: string;
  split: string;
  rationale: string;
  source: "coach" | "fallback";
  startDate: string;
  hardWeeks: number;
  status: "active" | "completed";
  days: { label: string; location: Location; focus: string; exercises: { exerciseId: string; name: string; muscle: Muscle; sets: number; repMin: number; repMax: number }[] }[];
  /** weeks (hard weeks + deload) x days, the session in each cell when it exists. */
  grid: ({ sessionId: number; status: SessionStatus; date: string | null } | null)[][];
}

export interface ExerciseInfo {
  id: string;
  name: string;
  primary: Muscle;
  secondary: Muscle[];
  loadType: Session["exercises"][number]["loadType"];
  repMin: number;
  repMax: number;
  cues: string;
  availableAt: Location[];
}

/** One exercise with its form guide and technique video. */
export interface ExerciseDetail extends ExerciseInfo {
  guide: ExerciseGuide;
}

export interface ExerciseHistoryResponse {
  exercise: ExerciseInfo;
  points: { date: string; sessionId: number; bestWeight: number | null; bestReps: number; e1rm: number | null; sets: { weight: number | null; reps: number; rir: number | null }[] }[];
}

export interface CheckInStatus {
  due: boolean;
  latest: CheckIn | null;
}

export interface MenuResponse {
  menu: MealMenu | null;
  pendingJob: Job | null;
  /** When this week's plan is (or was) prepared: the evening before shopping day. */
  prepAt: { date: string; time: string };
  shoppingDate: string;
}

export interface MealHistoryDay {
  date: string;
  dayType: DayType;
  targets: Macros;
  consumed: Macros;
  logs: MealLog[];
}

export interface CoachThreadSummary {
  id: number;
  /** The start of the first message. */
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface CoachThread extends CoachThreadSummary {
  /** The coach is writing a reply right now. */
  replying: boolean;
  /** Oldest first. */
  messages: CoachMessage[];
}

/**
 * Server-sent events from `POST /api/coach/messages`: the SSE event name is `type`, and `data` is this
 * object as JSON. A stream always ends with `done`.
 */
export type CoachStreamEvent =
  | { type: "start"; thread: CoachThreadSummary; message: CoachMessage; reply: CoachMessage }
  /** What the coach is doing while there's no text yet or between steps, e.g. "Reading the prep guide". */
  | { type: "status"; text: string }
  | { type: "delta"; text: string }
  /** A change proposed mid-reply; it also arrives in `done`. */
  | { type: "action"; action: CoachAction }
  /** The finished reply (`status` done or failed). */
  | { type: "done"; reply: CoachMessage };

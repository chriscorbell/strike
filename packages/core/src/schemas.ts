// The API contract shared by the server and the web app. The iOS app mirrors these shapes in Swift
// (apps/ios/Strike/Models), so a change here owes a change there and in docs/api.md.
import { z } from "zod";

export const LocalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
export const TimeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM");
/** 0 = Sunday … 6 = Saturday, matching Date#getUTCDay. */
export const Weekday = z.number().int().min(0).max(6);

export const Muscle = z.enum([
  "chest",
  "back",
  "traps",
  "front_delts",
  "side_delts",
  "rear_delts",
  "biceps",
  "triceps",
  "forearms",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "abs",
]);
export type Muscle = z.infer<typeof Muscle>;

export const Location = z.enum(["home", "gym"]);
export type Location = z.infer<typeof Location>;

/** Equipment a location can have, beyond dumbbells, which are described by DumbbellSet. */
export const EquipmentItem = z.enum([
  "bench_flat",
  "bench_adjustable",
  "pullup_bar",
  "dip_station",
  "cable",
  "lat_pulldown",
  "seated_row",
  "leg_press",
  "leg_extension",
  "leg_curl",
  "smith_machine",
  "barbell",
  "chest_press_machine",
  "shoulder_press_machine",
  "pec_deck",
]);
export type EquipmentItem = z.infer<typeof EquipmentItem>;

/** Weights are per dumbbell, in the profile's load unit. */
export const DumbbellSet = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({
    kind: z.literal("adjustable"),
    min: z.number().positive(),
    max: z.number().positive(),
    step: z.number().positive(),
  }),
  z.object({ kind: z.literal("fixed"), weights: z.array(z.number().positive()).min(1) }),
]);
export type DumbbellSet = z.infer<typeof DumbbellSet>;

export const LocationEquipment = z.object({
  available: z.boolean(),
  dumbbells: DumbbellSet,
  items: z.array(EquipmentItem),
  /** Smallest jump on cable stacks and selectorized machines, in the load unit. */
  machineStep: z.number().positive(),
  notes: z.string(),
});
export type LocationEquipment = z.infer<typeof LocationEquipment>;

export const Units = z.enum(["imperial", "metric"]);
export type Units = z.infer<typeof Units>;

export const Profile = z.object({
  name: z.string().min(1),
  sex: z.enum(["male", "female"]),
  birthDate: LocalDate,
  heightCm: z.number().min(120).max(230),
  /** Imperial shows lb/in and loads in lb; metric shows kg/cm and loads in kg. */
  units: Units,
  timezone: z.string().min(1),
  /** Activity outside of lifting: job, steps, chores. */
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
  goal: z.object({
    type: z.enum(["lose", "maintain", "gain"]),
    /** Percent of body weight per week; ignored for maintain. */
    ratePercentPerWeek: z.number().min(0).max(1.5),
    targetWeightKg: z.number().positive().nullable(),
  }),
  training: z.object({
    experience: z.enum(["beginner", "intermediate", "advanced"]),
    /** Weekdays you lift, 2 to 6 of them. */
    days: z.array(Weekday).min(2).max(6),
    sessionMinutes: z.number().int().min(20).max(120),
    workoutTime: TimeOfDay,
    defaultLocation: Location,
    focusMuscles: z.array(Muscle).max(4),
    limitations: z.string(),
  }),
  equipment: z.object({ home: LocationEquipment, gym: LocationEquipment }),
  schedule: z.object({
    wakeTime: TimeOfDay,
    sleepTime: TimeOfDay,
    /** The first day of each plan week. The weekly check-in and next week's meal plan are prepared ahead of it. */
    checkInDay: Weekday,
    /** Grocery day for the coming plan week; defaults to the day before the week starts. */
    shoppingDay: Weekday.optional(),
  }),
  nutrition: z.object({
    mealsPerDay: z.number().int().min(2).max(6),
    dietStyle: z.enum(["omnivore", "pescatarian", "vegetarian", "vegan"]),
    allergies: z.array(z.string()),
    avoidFoods: z.string(),
    favoriteFoods: z.string(),
    cookingTime: z.enum(["minimal", "moderate", "enjoys"]),
    weeklyBudgetUsd: z.number().min(0),
    grabAndGo: z.array(z.string()),
    kitchen: z.array(
      z.enum(["microwave", "stove", "oven", "air_fryer", "rice_cooker", "blender", "slow_cooker", "grill"]),
    ),
  }),
});
export type Profile = z.infer<typeof Profile>;

export const Measurements = z.object({
  waistCm: z.number().positive().nullable(),
  neckCm: z.number().positive().nullable(),
  hipsCm: z.number().positive().nullable(),
  chestCm: z.number().positive().nullable(),
  armCm: z.number().positive().nullable(),
  thighCm: z.number().positive().nullable(),
  bodyFatPercent: z.number().min(3).max(60).nullable(),
});
export type Measurements = z.infer<typeof Measurements>;

export const OnboardingRequest = z.object({
  profile: Profile,
  weightKg: z.number().min(30).max(300),
  measurements: Measurements.nullable(),
});
export type OnboardingRequest = z.infer<typeof OnboardingRequest>;

export const Macros = z.object({
  kcal: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
});
export type Macros = z.infer<typeof Macros>;

export const DayType = z.enum(["training", "rest"]);
export type DayType = z.infer<typeof DayType>;

export const NutritionTargets = z.object({
  effectiveDate: LocalDate,
  training: Macros,
  rest: Macros,
  maintenanceKcal: z.object({ training: z.number(), rest: z.number() }),
  reason: z.string(),
});
export type NutritionTargets = z.infer<typeof NutritionTargets>;

// ---------- Meals ----------

export const MealRole = z.enum(["regular", "pre_workout", "post_workout", "bedtime"]);
export type MealRole = z.infer<typeof MealRole>;

export const MealOption = z.object({
  id: z.string(),
  /** home: cook it yourself. out: buy it ready to eat. */
  kind: z.enum(["home", "out"]),
  name: z.string(),
  summary: z.string(),
  /** Where to buy it, for kind "out". */
  place: z.string().nullable(),
  /** Exactly what to order or grab, for kind "out". */
  order: z.string().nullable(),
  ingredients: z.array(
    z.object({
      item: z.string(),
      /** As written in the recipe, e.g. "1 1/2 cups (340 g)". */
      amount: z.string(),
      /** The grocery item it is bought as, for totaling the week's shopping. */
      groceryId: z.string().nullable(),
      /** Amount in that grocery item's unit, as purchased (raw weight, dry rice). */
      quantity: z.number().nullable(),
    }),
  ),
  steps: z.array(z.string()),
  prepMinutes: z.number(),
  costUsd: z.number(),
  macros: Macros,
});
export type MealOption = z.infer<typeof MealOption>;

export const MenuSlot = z.object({
  dayType: DayType,
  slotIndex: z.number().int().min(0),
  label: z.string(),
  role: MealRole,
  targets: Macros,
  options: z.array(MealOption),
});
export type MenuSlot = z.infer<typeof MenuSlot>;

/** One thing to buy, totaled from the planned meals. */
export const GroceryItem = z.object({
  item: z.string(),
  /** What to buy, e.g. "2 x 32 oz tub". */
  quantity: z.string(),
  /** How much the plan uses, e.g. "about 3.4 lb"; null when untracked. */
  needed: z.string().nullable(),
  section: z.string(),
  costUsd: z.number(),
  /** A pantry item most kitchens already have: check before buying. */
  staple: z.boolean(),
});
export type GroceryItem = z.infer<typeof GroceryItem>;

/** How a grocery item is sold: the coach writes these once per menu. */
export const GroceryCatalogItem = z.object({
  id: z.string(),
  name: z.string(),
  section: z.string(),
  unit: z.enum(["g", "ml", "piece"]),
  /** For piece items, the plural noun for one unit: "slices", "cans", "eggs". */
  pieceName: z.string().optional(),
  packageSize: z.number().positive(),
  packageLabel: z.string(),
  packagePrice: z.number().min(0),
  staple: z.boolean(),
});
export type GroceryCatalogItem = z.infer<typeof GroceryCatalogItem>;

/** One cooking session: everything needed to prep a stretch of the week's planned meals. */
export const PrepSession = z.object({
  date: LocalDate,
  title: z.string(),
  /** Which meals it produces, e.g. "Sun–Wed lunches and dinners". */
  covers: z.string(),
  activeMinutes: z.number().int(),
  totalMinutes: z.number().int(),
  equipment: z.array(z.string()),
  /** Everything to take out before starting, with session totals. */
  ingredients: z.array(z.object({ item: z.string(), amount: z.string() })),
  steps: z.array(
    z.object({
      text: z.string(),
      /** A wait worth a timer (baking, simmering, resting); 0 when there's none. */
      timerMinutes: z.number().int().min(0),
      /** Optional detail: doneness checks, what to do meanwhile; empty when none. */
      tip: z.string(),
    }),
  ),
  /** One container per planned meal. */
  containers: z.array(
    z.object({
      label: z.string(),
      contents: z.string(),
      storage: z.enum(["fridge", "freezer"]),
      eatBy: LocalDate,
    }),
  ),
});
export type PrepSession = z.infer<typeof PrepSession>;

/** The week's meal-prep guide, written from the finished plan. */
export const PrepGuide = z.object({
  overview: z.string(),
  /** Things to do on a given day outside the cooking sessions: thawing, soaking, a quick top-up cook. */
  reminders: z.array(z.object({ date: LocalDate, time: TimeOfDay.nullable(), text: z.string() })),
  sessions: z.array(PrepSession),
  reheating: z.array(z.object({ dish: z.string(), instructions: z.string() })),
  foodSafety: z.array(z.string()),
  createdAt: z.string(),
  source: z.enum(["coach", "fallback"]),
});
export type PrepGuide = z.infer<typeof PrepGuide>;

/** The planned dish for each meal of one day. */
export const PlanDay = z.object({
  date: LocalDate,
  dayType: DayType,
  meals: z.array(z.object({ slotIndex: z.number().int().min(0), optionId: z.string() })),
});
export type PlanDay = z.infer<typeof PlanDay>;

export const MealMenu = z.object({
  id: z.number(),
  weekStart: LocalDate,
  createdAt: z.string(),
  source: z.enum(["coach", "fallback"]),
  slots: z.array(MenuSlot),
  /** One entry per remaining day of the week, each meal pointing at one of its slot's options. Empty on menus from before planning. */
  plan: z.array(PlanDay),
  /** Totaled from the plan's home-cooked meals. */
  groceryList: z.array(GroceryItem),
  prepTips: z.array(z.string()),
  /** The detailed prep guide, once written; null while it's being written or for older menus. */
  prepGuide: PrepGuide.nullable(),
  /** The plan changed after the guide was written, so its amounts may be off. */
  prepGuideStale: z.boolean(),
  /** A prep guide for this menu is being written right now. */
  prepGuidePending: z.boolean(),
  coachNote: z.string(),
});
export type MealMenu = z.infer<typeof MealMenu>;

export const MealLog = z.object({
  id: z.number(),
  date: LocalDate,
  slotIndex: z.number().int().nullable(),
  optionId: z.string().nullable(),
  name: z.string(),
  macros: Macros,
  status: z.enum(["eaten", "skipped"]),
  loggedAt: z.string(),
});
export type MealLog = z.infer<typeof MealLog>;

export const MealLogRequest = z.object({
  date: LocalDate,
  slotIndex: z.number().int().nullable(),
  optionId: z.string().nullable(),
  /** Required when optionId is null and status is eaten. */
  custom: z.object({ name: z.string().min(1), macros: Macros }).nullable(),
  status: z.enum(["eaten", "skipped"]),
});
export type MealLogRequest = z.infer<typeof MealLogRequest>;

// ---------- Training ----------

export const LoadType = z.enum(["dumbbell", "barbell", "smith", "cable", "machine", "plate_machine", "bodyweight"]);
export type LoadType = z.infer<typeof LoadType>;

export const SetLog = z.object({
  id: z.number(),
  weight: z.number().nullable(),
  reps: z.number().int().min(0),
  rir: z.number().int().min(0).max(5).nullable(),
  loggedAt: z.string(),
});
export type SetLog = z.infer<typeof SetLog>;

export const SessionSet = z.object({
  index: z.number().int(),
  /** Per dumbbell for dumbbell work; total load otherwise; null for bodyweight. */
  targetWeight: z.number().nullable(),
  targetReps: z.number().int(),
  targetRir: z.number().int(),
  log: SetLog.nullable(),
  /** Beyond the planned sets: added during the session. */
  extra: z.boolean(),
});
export type SessionSet = z.infer<typeof SessionSet>;

export const SessionExercise = z.object({
  id: z.number(),
  exerciseId: z.string(),
  name: z.string(),
  muscle: Muscle,
  loadType: LoadType,
  order: z.number().int(),
  repMin: z.number().int(),
  repMax: z.number().int(),
  sets: z.array(SessionSet),
  cues: z.string(),
  notes: z.string(),
  /** Plain-language reason for today's prescription, e.g. "Up 5 lb: you beat last week's target". */
  prescriptionNote: z.string(),
  /** The heaviest available weight is still light for the rep range. */
  maxedOut: z.boolean(),
  /** Every load available for this exercise at the session's location, ascending; empty for bodyweight. */
  loadOptions: z.array(z.number()),
  /** Suggested rest between sets: longer for compound lifts. */
  restSeconds: z.number().int(),
  lastTime: z
    .object({
      date: LocalDate,
      sets: z.array(z.object({ weight: z.number().nullable(), reps: z.number(), rir: z.number().nullable() })),
    })
    .nullable(),
  substitutedFrom: z.string().nullable(),
});
export type SessionExercise = z.infer<typeof SessionExercise>;

/** 0..2 low/moderate/amazing */
export const Pump = z.number().int().min(0).max(2);
/** 0..3 easy/just right/hard/too much */
export const Workload = z.number().int().min(0).max(3);
/** 0..3 never sore/healed a while ago/healed just in time/still sore */
export const Soreness = z.number().int().min(0).max(3);

export const MuscleFeedback = z.object({
  muscle: Muscle,
  soreness: Soreness.nullable(),
  pump: Pump.nullable(),
  workload: Workload.nullable(),
  jointPain: z.boolean(),
});
export type MuscleFeedback = z.infer<typeof MuscleFeedback>;

export const SessionStatus = z.enum(["planned", "in_progress", "completed", "skipped"]);
export type SessionStatus = z.infer<typeof SessionStatus>;

export const Session = z.object({
  id: z.number(),
  mesoId: z.number(),
  /** 0-based: week 0 is the first week of the block. */
  week: z.number().int(),
  dayIndex: z.number().int(),
  /** Hard weeks in the block; week === hardWeeks is the deload. */
  hardWeeks: z.number().int(),
  label: z.string(),
  location: Location,
  status: SessionStatus,
  date: LocalDate.nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  targetRir: z.number().int(),
  isDeload: z.boolean(),
  exercises: z.array(SessionExercise),
  feedback: z.array(MuscleFeedback),
  loadUnit: z.enum(["lb", "kg"]),
});
export type Session = z.infer<typeof Session>;

export const LogSetRequest = z.object({
  sessionExerciseId: z.number().int(),
  setIndex: z.number().int().min(0),
  weight: z.number().min(0).nullable(),
  reps: z.number().int().min(0).max(100),
  rir: z.number().int().min(0).max(5).nullable(),
});
export type LogSetRequest = z.infer<typeof LogSetRequest>;

export const MesoExercisePlan = z.object({
  exerciseId: z.string(),
  sets: z.number().int().min(1).max(5),
  repMin: z.number().int().min(3).max(30),
  repMax: z.number().int().min(4).max(35),
  /** First-session weight in the load unit, per dumbbell for dumbbell work. Null for bodyweight. */
  startWeight: z.number().min(0).nullable(),
  notes: z.string(),
});
export type MesoExercisePlan = z.infer<typeof MesoExercisePlan>;

export const MesoDayPlan = z.object({
  label: z.string(),
  location: Location,
  focus: z.string(),
  exercises: z.array(MesoExercisePlan).min(2).max(10),
});
export type MesoDayPlan = z.infer<typeof MesoDayPlan>;

export const MesoPlan = z.object({
  name: z.string(),
  split: z.string(),
  /** Hard weeks before the deload week. */
  weeks: z.number().int().min(3).max(6),
  rationale: z.string(),
  days: z.array(MesoDayPlan).min(2).max(6),
});
export type MesoPlan = z.infer<typeof MesoPlan>;

// ---------- Check-ins ----------

export const CheckIn = z.object({
  id: z.number(),
  weekStart: LocalDate,
  createdAt: z.string(),
  trendKg: z.number().nullable(),
  rateKgPerWeek: z.number().nullable(),
  targetRateKgPerWeek: z.number(),
  weighIns: z.number().int(),
  adjustmentKcal: z.number(),
  adjustmentReason: z.string(),
  sessionsCompleted: z.number().int(),
  sessionsPlanned: z.number().int(),
  mealAdherence: z.number().nullable(),
  coachNote: z.string().nullable(),
  userNote: z.string().nullable(),
});
export type CheckIn = z.infer<typeof CheckIn>;

// ---------- Jobs ----------

export const JobKind = z.enum(["mesocycle", "meal_menu", "prep_guide", "check_in_note", "more_options", "estimate_meal"]);
export type JobKind = z.infer<typeof JobKind>;

export const Job = z.object({
  id: z.number(),
  kind: JobKind,
  status: z.enum(["queued", "running", "succeeded", "failed"]),
  error: z.string().nullable(),
  result: z.unknown().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Job = z.infer<typeof Job>;

// ---------- Coach chat ----------

/** What a proposed change does. Each kind maps to one thing the app can already do. */
export const CoachActionKind = z.enum([
  "swap_meal",
  "log_meal",
  "replan_meals",
  "rewrite_prep_guide",
  "set_day_type",
  "set_workout_time",
  "swap_exercise",
  "set_session_location",
  "skip_session",
  "new_block",
  "save_note",
]);
export type CoachActionKind = z.infer<typeof CoachActionKind>;

/** A change the coach proposed in a reply. Nothing happens until it's applied. */
export const CoachAction = z.object({
  id: z.string(),
  kind: CoachActionKind,
  /** One line saying what applying it does. */
  summary: z.string(),
  /** A second line when useful: the note passed along, or how long the coach's work takes. */
  detail: z.string().nullable(),
  status: z.enum(["proposed", "applied", "dismissed"]),
  /** Once applied: the coach job it started (a re-plan, a prep guide, a block), if any. */
  jobId: z.number().nullable(),
});
export type CoachAction = z.infer<typeof CoachAction>;

export const CoachMessage = z.object({
  id: z.number(),
  threadId: z.number(),
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  /** A reply is pending while the coach writes it, and failed if it couldn't finish. */
  status: z.enum(["pending", "done", "failed"]),
  error: z.string().nullable(),
  actions: z.array(CoachAction),
  createdAt: z.string(),
});
export type CoachMessage = z.infer<typeof CoachMessage>;

export const CoachMessageRequest = z.object({
  /** null starts a new conversation. */
  threadId: z.number().int().positive().nullable(),
  text: z.string().trim().min(1).max(4000),
});
export type CoachMessageRequest = z.infer<typeof CoachMessageRequest>;

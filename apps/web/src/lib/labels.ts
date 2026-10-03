// Friendly names for enum values in the API contract.
import type { EquipmentItem, JobKind, Location, MealRole, Muscle, Profile, SessionStatus } from "@strike/core";
import { Building, House, type LucideIcon } from "lucide-react";

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: "Chest",
  back: "Back",
  traps: "Traps",
  front_delts: "Front delts",
  side_delts: "Side delts",
  rear_delts: "Rear delts",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  abs: "Abs",
};

export const EQUIPMENT_LABEL: Record<EquipmentItem, string> = {
  bench_flat: "Flat bench",
  bench_adjustable: "Adjustable bench",
  pullup_bar: "Pull-up bar",
  dip_station: "Dip station",
  cable: "Cable station",
  lat_pulldown: "Lat pulldown",
  seated_row: "Seated row",
  leg_press: "Leg press",
  leg_extension: "Leg extension",
  leg_curl: "Leg curl",
  smith_machine: "Smith machine",
  barbell: "Barbell and plates",
  chest_press_machine: "Chest press machine",
  shoulder_press_machine: "Shoulder press machine",
  pec_deck: "Pec deck",
};

export type KitchenItem = Profile["nutrition"]["kitchen"][number];
export const KITCHEN_LABEL: Record<KitchenItem, string> = {
  microwave: "Microwave",
  stove: "Stove",
  oven: "Oven",
  air_fryer: "Air fryer",
  rice_cooker: "Rice cooker",
  blender: "Blender",
  slow_cooker: "Slow cooker",
  grill: "Grill",
};

export const ACTIVITY_LABEL: Record<Profile["activityLevel"], { label: string; hint: string }> = {
  sedentary: { label: "Sedentary", hint: "Desk job, under 5k steps" },
  light: { label: "Light", hint: "5 to 8k steps" },
  moderate: { label: "Moderate", hint: "8 to 12k steps" },
  active: { label: "Active", hint: "12k+ steps or on your feet" },
  very_active: { label: "Very active", hint: "Physical job" },
};

export const EXPERIENCE_LABEL: Record<Profile["training"]["experience"], { label: string; hint: string }> = {
  beginner: { label: "Beginner", hint: "Under a year of consistent lifting" },
  intermediate: { label: "Intermediate", hint: "1 to 4 years" },
  advanced: { label: "Advanced", hint: "4+ years, slow gains" },
};

export const DIET_LABEL: Record<Profile["nutrition"]["dietStyle"], string> = {
  omnivore: "Omnivore",
  pescatarian: "Pescatarian",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
};

export const COOKING_LABEL: Record<Profile["nutrition"]["cookingTime"], { label: string; hint: string }> = {
  minimal: { label: "Minimal", hint: "Assemble, microwave, done" },
  moderate: { label: "Some", hint: "Up to 30 minutes" },
  enjoys: { label: "Enjoys cooking", hint: "Happy to spend time" },
};

export const GOAL_LABEL: Record<Profile["goal"]["type"], string> = {
  lose: "Lose fat",
  maintain: "Maintain",
  gain: "Build muscle",
};

export const LOCATION_LABEL: Record<Location, string> = { home: "Home", gym: "Gym" };
export const LOCATION_ICON: Record<Location, LucideIcon> = { home: House, gym: Building };

export const ROLE_LABEL: Record<MealRole, string | null> = {
  regular: null,
  pre_workout: "Pre-workout",
  post_workout: "Post-workout",
  bedtime: "Before bed",
};

/** Role tag for a meal slot, or null when the slot label already says it ("Pre-workout"). */
export function roleTag(role: MealRole, label: string): string | null {
  const tag = ROLE_LABEL[role];
  return tag && tag.toLowerCase() !== label.trim().toLowerCase() ? tag : null;
}

export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  completed: "Done",
  skipped: "Skipped",
};

export const SORENESS_OPTIONS = ["Never sore", "Healed a while ago", "Healed just in time", "Still sore"] as const;
export const PUMP_OPTIONS = ["Low", "Moderate", "Amazing"] as const;
export const WORKLOAD_OPTIONS = ["Easy", "Just right", "Hard", "Too much"] as const;

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export const JOB_LABEL: Record<JobKind, string> = {
  mesocycle: "Writing your training block",
  meal_menu: "Planning this week's meals",
  check_in_note: "Writing your check-in note",
  more_options: "Finding more meal options",
  estimate_meal: "Estimating your meal",
};

import type { EquipmentItem, LoadType, Muscle } from "./schemas.ts";

/**
 * What an exercise needs. "dumbbells" means any dumbbell set; "bench" is satisfied by a flat or an
 * adjustable bench; "incline_bench" only by an adjustable one. Every listed requirement must be met.
 */
export type Requirement = EquipmentItem | "dumbbells" | "bench" | "incline_bench";

export type Pattern =
  | "horizontal_push"
  | "incline_push"
  | "vertical_push"
  | "fly"
  | "dip"
  | "vertical_pull"
  | "horizontal_pull"
  | "pullover"
  | "shrug"
  | "front_raise"
  | "lateral_raise"
  | "rear_delt"
  | "curl"
  | "triceps_extension"
  | "forearm"
  | "squat"
  | "lunge"
  | "knee_extension"
  | "hinge"
  | "knee_flexion"
  | "hip_thrust"
  | "calf_raise"
  | "core";

export interface Exercise {
  id: string;
  name: string;
  primary: Muscle;
  secondary: Muscle[];
  requires: Requirement[];
  loadType: LoadType;
  pattern: Pattern;
  repMin: number;
  repMax: number;
  /**
   * Rough 10-rep-max as a fraction of body weight for an intermediate man, per dumbbell for dumbbell
   * work and per side for cable work. Only seeds the first session; logged sets take over after.
   */
  ratio: number;
  cues: string;
}

const ex = (
  id: string,
  name: string,
  primary: Muscle,
  secondary: Muscle[],
  requires: Requirement[],
  loadType: LoadType,
  pattern: Pattern,
  reps: [number, number],
  ratio: number,
  cues: string,
): Exercise => ({ id, name, primary, secondary, requires, loadType, pattern, repMin: reps[0], repMax: reps[1], ratio, cues });

/** Within each muscle, earlier entries are preferred when the fallback planner picks exercises. */
export const EXERCISES: readonly Exercise[] = [
  // Chest
  ex("db_bench_press", "Dumbbell Bench Press", "chest", ["triceps", "front_delts"], ["dumbbells", "bench"], "dumbbell", "horizontal_push", [8, 12], 0.35, "Shoulder blades pinned back, lower until the dumbbells are level with your chest, press up and slightly in."),
  ex("db_incline_press", "Incline Dumbbell Press", "chest", ["front_delts", "triceps"], ["dumbbells", "incline_bench"], "dumbbell", "incline_push", [8, 12], 0.3, "Bench at 30°. Elbows about 45° from your sides; get a deep stretch at the bottom."),
  ex("machine_chest_press", "Machine Chest Press", "chest", ["triceps", "front_delts"], ["chest_press_machine"], "machine", "horizontal_push", [8, 12], 0.8, "Handles at mid-chest. Control the stretch; don't let the stack touch between reps."),
  ex("smith_bench_press", "Smith Machine Bench Press", "chest", ["triceps", "front_delts"], ["smith_machine", "bench"], "smith", "horizontal_push", [6, 10], 0.8, "Bar path to lower chest. Total weight includes the bar."),
  ex("smith_incline_press", "Smith Machine Incline Press", "chest", ["front_delts", "triceps"], ["smith_machine", "incline_bench"], "smith", "incline_push", [6, 10], 0.65, "Bench at 30°, bar to upper chest. Total weight includes the bar."),
  ex("barbell_bench_press", "Barbell Bench Press", "chest", ["triceps", "front_delts"], ["barbell", "bench"], "barbell", "horizontal_push", [5, 8], 0.9, "Use safeties. Touch mid-chest, press back over your shoulders. Total weight includes the 45 lb bar."),
  ex("cable_fly", "Cable Fly", "chest", ["front_delts"], ["cable"], "cable", "fly", [10, 15], 0.15, "Slight elbow bend, big stretch, bring hands together at chest height. Weight is per side."),
  ex("pec_deck_fly", "Pec Deck Fly", "chest", [], ["pec_deck"], "machine", "fly", [10, 15], 0.6, "Seat so handles are at chest height. Squeeze, then a slow stretch."),
  ex("db_fly", "Dumbbell Fly", "chest", ["front_delts"], ["dumbbells", "bench"], "dumbbell", "fly", [10, 15], 0.15, "Soft elbows, lower until you feel a deep chest stretch, hug a tree on the way up."),
  ex("push_up", "Push-Up", "chest", ["triceps", "front_delts"], [], "bodyweight", "horizontal_push", [8, 25], 0, "Body in a straight line, chest to an inch off the floor. Elevate your feet once 25 is easy."),
  ex("dip_chest", "Chest Dip", "chest", ["triceps", "front_delts"], ["dip_station"], "bodyweight", "dip", [6, 15], 0, "Lean forward slightly, lower until a good chest stretch, press up."),

  // Back
  ex("pull_up", "Pull-Up", "back", ["biceps", "rear_delts"], ["pullup_bar"], "bodyweight", "vertical_pull", [5, 12], 0, "Hands just outside shoulders. Start from a dead hang, pull your chest toward the bar."),
  ex("chin_up", "Chin-Up", "back", ["biceps"], ["pullup_bar"], "bodyweight", "vertical_pull", [5, 12], 0, "Palms facing you, shoulder width. Full hang at the bottom."),
  ex("lat_pulldown", "Lat Pulldown", "back", ["biceps", "rear_delts"], ["lat_pulldown"], "machine", "vertical_pull", [8, 12], 0.8, "Slightly wider than shoulders, pull to upper chest, let the lats stretch fully at the top."),
  ex("close_grip_pulldown", "Close-Grip Pulldown", "back", ["biceps"], ["lat_pulldown"], "machine", "vertical_pull", [8, 12], 0.8, "Neutral close grip, drive elbows down to your sides."),
  ex("one_arm_db_row", "One-Arm Dumbbell Row", "back", ["biceps", "rear_delts"], ["dumbbells", "bench"], "dumbbell", "horizontal_pull", [8, 12], 0.4, "Hand and knee on the bench, pull the dumbbell to your hip, stretch long at the bottom."),
  ex("chest_supported_db_row", "Chest-Supported Dumbbell Row", "back", ["rear_delts", "biceps"], ["dumbbells", "incline_bench"], "dumbbell", "horizontal_pull", [8, 12], 0.3, "Chest on a 30–45° bench, row both dumbbells to your lower ribs."),
  ex("seated_cable_row", "Seated Cable Row", "back", ["biceps", "rear_delts"], ["seated_row"], "machine", "horizontal_pull", [8, 12], 0.8, "Tall chest, pull to your stomach, let your shoulders reach forward on the stretch."),
  ex("cable_row", "Cable Row", "back", ["biceps", "rear_delts"], ["cable"], "cable", "horizontal_pull", [8, 12], 0.6, "Seated or kneeling at a low pulley; pull to your stomach."),
  ex("barbell_row", "Barbell Row", "back", ["biceps", "rear_delts"], ["barbell"], "barbell", "horizontal_pull", [6, 10], 0.8, "Hinge to about 45°, pull the bar to your lower ribs without jerking."),
  ex("inverted_row", "Inverted Row", "back", ["biceps", "rear_delts"], ["smith_machine"], "bodyweight", "horizontal_pull", [8, 15], 0, "Bar at hip height, body straight, pull chest to the bar."),
  ex("db_pullover", "Dumbbell Pullover", "back", ["chest"], ["dumbbells", "bench"], "dumbbell", "pullover", [10, 15], 0.25, "One dumbbell held with both hands, arms nearly straight, deep stretch overhead."),
  ex("straight_arm_pulldown", "Straight-Arm Cable Pulldown", "back", [], ["cable"], "cable", "pullover", [10, 15], 0.35, "Arms nearly straight, sweep the bar to your thighs, feel the lats."),

  // Traps
  ex("db_shrug", "Dumbbell Shrug", "traps", ["forearms"], ["dumbbells"], "dumbbell", "shrug", [10, 15], 0.5, "Shrug straight up toward your ears, pause, lower slowly."),
  ex("barbell_shrug", "Barbell Shrug", "traps", ["forearms"], ["barbell"], "barbell", "shrug", [10, 15], 1.2, "Straight up and down, one-second hold at the top."),

  // Shoulders
  ex("seated_db_shoulder_press", "Seated Dumbbell Shoulder Press", "front_delts", ["side_delts", "triceps"], ["dumbbells", "incline_bench"], "dumbbell", "vertical_push", [8, 12], 0.25, "Bench upright, lower to ear level, press without clanking at the top."),
  ex("standing_db_shoulder_press", "Standing Dumbbell Shoulder Press", "front_delts", ["side_delts", "triceps"], ["dumbbells"], "dumbbell", "vertical_push", [8, 12], 0.22, "Brace your abs and glutes; press overhead without leaning back."),
  ex("machine_shoulder_press", "Machine Shoulder Press", "front_delts", ["side_delts", "triceps"], ["shoulder_press_machine"], "machine", "vertical_push", [8, 12], 0.6, "Handles at ear level at the bottom; control the descent."),
  ex("smith_shoulder_press", "Smith Machine Shoulder Press", "front_delts", ["side_delts", "triceps"], ["smith_machine", "incline_bench"], "smith", "vertical_push", [6, 10], 0.5, "Seated, bar to chin level. Total weight includes the bar."),
  ex("barbell_overhead_press", "Barbell Overhead Press", "front_delts", ["side_delts", "triceps"], ["barbell"], "barbell", "vertical_push", [5, 8], 0.55, "Squeeze glutes, press up and back over your head. Total weight includes the bar."),
  ex("db_front_raise", "Dumbbell Front Raise", "front_delts", [], ["dumbbells"], "dumbbell", "front_raise", [10, 15], 0.1, "Raise to eye level with a soft elbow, lower slowly."),
  ex("db_lateral_raise", "Dumbbell Lateral Raise", "side_delts", [], ["dumbbells"], "dumbbell", "lateral_raise", [12, 20], 0.1, "Lead with your elbows, raise to shoulder height, slight forward lean."),
  ex("cable_lateral_raise", "Cable Lateral Raise", "side_delts", [], ["cable"], "cable", "lateral_raise", [12, 20], 0.07, "Pulley low, cable behind you, raise out to the side to shoulder height."),
  ex("db_y_raise", "Incline Dumbbell Y-Raise", "side_delts", ["rear_delts", "traps"], ["dumbbells", "incline_bench"], "dumbbell", "lateral_raise", [12, 20], 0.06, "Chest on a 30° bench, raise the dumbbells in a Y with thumbs up."),
  ex("db_rear_delt_fly", "Bent-Over Dumbbell Rear Delt Fly", "rear_delts", ["traps"], ["dumbbells"], "dumbbell", "rear_delt", [12, 20], 0.1, "Hinge forward, arms slightly bent, sweep out wide, don't squeeze the shoulder blades."),
  ex("reverse_pec_deck", "Reverse Pec Deck", "rear_delts", ["traps"], ["pec_deck"], "machine", "rear_delt", [12, 20], 0.4, "Face the pad, arms out wide, push the handles back with your rear delts."),
  ex("face_pull", "Cable Face Pull", "rear_delts", ["traps"], ["cable"], "cable", "rear_delt", [12, 20], 0.4, "Rope at face height, pull toward your forehead with elbows high."),
  ex("incline_db_rear_delt_raise", "Incline Dumbbell Rear Delt Raise", "rear_delts", [], ["dumbbells", "incline_bench"], "dumbbell", "rear_delt", [12, 20], 0.08, "Chest on the bench, raise the dumbbells straight out to the sides."),

  // Biceps
  ex("db_curl", "Dumbbell Curl", "biceps", ["forearms"], ["dumbbells"], "dumbbell", "curl", [8, 15], 0.16, "Elbows pinned to your sides, curl up, lower for a full stretch."),
  ex("incline_db_curl", "Incline Dumbbell Curl", "biceps", [], ["dumbbells", "incline_bench"], "dumbbell", "curl", [8, 15], 0.13, "Lean back on a 45–60° bench, arms hanging behind you for a long stretch."),
  ex("hammer_curl", "Hammer Curl", "biceps", ["forearms"], ["dumbbells"], "dumbbell", "curl", [8, 15], 0.18, "Neutral grip, curl to your shoulder."),
  ex("cable_curl", "Cable Curl", "biceps", [], ["cable"], "cable", "curl", [10, 15], 0.35, "Low pulley, straight bar or rope, keep elbows still."),
  ex("barbell_curl", "Barbell Curl", "biceps", ["forearms"], ["barbell"], "barbell", "curl", [8, 12], 0.4, "Shoulder-width grip, no swinging."),
  ex("db_preacher_curl", "Dumbbell Preacher Curl", "biceps", [], ["dumbbells", "incline_bench"], "dumbbell", "curl", [10, 15], 0.12, "Arm over the back of an upright bench, curl one side at a time."),

  // Triceps
  ex("db_overhead_extension", "Dumbbell Overhead Triceps Extension", "triceps", [], ["dumbbells"], "dumbbell", "triceps_extension", [10, 15], 0.3, "Hold one dumbbell with both hands, lower behind your head for a deep stretch."),
  ex("db_skull_crusher", "Dumbbell Skull Crusher", "triceps", [], ["dumbbells", "bench"], "dumbbell", "triceps_extension", [10, 15], 0.12, "Lying on the bench, lower the dumbbells beside your head, elbows pointing up."),
  ex("cable_pushdown", "Cable Triceps Pushdown", "triceps", [], ["cable"], "cable", "triceps_extension", [10, 15], 0.4, "Elbows at your sides, push down to full lockout."),
  ex("cable_overhead_extension", "Cable Overhead Triceps Extension", "triceps", [], ["cable"], "cable", "triceps_extension", [10, 15], 0.35, "Face away from the pulley, rope behind your head, extend forward and up."),
  ex("close_grip_push_up", "Close-Grip Push-Up", "triceps", ["chest"], [], "bodyweight", "horizontal_push", [8, 25], 0, "Hands under your shoulders, elbows brushing your sides."),
  ex("dip_triceps", "Triceps Dip", "triceps", ["chest"], ["dip_station"], "bodyweight", "dip", [6, 15], 0, "Torso upright, lower until elbows reach 90°, press to lockout."),
  ex("db_kickback", "Dumbbell Kickback", "triceps", [], ["dumbbells", "bench"], "dumbbell", "triceps_extension", [12, 20], 0.08, "Upper arm parallel to the floor, extend fully and squeeze."),
  ex("smith_close_grip_press", "Smith Machine Close-Grip Press", "triceps", ["chest"], ["smith_machine", "bench"], "smith", "horizontal_push", [6, 10], 0.7, "Hands shoulder width, elbows tucked. Total weight includes the bar."),

  // Forearms
  ex("db_wrist_curl", "Dumbbell Wrist Curl", "forearms", [], ["dumbbells", "bench"], "dumbbell", "forearm", [12, 20], 0.15, "Forearms on the bench, let the dumbbells roll to your fingertips, curl up."),

  // Quads
  ex("leg_press", "Leg Press", "quads", ["glutes"], ["leg_press"], "plate_machine", "squat", [8, 15], 2, "Feet shoulder width, mid-platform; go as deep as your lower back stays flat. Count only the plates you add."),
  ex("goblet_squat", "Goblet Squat", "quads", ["glutes"], ["dumbbells"], "dumbbell", "squat", [8, 15], 0.4, "Hold one dumbbell at your chest, sit down between your heels, chest tall."),
  ex("heel_elevated_db_squat", "Heel-Elevated Dumbbell Squat", "quads", ["glutes"], ["dumbbells"], "dumbbell", "squat", [10, 15], 0.3, "Heels on a plate or wedge, dumbbells at your sides, knees travel forward."),
  ex("bulgarian_split_squat", "Bulgarian Split Squat", "quads", ["glutes"], ["dumbbells", "bench"], "dumbbell", "lunge", [8, 12], 0.2, "Rear foot on the bench, front shin fairly upright, sink straight down. Reps per leg."),
  ex("db_reverse_lunge", "Dumbbell Reverse Lunge", "quads", ["glutes"], ["dumbbells"], "dumbbell", "lunge", [8, 12], 0.22, "Step back, back knee to just above the floor, drive through the front foot. Reps per leg."),
  ex("db_step_up", "Dumbbell Step-Up", "quads", ["glutes"], ["dumbbells", "bench"], "dumbbell", "lunge", [8, 12], 0.2, "Whole foot on the bench, push through the heel, control the way down. Reps per leg."),
  ex("leg_extension", "Leg Extension", "quads", [], ["leg_extension"], "machine", "knee_extension", [10, 15], 0.6, "Knee lined up with the pivot, pause at the top, slow down."),
  ex("smith_squat", "Smith Machine Squat", "quads", ["glutes"], ["smith_machine"], "smith", "squat", [6, 10], 1.0, "Feet slightly forward of the bar, squat deep. Total weight includes the bar."),
  ex("barbell_back_squat", "Barbell Back Squat", "quads", ["glutes"], ["barbell"], "barbell", "squat", [5, 8], 1.1, "Use the safeties. Brace, sit down between your hips, drive up. Total weight includes the bar."),

  // Hamstrings
  ex("db_romanian_deadlift", "Dumbbell Romanian Deadlift", "hamstrings", ["glutes"], ["dumbbells"], "dumbbell", "hinge", [8, 12], 0.4, "Soft knees, push your hips back until a deep hamstring stretch, flat back."),
  ex("single_leg_db_rdl", "Single-Leg Dumbbell RDL", "hamstrings", ["glutes"], ["dumbbells"], "dumbbell", "hinge", [8, 12], 0.25, "Hinge on one leg, the other leg goes back as a counterweight. Reps per leg."),
  ex("leg_curl", "Leg Curl", "hamstrings", [], ["leg_curl"], "machine", "knee_flexion", [10, 15], 0.45, "Knee lined up with the pivot, curl fully, slow on the way back."),
  ex("barbell_rdl", "Barbell Romanian Deadlift", "hamstrings", ["glutes"], ["barbell"], "barbell", "hinge", [6, 10], 1.0, "Bar close to your legs, hips back, flat back. Total weight includes the bar."),
  ex("smith_rdl", "Smith Machine Romanian Deadlift", "hamstrings", ["glutes"], ["smith_machine"], "smith", "hinge", [8, 12], 0.9, "Hips back, bar slides down your thighs. Total weight includes the bar."),
  ex("db_leg_curl", "Dumbbell Lying Leg Curl", "hamstrings", [], ["dumbbells", "bench"], "dumbbell", "knee_flexion", [10, 15], 0.12, "Face down on the bench, dumbbell held between your feet, curl slowly."),

  // Glutes
  ex("db_hip_thrust", "Dumbbell Hip Thrust", "glutes", ["hamstrings"], ["dumbbells", "bench"], "dumbbell", "hip_thrust", [10, 15], 0.6, "Upper back on the bench, dumbbell on your hips, drive up and squeeze for a second."),
  ex("smith_hip_thrust", "Smith Machine Hip Thrust", "glutes", ["hamstrings"], ["smith_machine", "bench"], "smith", "hip_thrust", [8, 12], 1.0, "Pad the bar, upper back on the bench, full lockout. Total weight includes the bar."),
  ex("barbell_hip_thrust", "Barbell Hip Thrust", "glutes", ["hamstrings"], ["barbell", "bench"], "barbell", "hip_thrust", [8, 12], 1.2, "Pad the bar, chin tucked, squeeze hard at the top. Total weight includes the bar."),
  ex("cable_pull_through", "Cable Pull-Through", "glutes", ["hamstrings"], ["cable"], "cable", "hinge", [10, 15], 0.5, "Face away from a low pulley, hinge back, snap your hips forward."),
  ex("db_glute_bridge", "Dumbbell Glute Bridge", "glutes", ["hamstrings"], ["dumbbells"], "dumbbell", "hip_thrust", [12, 20], 0.6, "On the floor, dumbbell on your hips, drive up through your heels."),

  // Calves
  ex("single_leg_db_calf_raise", "Single-Leg Dumbbell Calf Raise", "calves", [], ["dumbbells"], "dumbbell", "calf_raise", [10, 20], 0.25, "Ball of the foot on a step, full stretch at the bottom, pause, rise. Reps per leg."),
  ex("leg_press_calf_raise", "Leg Press Calf Raise", "calves", [], ["leg_press"], "plate_machine", "calf_raise", [10, 20], 1.6, "Balls of the feet on the platform edge, deep stretch, full push."),
  ex("smith_calf_raise", "Smith Machine Calf Raise", "calves", [], ["smith_machine"], "smith", "calf_raise", [10, 20], 1.0, "Stand on a plate, pause in the stretch. Total weight includes the bar."),
  ex("seated_db_calf_raise", "Seated Dumbbell Calf Raise", "calves", [], ["dumbbells", "bench"], "dumbbell", "calf_raise", [12, 20], 0.4, "Seated, dumbbells on your knees, balls of the feet on a plate."),

  // Abs
  ex("cable_crunch", "Cable Crunch", "abs", [], ["cable"], "cable", "core", [10, 20], 0.5, "Kneel facing the stack, rope behind your head, curl your ribs to your hips."),
  ex("hanging_knee_raise", "Hanging Knee Raise", "abs", [], ["pullup_bar"], "bodyweight", "core", [8, 20], 0, "Hang, curl your knees toward your chest, tilt your pelvis up."),
  ex("db_weighted_crunch", "Weighted Crunch", "abs", [], ["dumbbells"], "dumbbell", "core", [10, 20], 0.15, "Hold a dumbbell on your chest, curl your ribs toward your hips."),
  ex("lying_leg_raise", "Lying Leg Raise", "abs", [], [], "bodyweight", "core", [10, 20], 0, "Lower back pressed into the floor, lower your legs slowly."),
];

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise | undefined {
  return BY_ID.get(id);
}

export function requireExercise(id: string): Exercise {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown exercise: ${id}`);
  return found;
}

export const EXERCISE_IDS = EXERCISES.map((e) => e.id) as [string, ...string[]];

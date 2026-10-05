// How to do each exercise in the library well: a short written guide and one technique video.
// Shown when an exercise is opened during a workout. Videos are embeddable YouTube videos from
// established coaching channels, checked against YouTube's oEmbed endpoint when chosen
// (https://www.youtube.com/oembed?url=<watch url>&format=json answers 200 only for public, embeddable
// videos). An exercise added to the library needs a guide here; the core tests enforce it.

export interface ExerciseVideo {
  youtubeId: string;
  title: string;
  channel: string;
  /** Length of the whole video. */
  seconds: number;
  /** Where this exercise's technique starts, for videos that cover more than one thing. */
  start: number;
}

export interface ExerciseGuide {
  /** Getting into position: equipment, grip, stance, brace. */
  setup: string[];
  /** One rep, start to finish. */
  steps: string[];
  /** The usual errors, each phrased as the fix. */
  mistakes: string[];
  video: ExerciseVideo;
}

export const EXERCISE_GUIDES: Readonly<Record<string, ExerciseGuide>> = {
  // Chest
  db_bench_press: {
    setup: [
      "Sit on the end of a flat bench with the dumbbells resting on your thighs.",
      "Lie back and use your knees to help kick the dumbbells up to your chest.",
      "Pin your shoulder blades back and down into the bench and plant your feet flat.",
    ],
    steps: [
      "Start with the dumbbells over your shoulders, arms straight but not locked hard.",
      "Lower them slowly, over 2–3 seconds, with your elbows about 45° from your sides.",
      "Stop when the dumbbells are level with your chest and you feel a stretch across your pecs.",
      "Press up and slightly in so they finish over your shoulders without clanking together.",
    ],
    mistakes: [
      "Don't let your elbows flare to 90°; keep them about 45° from your sides.",
      "Don't cut the rep short; lower until the dumbbells are level with your chest every time.",
      "Don't let your shoulders roll forward at the top; keep your shoulder blades pinned.",
      "Don't drop into the bottom; lower under control and press from a steady stretch.",
    ],
    video: { youtubeId: "Y_7aHqXeCfQ", title: "How To: Dumbbell Bench Press | 3 GOLDEN RULES", channel: "ScottHermanFitness", seconds: 561, start: 0 },
  },
  db_incline_press: {
    setup: [
      "Set an adjustable bench to about 30°.",
      "Sit with the dumbbells on your thighs, then kick them up one at a time as you lie back.",
      "Pull your shoulder blades back and down into the bench and plant your feet.",
    ],
    steps: [
      "Start with the dumbbells over your upper chest, arms straight but not locked hard.",
      "Lower them slowly, over 2–3 seconds, with your elbows about 45° from your sides.",
      "Go down until the dumbbells are beside your upper chest and you feel a deep stretch.",
      "Press up and slightly in, stopping just before the dumbbells touch.",
    ],
    mistakes: [
      "Don't set the bench too steep; much past 30° shifts the work to your shoulders.",
      "Don't stop halfway down; lower until you feel a deep stretch in your chest.",
      "Don't flare your elbows straight out; keep them about 45° from your sides.",
      "Don't let your butt or shoulders lift off the bench as you press.",
    ],
    video: { youtubeId: "0f6-uCUKqgA", title: "Incline Dumbbell Press BETTER | Targeting The Muscle Series", channel: "Renaissance Periodization", seconds: 452, start: 0 },
  },
  machine_chest_press: {
    setup: [
      "Adjust the seat so the handles line up with your mid-chest.",
      "If the handle depth adjusts, set it so you start in a deep chest stretch without shoulder strain.",
      "Sit with your back on the pad, shoulder blades pulled back, and feet planted.",
      "Grip the handles with straight wrists and your elbows a little below shoulder height.",
    ],
    steps: [
      "Press the handles forward until your arms are straight but not locked hard.",
      "Let the handles come back slowly, over 2–3 seconds.",
      "Keep going until you feel a full stretch across your chest, shoulder blades still back.",
      "Turn the rep around just before the weight stack touches, then press again.",
    ],
    mistakes: [
      "Don't let the stack touch between reps; stop just short to keep tension on your chest.",
      "Don't let your shoulders roll forward as you press; keep your back flat on the pad.",
      "Don't set the seat too high or low; the handles should sit at mid-chest.",
      "Don't bounce out of the stretch; control it, then press.",
    ],
    video: { youtubeId: "SUdQ1roIWz0", title: "Get The Most Out Of Chest Machines | Targeting The Muscle", channel: "Renaissance Periodization", seconds: 546, start: 0 },
  },
  smith_bench_press: {
    setup: [
      "Slide a flat bench under the bar so it lines up with your lower chest.",
      "Set the safety stops just below where the bar will touch your chest.",
      "Grip the bar a bit wider than shoulder width and pull your shoulder blades back and down.",
      "Plant your feet flat on the floor.",
    ],
    steps: [
      "Twist the bar off the hooks and hold it over your lower chest with straight arms.",
      "Lower it slowly, over 2–3 seconds, with your elbows about 45° from your sides.",
      "Touch your lower chest lightly without bouncing.",
      "Press straight up until your arms are straight, then repeat.",
    ],
    mistakes: [
      "Don't leave the bench in the wrong spot; move it until the bar lands on your lower chest.",
      "Don't bounce the bar off your chest; touch lightly and press.",
      "Don't flare your elbows to 90°; keep them about 45° from your sides.",
    ],
    video: { youtubeId: "z_r6hDOYtO0", title: "How To: Smith Machine- Bench Press", channel: "ScottHermanFitness", seconds: 114, start: 0 },
  },
  smith_incline_press: {
    setup: [
      "Set an adjustable bench to about 30° and slide it under the bar.",
      "Position the bench so the bar comes down on your upper chest, just below your collarbones.",
      "Set the safety stops just below where the bar will touch.",
      "Grip a bit wider than shoulder width and pull your shoulder blades back and down.",
    ],
    steps: [
      "Twist the bar off the hooks and hold it over your upper chest with straight arms.",
      "Lower it slowly, over 2–3 seconds, with your elbows about 45° from your sides.",
      "Touch your upper chest lightly without bouncing.",
      "Press straight up until your arms are straight, keeping your shoulder blades pinned.",
    ],
    mistakes: [
      "Don't set the bench too steep; about 30° keeps the work on your upper chest.",
      "Don't let the bar land on your mid-chest or neck; move the bench until it hits your upper chest.",
      "Don't bounce out of the bottom; lower under control, then press.",
      "Don't flare your elbows straight out; keep them about 45° from your sides.",
    ],
    video: { youtubeId: "b8DqTO6ak0k", title: "How To: Smith Machine- Incline Bench Press", channel: "ScottHermanFitness", seconds: 85, start: 0 },
  },
  barbell_bench_press: {
    setup: [
      "Set the safety arms just below your chest height when you're lying on the bench.",
      "Lie with your eyes under the bar and grip it a bit wider than shoulder width.",
      "Pull your shoulder blades back and down, keep a slight arch, and plant your feet.",
      "Unrack the bar with straight arms and bring it over your shoulders.",
    ],
    steps: [
      "Take a breath and brace before each rep.",
      "Lower the bar slowly, over 2–3 seconds, toward your mid-chest.",
      "Keep your elbows about 45° from your sides and your wrists stacked over your elbows.",
      "Touch your mid-chest lightly without bouncing.",
      "Press up and slightly back so the bar finishes over your shoulders.",
    ],
    mistakes: [
      "Don't bench without safeties; set them so a missed rep rests on them, not on you.",
      "Don't bounce the bar off your chest; touch lightly and press.",
      "Don't flare your elbows to 90°; keep them about 45° from your sides.",
      "Don't let your butt lift off the bench as you press.",
    ],
    video: { youtubeId: "4Y2ZdHCOXok", title: "How to PROPERLY Bench Press for Growth (5 Easy Steps)", channel: "Jeremy Ethier", seconds: 485, start: 0 },
  },
  cable_fly: {
    setup: [
      "Set both pulleys to about chest height and attach a single handle to each.",
      "Grab the handles and step forward into a split stance with a slight forward lean.",
      "Lift your chest, pull your shoulders down, and set a slight bend in your elbows.",
    ],
    steps: [
      "Start with your arms open wide and hands at chest height, feeling a big stretch.",
      "Sweep your hands forward in a wide arc, keeping the same elbow bend.",
      "Bring your hands together in front of your chest and squeeze for a moment.",
      "Open your arms slowly, over 2–3 seconds, back into the full stretch.",
    ],
    mistakes: [
      "Don't bend and straighten your elbows; keep the same slight bend so it stays a fly.",
      "Don't cut the stretch short; let your arms open until your chest is fully stretched.",
      "Don't let your shoulders roll forward as your hands meet; keep your chest up.",
      "Don't stand too close to the pulleys; step forward so the weight stays lifted at the stretch.",
    ],
    video: { youtubeId: "T7unVbaT7bM", title: "How to Sternal Cable Fly (Mid-Chest) | Form Tutorial", channel: "Physique Development", seconds: 128, start: 0 },
  },
  pec_deck_fly: {
    setup: [
      "Adjust the seat so the handles are at chest height and your arms are level with the floor.",
      "Set the handle start position so you get a deep chest stretch without your shoulders rolling forward.",
      "Sit tall with your back on the pad, chest up, and shoulders down.",
      "Grip the handles with a slight bend in your elbows.",
    ],
    steps: [
      "Bring the handles together in a wide arc in front of your chest.",
      "Squeeze your chest for a moment when the handles meet.",
      "Let the handles open slowly, over 2–3 seconds.",
      "Stop when you feel a full stretch across your chest, then start the next rep.",
    ],
    mistakes: [
      "Don't let your shoulders roll forward as the handles meet; keep your back on the pad.",
      "Don't let the handles fly back; take the stretch slowly.",
      "Don't set the handles so far back that you feel it in the front of your shoulders.",
      "Don't bend and straighten your elbows; keep the same slight bend throughout.",
    ],
    video: { youtubeId: "3jYo5cMU3d4", title: "The Chest PEC DEC FLY | Exercise Form Guide", channel: "Max Euceda", seconds: 168, start: 0 },
  },
  db_fly: {
    setup: [
      "Lie on a flat bench with a dumbbell in each hand and your feet flat on the floor.",
      "Press the dumbbells up over your chest with your palms facing each other.",
      "Soften your elbows into a slight bend and keep that bend for the whole set.",
      "Pull your shoulder blades back and down into the bench.",
    ],
    steps: [
      "Lower the dumbbells out to your sides in a wide arc, over 2–3 seconds.",
      "Stop when you feel a deep chest stretch, usually with your elbows about level with the bench.",
      "Bring them back up along the same arc, like hugging a tree.",
      "Stop just before the dumbbells touch over your chest, then start the next rep.",
    ],
    mistakes: [
      "Don't bend your elbows more as you lower; that turns the fly into a press.",
      "Don't go so deep you feel it in the front of your shoulders; stop at a deep chest stretch.",
      "Don't drop into the bottom; lower slowly and control the stretch.",
      "Don't go so heavy that you can't keep the arc smooth.",
    ],
    video: { youtubeId: "_LwuS1PdbdM", title: "Feel The Dumbbell Fly MORE | Targeting The Muscle", channel: "Renaissance Periodization", seconds: 370, start: 0 },
  },
  push_up: {
    setup: [
      "Place your hands on the floor slightly wider than your shoulders, fingers pointing forward.",
      "Step your feet back so your body forms a straight line from head to heels.",
      "Squeeze your glutes and brace your abs so your hips don't sag.",
    ],
    steps: [
      "Lower yourself slowly, over about 2 seconds, with your elbows about 45° from your sides.",
      "Go down until your chest is about an inch off the floor.",
      "Push the floor away until your arms are straight, keeping your body in one line.",
    ],
    mistakes: [
      "Don't let your hips sag or pike up; keep your body straight from head to heels.",
      "Don't flare your elbows out to 90°; keep them about 45° from your sides.",
      "Don't stop halfway; lower until your chest is about an inch from the floor.",
      "Don't keep adding reps once 25 is easy; elevate your feet to make it harder.",
    ],
    video: { youtubeId: "IODxDxX7oi4", title: "The Perfect Push Up | Do it right!", channel: "Calisthenicmovement", seconds: 218, start: 0 },
  },
  dip_chest: {
    setup: [
      "Grab the dip bars, step or jump up, and lock your arms straight.",
      "Bend your knees, cross your ankles, and lean your torso slightly forward.",
      "Press your shoulders down away from your ears.",
    ],
    steps: [
      "Lower yourself slowly, over 2–3 seconds, keeping the slight forward lean.",
      "Let your elbows travel back and slightly out as you go down.",
      "Stop when you feel a good chest stretch, around upper arms parallel to the floor.",
      "Press back up until your arms are straight without locking hard.",
    ],
    mistakes: [
      "Don't stay bolt upright; lean forward slightly to keep the work on your chest.",
      "Don't drop fast into the bottom; lower under control to a good stretch.",
      "Don't let your shoulders shrug up to your ears; keep them pressed down.",
      "Don't sink so deep it hurts the front of your shoulders; stop at a good stretch.",
    ],
    video: { youtubeId: "yN6Q1UI_xkE", title: "How To Do Dips For A Bigger Chest and Shoulders (Fix Mistakes!)", channel: "Jeff Nippard", seconds: 431, start: 0 },
  },

  // Back
  pull_up: {
    setup: [
      "Grab the bar overhand with your hands just outside shoulder width.",
      "Hang with your arms fully straight and your feet off the floor.",
      "Brace your abs and keep your legs still, either straight or crossed behind you.",
    ],
    steps: [
      "Start from a dead hang with your arms straight and lats stretched.",
      "Pull your shoulders down, then drive your elbows down toward your ribs.",
      "Pull your chest toward the bar until your chin clears it.",
      "Lower slowly, over 2–3 seconds, all the way back to a dead hang.",
    ],
    mistakes: [
      "Don't swing or kick to get up; keep your body still and pull with your back.",
      "Don't stop short at the bottom; return to a full dead hang every rep.",
      "Don't crane your neck to get your chin over; pull your chest toward the bar.",
      "Don't drop down fast; lower yourself under control.",
    ],
    video: { youtubeId: "Hdc7Mw6BIEE", title: "The Best Way To Do Pull Ups For A Wide Back (Optimal Training Technique)", channel: "Jeff Nippard", seconds: 513, start: 0 },
  },
  chin_up: {
    setup: [
      "Grab the bar with your palms facing you, hands about shoulder width apart.",
      "Hang with your arms fully straight and your feet off the floor.",
      "Brace your abs and squeeze your legs together so you don't swing.",
    ],
    steps: [
      "Start from a full hang with your arms completely straight.",
      "Drive your elbows down toward your sides and lead with your chest.",
      "Pull until your chin is over the bar.",
      "Lower slowly, over 2–3 seconds, back to a full hang.",
    ],
    mistakes: [
      "Don't stop with bent arms at the bottom; return to a full hang every rep.",
      "Don't kick or swing; keep your body still.",
      "Don't crane your neck to reach the bar; pull your body higher instead.",
      "Don't grip too wide or narrow; keep your hands about shoulder width.",
    ],
    video: { youtubeId: "qV7vOUcUfD4", title: "How To Do CHIN-UPS: Grip, Weighted Chin-Ups, Programming, & Fixing Common Errors", channel: "Barbell Logic", seconds: 140, start: 0 },
  },
  lat_pulldown: {
    setup: [
      "Adjust the knee pad so your thighs are locked in snugly.",
      "Grip the bar overhand, slightly wider than your shoulders.",
      "Sit down with your arms straight and lean back just slightly, chest up.",
    ],
    steps: [
      "Start with your arms straight and let your lats stretch fully.",
      "Drive your elbows down and back toward your sides.",
      "Pull the bar to your upper chest, keeping your chest up.",
      "Let the bar rise slowly, over 2–3 seconds, until your arms are straight and lats fully stretched.",
    ],
    mistakes: [
      "Don't lean way back and turn it into a row; keep only a slight lean.",
      "Don't stop short at the top; let your arms straighten and your lats stretch every rep.",
      "Don't yank the bar down with momentum; pull smoothly and control the way up.",
      "Don't pull the bar behind your neck; bring it to your upper chest.",
    ],
    video: { youtubeId: "VXKfH6ciEBI", title: "Improve Your Lat Pulldown For Growth | Targeting The Muscle Series", channel: "Renaissance Periodization", seconds: 604, start: 0 },
  },
  close_grip_pulldown: {
    setup: [
      "Attach a close-grip handle with your palms facing each other, like a V-bar.",
      "Adjust the knee pad so your thighs are locked in snugly.",
      "Grab the handle, sit down, and lean back slightly with your chest up.",
    ],
    steps: [
      "Start with your arms straight and let your lats stretch fully at the top.",
      "Drive your elbows down and in toward your sides.",
      "Pull the handle to your upper chest, keeping your chest up.",
      "Let the handle rise slowly, over 2–3 seconds, until your arms are straight again.",
    ],
    mistakes: [
      "Don't pull with your hands and biceps; think about driving your elbows down.",
      "Don't lean far back; keep your torso nearly upright with a slight lean.",
      "Don't cut the top short; straighten your arms fully every rep.",
      "Don't let your elbows flare out wide; keep them close to your sides.",
    ],
    video: { youtubeId: "kVB6SlEyjQM", title: "How to: Neutral Grip Pulldown [Lats-focused] for Physique Development", channel: "Physique Development", seconds: 368, start: 0 },
  },
  one_arm_db_row: {
    setup: [
      "Put one hand and the same-side knee on a flat bench.",
      "Plant your other foot on the floor, out to the side for balance.",
      "Hold the dumbbell in your free hand with your arm hanging straight down.",
      "Keep your back flat, roughly parallel to the floor, with your eyes down.",
    ],
    steps: [
      "Start with your arm long and let your shoulder drop toward the floor to stretch your lat.",
      "Pull the dumbbell back toward your hip, driving your elbow up and back.",
      "Squeeze for a moment when the dumbbell reaches your hip.",
      "Lower slowly, over 2–3 seconds, back to a full stretch.",
    ],
    mistakes: [
      "Don't twist your torso to heave the weight up; keep your chest facing the floor.",
      "Don't pull the dumbbell straight up to your chest; row it back toward your hip.",
      "Don't shorten the bottom; let your arm hang long for a full stretch every rep.",
      "Don't round your back; keep it flat throughout the set.",
    ],
    video: { youtubeId: "dFzUjzfih7k", title: "How to do the SINGLE ARM DUMBBELL ROW! | 2 Minute Tutorial", channel: "Max Euceda", seconds: 120, start: 0 },
  },
  chest_supported_db_row: {
    setup: [
      "Set an adjustable bench to 30–45°.",
      "Lie face down with your chest on the pad and your feet planted on the floor.",
      "Let the dumbbells hang straight down with your palms facing each other.",
    ],
    steps: [
      "Start with your arms straight and shoulders reaching toward the floor for a full stretch.",
      "Row both dumbbells toward your lower ribs, driving your elbows back.",
      "Squeeze your shoulder blades together at the top for a moment.",
      "Lower slowly, over 2–3 seconds, until your arms are straight again.",
    ],
    mistakes: [
      "Don't lift your chest off the pad to heave the weight; keep it pressed down.",
      "Don't stop short at the bottom; let your arms hang fully straight every rep.",
      "Don't shrug the dumbbells toward your ears; pull them back toward your lower ribs.",
    ],
    video: { youtubeId: "llFTFDwmGcw", title: "How to PROPERLY Incline Dumbbell Row (CHEST SUPPORTED ROW DONE RIGHT)", channel: "Colossus Fitness", seconds: 157, start: 0 },
  },
  seated_cable_row: {
    setup: [
      "Sit on the machine with your feet on the footplates and your knees slightly bent.",
      "Grab the handle and sit back until your arms are straight and the weight is lifted.",
      "Sit tall with your chest up and your torso close to upright.",
    ],
    steps: [
      "Start with your arms straight and let your shoulders reach forward for a full stretch.",
      "Pull your shoulders back first, then drive your elbows back close to your sides.",
      "Bring the handle to your stomach and squeeze your shoulder blades together.",
      "Return slowly, over 2–3 seconds, letting your shoulders reach forward again.",
    ],
    mistakes: [
      "Don't rock your torso back and forth; keep your chest tall and still.",
      "Don't round your lower back on the stretch; let only your shoulders reach forward.",
      "Don't pull the handle up to your chest; bring it to your stomach.",
      "Don't let the weight stack slam; control the return.",
    ],
    video: { youtubeId: "7o2oolbmzeI", title: "How To: Seated Cable Low-Row || PERFECT FORM", channel: "ScottHermanFitness", seconds: 366, start: 0 },
  },
  cable_row: {
    setup: [
      "Set the pulley to its lowest position and attach a close-grip handle.",
      "Sit on a bench or the floor facing the pulley, feet braced and knees slightly bent.",
      "If you have nothing to brace your feet on, kneel tall facing the pulley instead.",
      "Move back far enough that the weight stays lifted with your arms straight.",
    ],
    steps: [
      "Start with your arms straight and let your shoulders reach forward for a full stretch.",
      "Pull your shoulders back, then drive your elbows back close to your sides.",
      "Bring the handle to your stomach and squeeze your shoulder blades together.",
      "Return slowly, over 2–3 seconds, until your arms are straight again.",
    ],
    mistakes: [
      "Don't lean way back to finish the rep; keep your torso tall and still.",
      "Don't round your lower back as you reach forward; keep your chest up.",
      "Don't pull to your chest; bring the handle to your stomach.",
    ],
    video: { youtubeId: "vwHG9Jfu4sw", title: "How to do the SEATED CABLE ROW! | 2 Minute Tutorial", channel: "Max Euceda", seconds: 120, start: 0 },
  },
  barbell_row: {
    setup: [
      "Stand with your feet about hip width and grip the bar overhand, a bit wider than shoulder width.",
      "Lift the bar, then hinge at your hips with soft knees until your torso is about 45°.",
      "Keep your back flat and brace your abs hard.",
    ],
    steps: [
      "Start with your arms hanging straight and your shoulders stretched slightly forward.",
      "Pull the bar to your lower ribs, driving your elbows back.",
      "Squeeze your back for a moment at the top without standing up.",
      "Lower the bar slowly, over 2–3 seconds, to straight arms.",
    ],
    mistakes: [
      "Don't jerk the weight up with your hips; keep your torso still.",
      "Don't let your torso rise a little more each rep; hold about 45° throughout.",
      "Don't round your lower back; keep it flat and braced.",
      "Don't pull the bar to your chest or belly button; aim for your lower ribs.",
    ],
    video: { youtubeId: "7B5Exks1KJE", title: "Maximize Whole Back Growth On The Barbell Row | Targeting The Muscle", channel: "Renaissance Periodization", seconds: 564, start: 0 },
  },
  inverted_row: {
    setup: [
      "Lock the Smith machine bar at about hip height.",
      "Lie underneath and grab the bar overhand, a bit wider than shoulder width.",
      "Walk your feet out and straighten your body from head to heels, resting on your heels.",
      "Squeeze your glutes and brace your abs.",
    ],
    steps: [
      "Start from straight arms with your body in one straight line.",
      "Pull your chest to the bar, driving your elbows back.",
      "Squeeze your shoulder blades together when your chest touches.",
      "Lower slowly, over 2–3 seconds, back to straight arms.",
    ],
    mistakes: [
      "Don't let your hips sag; keep your body straight from head to heels.",
      "Don't stop short; pull until your chest touches the bar.",
      "Don't jut your chin toward the bar; lead with your chest.",
      "Don't stay on an easy setup; lower the bar or raise your feet once 15 reps is easy.",
    ],
    video: { youtubeId: "XZV9IwluPjw", title: "How To: Smith Machine- Inverted Row", channel: "ScottHermanFitness", seconds: 100, start: 0 },
  },
  db_pullover: {
    setup: [
      "Lie on a flat bench with your head near the end and your feet planted.",
      "Hold one dumbbell with both hands, palms pressed against the underside of the top end.",
      "Press it up over your chest with your arms nearly straight.",
      "Brace your abs so your ribs stay down.",
    ],
    steps: [
      "Lower the dumbbell back behind your head in an arc, arms nearly straight.",
      "Go slowly, over 2–3 seconds, until you feel a deep stretch in your lats.",
      "Pull it back up along the same arc, driving your arms down with your lats.",
      "Stop with the dumbbell above your chest, then start the next rep.",
    ],
    mistakes: [
      "Don't bend and straighten your elbows; keep the same slight bend throughout.",
      "Don't let your back arch and ribs flare at the stretch; keep your abs braced.",
      "Don't cut the stretch short; lower until you feel a deep stretch overhead.",
    ],
    video: { youtubeId: "5YStMv6m2g8", title: "Dumbbell Pullover: Chest or Back Exercise?", channel: "Muscle & Strength", seconds: 197, start: 0 },
  },
  straight_arm_pulldown: {
    setup: [
      "Set the pulley to the top and attach a straight bar.",
      "Grab the bar overhand about shoulder width and take a couple of steps back.",
      "Hinge forward a little at your hips with soft knees and a flat back.",
    ],
    steps: [
      "Start with your arms nearly straight and the bar high enough that your lats stretch.",
      "Sweep the bar down in an arc to your thighs, keeping your arms nearly straight.",
      "Squeeze your lats for a moment with the bar at your thighs.",
      "Let the bar rise slowly, over 2–3 seconds, back to the full stretch.",
    ],
    mistakes: [
      "Don't bend your elbows to pull the bar down; keep your arms nearly straight.",
      "Don't rock your body to move the weight; keep your torso still.",
      "Don't let your shoulders roll forward at the bottom; keep your chest up.",
      "Don't cut the stretch short; let the bar rise until your lats are fully stretched.",
    ],
    video: { youtubeId: "32auHIqgEoM", title: "How to do the CABLE LAT PULLOVER! | 2 Minute Tutorial", channel: "Max Euceda", seconds: 120, start: 0 },
  },

  // Traps
  db_shrug: {
    setup: [
      "Stand tall with a dumbbell in each hand at your sides, palms facing in.",
      "Set your feet about hip-width apart and brace your abs.",
      "Let your shoulders sink as low as they go so your traps start stretched.",
    ],
    steps: [
      "Keep your arms straight and shrug your shoulders straight up toward your ears.",
      "Pause for a second at the top with your traps squeezed hard.",
      "Lower slowly, taking about two seconds on the way down.",
      "Let your shoulders drop all the way for a full stretch before the next rep.",
    ],
    mistakes: [
      "Don't roll your shoulders; move straight up and straight down.",
      "Don't bend your elbows to help; your arms just hang like hooks.",
      "Don't cut the bottom short; let your shoulders drop fully every rep.",
      "Don't poke your head forward; keep your chin level and eyes ahead.",
    ],
    video: { youtubeId: "cJRVVxmytaM", title: "How To: Dumbbell Shrugs", channel: "ScottHermanFitness", seconds: 102, start: 0 },
  },
  barbell_shrug: {
    setup: [
      "Take the bar from a rack at mid-thigh height, or deadlift it up from the floor.",
      "Hold it with an overhand grip just outside your thighs, arms straight.",
      "Stand tall with feet about hip-width apart and your abs braced.",
    ],
    steps: [
      "Let your shoulders drop fully so your traps start stretched.",
      "Shrug straight up toward your ears, keeping your arms straight.",
      "Hold the top for one second with your traps squeezed.",
      "Lower under control, about two seconds, back to a full stretch.",
    ],
    mistakes: [
      "Don't roll your shoulders forward or back; go straight up and down.",
      "Don't bounce the bar with your knees or hips; only your shoulders move.",
      "Don't bend your elbows to pull the bar up; keep your arms straight.",
      "Don't skip the hold; pause a full second at the top of every rep.",
    ],
    video: { youtubeId: "zfAHfyTB_Ao", title: "Barbell Shrug Technique For Growth | Targeting The Muscle", channel: "Renaissance Periodization", seconds: 393, start: 0 },
  },

  // Shoulders
  seated_db_shoulder_press: {
    setup: [
      "Set the bench upright and sit with your back and head against the pad.",
      "Kick the dumbbells up off your knees, one at a time, to shoulder height.",
      "Turn your palms forward with your elbows slightly in front of your body.",
      "Plant your feet wide and brace your abs.",
    ],
    steps: [
      "Start with the dumbbells at ear level and your forearms vertical.",
      "Press up and slightly in until your arms are nearly straight over your shoulders.",
      "Stop with a small gap between the dumbbells at the top.",
      "Lower slowly, about two seconds, back to ear level.",
    ],
    mistakes: [
      "Don't clank the dumbbells together at the top; keep a small gap between them.",
      "Don't arch your lower back off the pad; keep your back flat against the bench.",
      "Don't flare your elbows straight out to the sides; keep them slightly forward.",
      "Don't stop high on the way down; lower to ear level every rep.",
    ],
    video: { youtubeId: "rO_iEImwHyo", title: "How to do the SEATED DUMBBELL SHOULDER PRESS! | 2 Minute Tutorial", channel: "Max Euceda", seconds: 120, start: 0 },
  },
  standing_db_shoulder_press: {
    setup: [
      "Stand with feet about hip-width apart, dumbbells held at shoulder height.",
      "Turn your palms forward, or slightly in if that feels better on your shoulders.",
      "Squeeze your glutes and brace your abs so your ribs stay down.",
    ],
    steps: [
      "Start with the dumbbells at ear level and your forearms vertical.",
      "Press up and slightly in until your arms are nearly straight overhead.",
      "Finish with the dumbbells stacked over your shoulders, not out in front.",
      "Lower under control, about two seconds, back to ear level.",
    ],
    mistakes: [
      "Don't lean back to finish the rep; keep your ribs down and glutes tight.",
      "Don't dip your knees to drive the weight up; keep your legs still.",
      "Don't let the dumbbells drift forward; press them over your shoulders.",
      "Don't stop short; lower to ear level for the full range.",
    ],
    video: { youtubeId: "OOe_HrNnQWw", title: "How to: Standing DB Shoulder Press for Physique Development", channel: "Physique Development", seconds: 172, start: 0 },
  },
  machine_shoulder_press: {
    setup: [
      "Set the seat so the handles sit at ear level at the bottom.",
      "Sit with your back flat against the pad and your feet planted.",
      "Grip the handles with your wrists straight and stacked over your elbows.",
    ],
    steps: [
      "Start with the handles at ear level and your elbows under your hands.",
      "Press up until your arms are nearly straight, without slamming into lockout.",
      "Lower slowly, taking two to three seconds, back to ear level.",
      "Start the next rep just before the weight stack touches down.",
    ],
    mistakes: [
      "Don't set the seat too high; that cuts the range short at the bottom.",
      "Don't let your back peel off the pad; keep your abs braced.",
      "Don't let the weight drop; control every descent.",
      "Don't shrug your shoulders toward your ears as you press.",
    ],
    video: { youtubeId: "Wqq43dKW1TU", title: "How To: Overhead Press (Cybex)", channel: "ScottHermanFitness", seconds: 137, start: 0 },
  },
  smith_shoulder_press: {
    setup: [
      "Set the bench upright under the Smith bar so the bar comes down just in front of your face.",
      "Set the safety stops just below chin level.",
      "Grip the bar slightly wider than your shoulders so your forearms are vertical at the bottom.",
      "Sit with your back flat against the pad, feet planted and abs braced.",
    ],
    steps: [
      "Unrack the bar by turning your wrists to clear the hooks.",
      "Lower the bar slowly to chin level, taking about two seconds.",
      "Press straight up until your arms are nearly locked.",
      "After your last rep, turn the hooks back over the pegs to rack it.",
    ],
    mistakes: [
      "Don't lower the bar past your chin; stop at chin level.",
      "Don't arch your back off the pad to push the bar up.",
      "Don't bounce the bar at the bottom; pause briefly, then press.",
      "Don't sit too far forward or back; the bar should pass just in front of your face.",
    ],
    video: { youtubeId: "kYZ0aUEzgEQ", title: "Exercise Tutorial: Shoulder Press On Smith Machine", channel: "Travis Tarrant", seconds: 220, start: 0 },
  },
  barbell_overhead_press: {
    setup: [
      "Take the bar from a rack at upper-chest height, or clean it up from the floor.",
      "Grip just outside shoulder-width with your wrists stacked over your elbows.",
      "Stand with feet about hip-width apart, the bar resting on your front delts.",
      "Squeeze your glutes and brace your abs hard before each rep.",
    ],
    steps: [
      "Pull your chin back and press the bar straight up past your face.",
      "Once the bar clears your forehead, move your head forward under it.",
      "Finish with the bar locked out over your head, stacked over your shoulders and mid-foot.",
      "Lower under control back to your upper chest.",
    ],
    mistakes: [
      "Don't lean back into a standing incline press; keep your glutes and abs tight.",
      "Don't press the bar out in front of you; keep it close to your face.",
      "Don't flare your elbows wide at the bottom; keep them slightly in front of the bar.",
      "Don't dip your knees to drive the bar; that turns it into a push press.",
    ],
    video: { youtubeId: "_RlRDWO2jfg", title: "Build Bigger Shoulders With Perfect Training Technique (The Overhead Press)", channel: "Jeff Nippard", seconds: 479, start: 0 },
  },
  db_front_raise: {
    setup: [
      "Stand tall with dumbbells in front of your thighs, palms facing your legs.",
      "Keep a soft bend in your elbows and brace your abs.",
      "Set your feet hip-width apart with your knees slightly soft.",
    ],
    steps: [
      "Raise the dumbbells straight out in front of you, keeping the soft elbow.",
      "Stop at about eye level.",
      "Lower slowly, taking two to three seconds, back to your thighs.",
      "Start the next rep without resting the dumbbells on your legs.",
    ],
    mistakes: [
      "Don't swing with your hips or lean back; keep your torso still.",
      "Don't lift far above eye level; that shifts the work to your traps.",
      "Don't lock your elbows or bend them a lot; keep a soft, fixed bend.",
      "Don't let the dumbbells drop; lower them slowly every rep.",
    ],
    video: { youtubeId: "-t7fuZ0KhDA", title: "How To: Dumbbell Front Raise", channel: "ScottHermanFitness", seconds: 111, start: 0 },
  },
  db_lateral_raise: {
    setup: [
      "Stand with dumbbells at your sides, palms facing in.",
      "Lean your torso slightly forward from the hips and brace your abs.",
      "Set a slight bend in your elbows and keep it the same all set.",
    ],
    steps: [
      "Raise the dumbbells out to your sides, leading with your elbows.",
      "Stop when your arms are level with your shoulders.",
      "Keep your hands no higher than your elbows at the top.",
      "Lower slowly, taking two to three seconds, until the dumbbells are near your sides.",
    ],
    mistakes: [
      "Don't shrug as you lift; keep your shoulders down away from your ears.",
      "Don't swing the weights up with your body; keep your torso still.",
      "Don't raise above shoulder height; stop when your arms are level.",
      "Don't bend your elbows more as you tire; keep the same angle.",
    ],
    video: { youtubeId: "n5dsI9qQXwY", title: "Lateral Raise Technique For Huge Delts | Targeting The Muscle Series", channel: "Renaissance Periodization", seconds: 388, start: 0 },
  },
  cable_lateral_raise: {
    setup: [
      "Set the pulley low and attach a single handle.",
      "Stand side-on to the machine and take the handle in your far hand, the cable running behind you.",
      "Step out until there's tension on the cable with your hand by your hip.",
      "Stand tall, brace your abs, and hold the machine with your free hand.",
    ],
    steps: [
      "Start with your hand by your hip and feel the stretch in your side delt.",
      "Raise your arm out to the side, leading with your elbow.",
      "Stop when your arm is level with your shoulder.",
      "Lower slowly, taking two to three seconds, back to your hip.",
    ],
    mistakes: [
      "Don't stand too close to the machine; keep tension on the cable at the bottom.",
      "Don't lean away or twist to move the weight; keep your torso still.",
      "Don't shrug at the top; keep your shoulder down.",
      "Don't let the cable yank your arm back; resist it all the way down.",
    ],
    video: { youtubeId: "y4Djk_G0yEg", title: "Behind The Back Cable Lateral Raise | How To", channel: "Pro Physique Studio", seconds: 65, start: 0 },
  },
  db_y_raise: {
    setup: [
      "Set the bench to about 30° and lie face down with your chest on the pad.",
      "Let your arms hang straight down, a light dumbbell in each hand, thumbs up.",
      "Plant your feet on the floor and keep your chin tucked.",
    ],
    steps: [
      "Raise the dumbbells up and out in a Y shape, thumbs pointing up.",
      "Keep a slight bend in your elbows that doesn't change.",
      "Lift until your arms are in line with your body, then pause briefly.",
      "Lower slowly, taking two to three seconds, back to a straight-arm hang.",
    ],
    mistakes: [
      "Don't lift your chest off the pad; keep it pinned to the bench.",
      "Don't shrug toward your ears; keep your shoulders down.",
      "Don't swing the dumbbells up; use a weight you can raise slowly.",
      "Don't let your arms drift into a T; keep them angled up in a Y.",
    ],
    video: { youtubeId: "lXp16YozXgk", title: "How to Perform Dumbbell Y Raise | Strengthen Your Lower Traps", channel: "Physique Development", seconds: 150, start: 0 },
  },
  db_rear_delt_fly: {
    setup: [
      "Hold the dumbbells, soften your knees, and hinge forward until your torso is about 45° or lower.",
      "Keep your back flat and let the dumbbells hang under your chest, palms facing in.",
      "Set a slight bend in your elbows and keep it fixed.",
    ],
    steps: [
      "Sweep the dumbbells out wide to your sides, arms slightly bent.",
      "Keep your shoulder blades still so your arms move, not your back.",
      "Stop when your arms are about level with your torso.",
      "Lower slowly, taking two to three seconds, until the dumbbells hang under your chest.",
    ],
    mistakes: [
      "Don't squeeze your shoulder blades together; that hands the work to your upper back.",
      "Don't stand up as you lift; hold your hinge for the whole set.",
      "Don't bend your elbows more to pull the weight; that turns it into a row.",
      "Don't round your back; keep it flat throughout.",
    ],
    video: { youtubeId: "qfc70k40318", title: "How To Build Boulder Rear Delts: Optimal Training Explained", channel: "Jeff Nippard", seconds: 424, start: 312 },
  },
  reverse_pec_deck: {
    setup: [
      "Set the handles to their most forward position for rear delt work.",
      "Adjust the seat so the handles line up with your shoulders.",
      "Sit facing the pad with your chest against it.",
      "Grab the handles with your arms out in front and a slight bend in your elbows.",
    ],
    steps: [
      "Start with your arms reaching forward so your rear delts are stretched.",
      "Push the handles out and back in a wide arc using your rear delts.",
      "Stop when your arms are in line with your body.",
      "Return slowly, taking two to three seconds, until the handles nearly meet.",
    ],
    mistakes: [
      "Don't squeeze your shoulder blades together; keep them still and let your arms move.",
      "Don't bend your elbows to pull the handles back; keep your arms long.",
      "Don't lean back off the pad; keep your chest against it.",
      "Don't let the stack slam between reps; control the return.",
    ],
    video: { youtubeId: "6yMdhi2DVao", title: "How To Properly Use The Rear Delt Fly Machine (+ BONUS TIP)", channel: "Mind Pump TV", seconds: 372, start: 0 },
  },
  face_pull: {
    setup: [
      "Set the pulley at face height and attach a rope.",
      "Grab both rope ends and step back until your arms are straight.",
      "Stand with feet hip-width or staggered, abs braced.",
    ],
    steps: [
      "Start with your arms straight and let the rope pull your shoulders slightly forward.",
      "Pull the rope toward your forehead, driving your elbows high and wide.",
      "Pull the rope ends apart so your hands finish beside your ears.",
      "Return slowly, taking two to three seconds, until your arms are straight.",
    ],
    mistakes: [
      "Don't let your elbows drop below your hands; keep them high.",
      "Don't lean back and use your body weight; keep your torso still.",
      "Don't pull to your chest or chin; aim for your forehead.",
      "Don't go so heavy you can't pause with the rope at your face.",
    ],
    video: { youtubeId: "rep-qVOkqgk", title: "How To: Face Pull", channel: "ScottHermanFitness", seconds: 163, start: 0 },
  },
  incline_db_rear_delt_raise: {
    setup: [
      "Set the bench to a low incline, about 30–45°, and lie face down with your chest on the pad.",
      "Let the dumbbells hang straight down, palms facing in.",
      "Keep a slight bend in your elbows and your chin tucked.",
    ],
    steps: [
      "Raise the dumbbells straight out to your sides in a wide arc.",
      "Stop when your arms are about level with your torso.",
      "Keep your chest on the pad and your shoulder blades still.",
      "Lower slowly, taking two to three seconds, back to a full hang.",
    ],
    mistakes: [
      "Don't lift your chest off the bench to swing the weight up.",
      "Don't squeeze your shoulder blades together; let your rear delts move your arms.",
      "Don't bend your elbows more as you lift; that turns it into a row.",
      "Don't drop the dumbbells; control them all the way down.",
    ],
    video: { youtubeId: "51YM340QE9M", title: "Target & Grow Your Rear Delts with the Incline Bench Reverse Fly", channel: "Mind Pump TV", seconds: 244, start: 0 },
  },

  // Biceps
  db_curl: {
    setup: [
      "Stand tall holding dumbbells at your sides, palms facing forward.",
      "Pin your elbows to your sides and brace your abs.",
      "Keep your shoulders back and your wrists straight.",
    ],
    steps: [
      "Curl the dumbbells up while keeping your elbows at your sides.",
      "Squeeze at the top with the dumbbells near your shoulders.",
      "Lower slowly, taking two to three seconds.",
      "Straighten your arms fully at the bottom for a full stretch.",
    ],
    mistakes: [
      "Don't swing your body to get the weight up; keep your torso still.",
      "Don't let your elbows drift forward at the top; keep them pinned.",
      "Don't stop short at the bottom; straighten your arms all the way.",
      "Don't curl your wrists in; keep them straight.",
    ],
    video: { youtubeId: "sAq_ocpRh_I", title: "How To: Alternating Dumbbell Curl", channel: "ScottHermanFitness", seconds: 80, start: 0 },
  },
  incline_db_curl: {
    setup: [
      "Set the bench to 45–60° and sit back with your head and shoulders on the pad.",
      "Let your arms hang straight down behind your body, palms facing forward.",
      "Keep your shoulders pressed back against the bench.",
    ],
    steps: [
      "Curl the dumbbells up without letting your elbows move forward.",
      "Squeeze at the top with your forearms close to vertical.",
      "Lower slowly, taking two to three seconds.",
      "Let your arms hang fully straight behind you for a long stretch.",
    ],
    mistakes: [
      "Don't let your elbows swing forward as you curl; keep them hanging back.",
      "Don't lift your shoulders off the pad; stay back against the bench.",
      "Don't cut the bottom short; straighten your arms all the way.",
      "Don't go so heavy that you swing; use a weight you can control.",
    ],
    video: { youtubeId: "HhHHBj3qTJ4", title: "How to do the INCLINE DUMBBELL CURL! | 2 Minute Tutorial", channel: "Max Euceda", seconds: 120, start: 0 },
  },
  hammer_curl: {
    setup: [
      "Stand tall holding dumbbells at your sides, palms facing each other.",
      "Pin your elbows to your sides and brace your abs.",
    ],
    steps: [
      "Curl the dumbbells up, keeping your palms facing in.",
      "Bring the dumbbell up to your shoulder with your elbow still at your side.",
      "Lower slowly, taking two to three seconds.",
      "Straighten your arms fully at the bottom before the next rep.",
    ],
    mistakes: [
      "Don't swing your body; keep your torso still.",
      "Don't let your elbows drift forward; keep them at your sides.",
      "Don't twist your palms up; keep the neutral grip the whole rep.",
      "Don't stop short at the bottom; straighten your arms fully.",
    ],
    video: { youtubeId: "zC3nLlEvin4", title: "How To: Dumbbell Hammer Curl", channel: "ScottHermanFitness", seconds: 123, start: 0 },
  },
  cable_curl: {
    setup: [
      "Set the pulley at its lowest position and attach a straight bar or rope.",
      "Grip the bar shoulder-width, or hold the rope with palms facing in.",
      "Step back until the weight lifts off the stack with your arms straight.",
      "Pin your elbows to your sides and brace your abs.",
    ],
    steps: [
      "Curl the handle up toward your shoulders, keeping your elbows still.",
      "Squeeze at the top without letting your elbows move forward.",
      "Lower slowly, taking two to three seconds.",
      "Straighten your arms fully at the bottom before the next rep.",
    ],
    mistakes: [
      "Don't lean back to move the weight; keep your torso upright.",
      "Don't let your elbows drift forward at the top; keep them still.",
      "Don't stop short at the bottom; straighten your arms fully.",
    ],
    video: { youtubeId: "Odz1T8WmDBI", title: "How To: Inside-Grip Rope Curl", channel: "ScottHermanFitness", seconds: 89, start: 0 },
  },
  barbell_curl: {
    setup: [
      "Hold the bar with an underhand grip at shoulder-width.",
      "Stand tall with feet hip-width apart and the bar against your thighs.",
      "Pin your elbows to your sides and brace your abs.",
    ],
    steps: [
      "Curl the bar up toward your shoulders, keeping your elbows at your sides.",
      "Squeeze at the top without letting your elbows move forward.",
      "Lower slowly, taking two to three seconds.",
      "Straighten your arms fully at the bottom.",
    ],
    mistakes: [
      "Don't swing with your hips or lean back; keep your torso still.",
      "Don't let your elbows drift forward; keep them at your sides.",
      "Don't stop short at the bottom; straighten your arms all the way.",
      "Don't bend your wrists back; keep them straight.",
    ],
    video: { youtubeId: "QZEqB6wUPxQ", title: "How To: Barbell Bicep Curl | 3 GOLDEN RULES", channel: "ScottHermanFitness", seconds: 370, start: 0 },
  },
  db_preacher_curl: {
    setup: [
      "Set the bench back upright and stand behind it.",
      "Drape one arm over the top so your armpit is snug against the pad.",
      "Rest the back of your upper arm flat on the pad, dumbbell in hand, palm up.",
      "Steady yourself with your free hand on the bench.",
    ],
    steps: [
      "Curl the dumbbell up toward your shoulder, keeping your upper arm on the pad.",
      "Squeeze at the top without lifting your elbow.",
      "Lower slowly, taking two to three seconds.",
      "Straighten your arm fully at the bottom without bouncing.",
      "Finish all your reps on one arm, then switch.",
    ],
    mistakes: [
      "Don't lift your elbow off the pad; keep your upper arm pressed down.",
      "Don't drop into the bottom; control the stretch to protect your elbow.",
      "Don't lean your shoulder over the pad to help the curl; stay behind the bench.",
      "Don't stop short of straight; finish each rep with your arm extended.",
    ],
    video: { youtubeId: "7v7uldi1eLU", title: "Preacher Curls Are What Your Bicep Workouts Have Been Missing!", channel: "Mind Pump TV", seconds: 241, start: 0 },
  },

  // Triceps
  db_overhead_extension: {
    setup: [
      "Stand with your feet about hip width apart, knees soft, and brace your abs and glutes.",
      "Hold one dumbbell upright with both palms under the top plate and your thumbs around the handle.",
      "Press it straight overhead with your elbows pointing forward and your upper arms close to your ears.",
    ],
    steps: [
      "Keep your upper arms still and bend only your elbows to lower the dumbbell behind your head.",
      "Take 2–3 seconds on the way down and sink until you feel a deep stretch in your triceps.",
      "Pause for a moment in the stretch without letting the weight bounce.",
      "Straighten your elbows to press the dumbbell back up to full lockout overhead.",
    ],
    mistakes: [
      "Don't let your elbows flare out wide; keep them pointing forward and close to your head.",
      "Don't cut the bottom short; lower until your forearms nearly touch your biceps.",
      "Don't arch your lower back to finish reps; keep your ribs down and abs tight.",
      "Don't let your upper arms drift forward as you press; only your forearms should move.",
    ],
    video: { youtubeId: "-Vyt2QdsR7E", title: "How To: Standing Overhead Dumbbell Tricep Extension", channel: "ScottHermanFitness", seconds: 103, start: 0 },
  },
  db_skull_crusher: {
    setup: [
      "Lie flat on the bench with your feet planted and your back flat against the pad.",
      "Hold a dumbbell in each hand with your palms facing each other.",
      "Start with your arms straight over your shoulders, angled slightly back toward your head.",
    ],
    steps: [
      "Keep your elbows pointing up and bend only at the elbows to lower the dumbbells.",
      "Lower slowly over 2–3 seconds until the dumbbells are beside your head.",
      "Pause for a moment when you feel a full stretch in your triceps.",
      "Straighten your elbows to press the dumbbells back up to full lockout.",
    ],
    mistakes: [
      "Don't let your elbows flare out to the sides; keep them pointing up, about shoulder width apart.",
      "Don't turn it into a press; keep your upper arms still and move only your forearms.",
      "Don't drop the dumbbells fast; control the lowering all the way down beside your head.",
    ],
    video: { youtubeId: "VP9Qp72zZ_c", title: "How to Do SKULLCRUSHERS with Dumbbells for BIG Triceps (ADVANCED)", channel: "Mind Pump TV", seconds: 333, start: 0 },
  },
  cable_pushdown: {
    setup: [
      "Set the pulley at its highest point and attach a bar or rope.",
      "Grip it about shoulder width or narrower, take a step back, and lean forward slightly from the hips.",
      "Pull your shoulders down and back and pin your elbows to your sides.",
    ],
    steps: [
      "Start with your hands around chest height and your forearms close to your biceps.",
      "Push the handle down by straightening your elbows until your arms are fully locked out.",
      "Squeeze your triceps hard for a second at the bottom.",
      "Let the handle rise slowly over 2–3 seconds until your forearms meet your biceps again.",
    ],
    mistakes: [
      "Don't let your elbows drift forward or flare out; keep them pinned at your sides.",
      "Don't lean over the handle and push with your body weight; only your forearms should move.",
      "Don't stop short of lockout; straighten your arms fully on every rep.",
      "Don't let the weight yank your hands up; control it all the way back.",
    ],
    video: { youtubeId: "-zLyUAo1gMw", title: "How to do the CABLE TRICEP PUSHDOWN! | 2 Minute Tutorial", channel: "Max Euceda", seconds: 120, start: 0 },
  },
  cable_overhead_extension: {
    setup: [
      "Set the pulley at about head height or higher and attach a rope.",
      "Grab the rope with both hands, turn to face away from the pulley, and bring it behind your head.",
      "Step forward into a split stance, lean your torso forward slightly, and brace your abs.",
      "Keep your elbows close to your head and pointing forward.",
    ],
    steps: [
      "Start with your elbows bent and the rope behind your head so your triceps feel stretched.",
      "Extend your elbows to push the rope forward and up until your arms are fully straight.",
      "Squeeze your triceps for a moment at lockout.",
      "Let the rope come back slowly over 2–3 seconds until your hands are behind your head again.",
    ],
    mistakes: [
      "Don't let your elbows flare out wide; keep them tight beside your head.",
      "Don't swing your upper arms to move the rope; bend and straighten only at the elbows.",
      "Don't cut the stretch short; let your hands travel all the way back behind your head.",
      "Don't arch your lower back to finish reps; keep your abs braced and ribs down.",
    ],
    video: { youtubeId: "57fWTQID-1Y", title: "How to PROPERLY Overhead Cable Tricep Extension (FIX THIS NOW!)", channel: "Colossus Fitness", seconds: 124, start: 0 },
  },
  close_grip_push_up: {
    setup: [
      "Place your hands on the floor directly under your shoulders, fingers pointing forward.",
      "Walk your feet back so your body forms a straight line from head to heels.",
      "Squeeze your glutes and brace your abs so your hips don't sag.",
    ],
    steps: [
      "Bend your elbows and lower your chest, keeping your elbows brushing your sides.",
      "Take 2–3 seconds on the way down until your chest is just above the floor.",
      "Let your shoulders travel slightly forward of your hands at the bottom to load your triceps more.",
      "Press the floor away until your elbows are fully straight.",
    ],
    mistakes: [
      "Don't let your elbows flare out; keep them tucked close to your ribs.",
      "Don't squeeze your hands into a diamond; keeping them under your shoulders gives a fuller stretch.",
      "Don't let your hips sag or pike up; keep a straight line from head to heels.",
      "Don't cut reps short; go down until your chest nearly touches the floor.",
    ],
    video: { youtubeId: "EQjexKQpGeQ", title: "How to Target TRICEPS On The Pushup | Targeting The Muscle", channel: "Renaissance Periodization", seconds: 248, start: 0 },
  },
  dip_triceps: {
    setup: [
      "Grip the dip handles about shoulder width apart and press up to straight arms.",
      "Push your shoulders down away from your ears and brace your abs.",
      "Let your legs hang slightly in front of you so your torso stays upright.",
    ],
    steps: [
      "Bend your elbows and lower yourself slowly over 2–3 seconds, elbows pointing back.",
      "Keep your torso upright and lower until your elbows reach 90°.",
      "Pause for a moment at the bottom without bouncing.",
      "Press back up until your elbows are fully locked out.",
    ],
    mistakes: [
      "Don't lean far forward; an upright torso keeps the work on your triceps instead of your chest.",
      "Don't let your elbows flare out; keep them tucked and pointing behind you.",
      "Don't let your shoulders shrug up toward your ears at the bottom.",
      "Don't drop fast and bounce; control the way down on every rep.",
    ],
    video: { youtubeId: "TrJVszDm7ik", title: "How to do the BODYWEIGHT DIP! | 2 Minute Tutorial", channel: "Max Euceda", seconds: 120, start: 0 },
  },
  db_kickback: {
    setup: [
      "Put your opposite knee and hand on the bench, with your back flat and about parallel to the floor.",
      "Hold the dumbbell in your free hand with your palm facing your body.",
      "Raise your elbow so your upper arm is parallel to the floor and tucked against your side.",
    ],
    steps: [
      "Start with your elbow bent about 90° and your forearm hanging straight down.",
      "Straighten your elbow to move the dumbbell back until your whole arm is in a straight line.",
      "Squeeze your triceps hard for a second at full extension.",
      "Lower the dumbbell slowly back to the start, keeping your upper arm still.",
    ],
    mistakes: [
      "Don't let your upper arm drop as you tire; keep it parallel to the floor.",
      "Don't swing the weight up; use a load you can hold still at lockout.",
      "Don't stop short of straight; extend your elbow fully on every rep.",
      "Don't round your back; keep it flat with your neck in line.",
    ],
    video: { youtubeId: "6SS6K3lAwZ8", title: "How To: Tricep Kickback (Dumbbell)", channel: "ScottHermanFitness", seconds: 90, start: 0 },
  },
  smith_close_grip_press: {
    setup: [
      "Set a flat bench under the bar so it comes down to your lower chest.",
      "Set the safety stops just below where the bar touches your chest.",
      "Lie down, plant your feet, and grip the bar with your hands shoulder width apart.",
      "Pull your shoulder blades back and down, then rotate the bar to unhook it.",
    ],
    steps: [
      "Lower the bar slowly over 2–3 seconds, keeping your elbows tucked close to your sides.",
      "Touch your lower chest lightly without bouncing.",
      "Press the bar straight up until your elbows are fully locked out.",
    ],
    mistakes: [
      "Don't grip narrower than shoulder width; it strains your wrists without helping your triceps.",
      "Don't let your elbows flare out; keep them tucked as the bar comes down.",
      "Don't set up with the bar over your neck or upper chest; it should land on your lower chest.",
      "Don't stop short of your chest; use the full range on every rep.",
    ],
    video: { youtubeId: "z8UWdGwtzRM", title: "Exercise Tutorial: Close Grip Smith Machine Bench Press", channel: "Travis Tarrant", seconds: 191, start: 0 },
  },

  // Forearms
  db_wrist_curl: {
    setup: [
      "Kneel in front of a flat bench and rest your forearms on it, palms facing up.",
      "Hold a dumbbell in each hand with your wrists just past the edge of the bench.",
      "Keep your forearms pressed flat on the pad for the whole set.",
    ],
    steps: [
      "Lower the dumbbells slowly by bending your wrists down as far as they go.",
      "Open your hands and let the dumbbells roll down to your fingertips for a full stretch.",
      "Close your fingers around the handles, then curl your wrists up as high as you can.",
      "Squeeze your forearms for a moment at the top before lowering again.",
    ],
    mistakes: [
      "Don't lift your forearms off the bench; only your hands and wrists should move.",
      "Don't bounce the reps; lower slowly and control the roll to your fingertips.",
      "Don't go so heavy that the dumbbells slip off your fingertips.",
    ],
    video: { youtubeId: "S-ynXc4M-mY", title: "Simplified: Wrist Curl Quick #Howto", channel: "MuscleWiki", seconds: 116, start: 0 },
  },

  // Quads
  leg_press: {
    setup: [
      "Sit with your back and hips pressed flat against the pad.",
      "Place your feet shoulder width apart in the middle of the platform, toes turned out slightly.",
      "Press the platform up, release the safety handles, and hold the side grips.",
      "Brace your abs before each rep.",
    ],
    steps: [
      "Bend your knees and lower the platform slowly over 2–3 seconds, knees tracking over your toes.",
      "Go as deep as you can while your lower back stays flat against the pad.",
      "Pause for a moment at the bottom, then press through your whole foot.",
      "Stop just short of locking your knees at the top, then start the next rep.",
    ],
    mistakes: [
      "Don't let your hips curl up off the seat at the bottom; stop where your back stays flat.",
      "Don't let your knees cave inward; keep them in line with your toes.",
      "Don't snap your knees into hard lockout at the top.",
      "Don't cut depth to move more weight; use a load you can take deep.",
    ],
    video: { youtubeId: "B6rGDcfyPto", title: "How To Leg Press For Best Quad Growth | Targeting The Muscle Series", channel: "Renaissance Periodization", seconds: 737, start: 0 },
  },
  goblet_squat: {
    setup: [
      "Hold one dumbbell upright against your chest, cupping the top end with both hands.",
      "Stand with your feet about shoulder width apart, toes turned out slightly.",
      "Brace your abs and keep your elbows tucked under the dumbbell.",
    ],
    steps: [
      "Sit straight down between your heels, taking 2–3 seconds on the way down.",
      "Let your knees travel forward and out over your toes while your chest stays tall.",
      "Go as deep as you can with your heels down and back flat, ideally thighs below parallel.",
      "Drive through your whole foot to stand back up tall.",
    ],
    mistakes: [
      "Don't let your knees cave in; push them out in line with your toes.",
      "Don't let your heels lift; keep your weight spread through your whole foot.",
      "Don't let the dumbbell pull your chest forward; keep it tight against your body.",
      "Don't drop and bounce out of the bottom; control the way down.",
    ],
    video: { youtubeId: "CkFzgR55gho", title: "How to Perform Dumbbell Goblet Squat", channel: "Physique Development", seconds: 87, start: 0 },
  },
  heel_elevated_db_squat: {
    setup: [
      "Put a small plate or wedge under your heels only, with the balls of your feet on the floor.",
      "Stand with your feet about hip to shoulder width apart, a dumbbell hanging at each side.",
      "Brace your abs and stand tall with your shoulders down.",
    ],
    steps: [
      "Bend your knees and let them travel well forward over your toes as you sink down.",
      "Keep your torso upright and lower over 2–3 seconds, as deep as you can.",
      "Pause for a moment at the bottom without bouncing.",
      "Push through your whole foot to stand back up tall.",
    ],
    mistakes: [
      "Don't stand with your whole foot on the plate; only your heels should be raised.",
      "Don't lean forward or push your hips back; stay upright so your quads do the work.",
      "Don't let your knees cave inward; keep them tracking over your toes.",
      "Don't cut depth short; the heel lift is there so you can squat all the way down.",
    ],
    video: { youtubeId: "HB8QewGsIX4", title: "Small Quads? Try This! (SQUAT TIPS)", channel: "Mind Pump TV", seconds: 348, start: 0 },
  },
  bulgarian_split_squat: {
    setup: [
      "Stand a long stride in front of the bench, holding a dumbbell at each side.",
      "Rest the top of your back foot on the bench, laces down.",
      "Set your front foot far enough out that your shin stays fairly upright at the bottom.",
      "Brace your abs and keep your chest up.",
    ],
    steps: [
      "Sink straight down by bending your front knee, taking 2–3 seconds.",
      "Lower until your back knee is just above the floor and your front thigh is about parallel.",
      "Keep most of your weight on your front foot and use the back leg only for balance.",
      "Drive through your whole front foot to stand back up, and finish all reps before switching legs.",
    ],
    mistakes: [
      "Don't stand too close to the bench; it shoves your front knee forward and lifts your heel.",
      "Don't push off with your back foot; let the front leg do the work.",
      "Don't let your front knee cave inward; keep it tracking over your toes.",
      "Don't bounce out of the bottom; control the way down on every rep.",
    ],
    video: { youtubeId: "SkNsa3eBwLA", title: "How to do the BULGARIAN SPLIT SQUAT! | 2 Minute Tutorial", channel: "Max Euceda", seconds: 120, start: 0 },
  },
  db_reverse_lunge: {
    setup: [
      "Stand tall with your feet hip width apart and a dumbbell hanging at each side.",
      "Brace your abs, keep your chest up, and pull your shoulders down and back.",
    ],
    steps: [
      "Take a long step straight back and land on the ball of your back foot.",
      "Lower slowly over 2–3 seconds until your back knee is just above the floor.",
      "Keep most of your weight on your front foot and your torso upright.",
      "Drive through your front foot to bring your back leg forward and stand tall again.",
    ],
    mistakes: [
      "Don't take a short step back; a cramped stance puts extra stress on your front knee.",
      "Don't push off with your back foot; drive each rep through your front leg.",
      "Don't let the dumbbells swing; keep them hanging still at your sides.",
      "Don't let your front knee cave inward; keep it in line with your toes.",
    ],
    video: { youtubeId: "sjlsISvHyZs", title: "How To: Dumbbell Reverse Lunge", channel: "ScottHermanFitness", seconds: 188, start: 0 },
  },
  db_step_up: {
    setup: [
      "Use a sturdy bench about knee height or a little lower.",
      "Stand facing the bench with a dumbbell hanging at each side.",
      "Place your whole working foot flat on the bench.",
    ],
    steps: [
      "Lean slightly forward and shift your weight onto the foot on the bench.",
      "Push through the heel of that foot to stand all the way up, hip and knee straight.",
      "Lower slowly over 2–3 seconds, reaching your other foot down to the floor.",
      "Touch the floor lightly and go straight into the next rep, finishing all reps before switching legs.",
    ],
    mistakes: [
      "Don't push off the floor with your back foot; let the leg on the bench do the work.",
      "Don't drop back down; control the lowering with your working leg.",
      "Don't let your working knee cave inward; keep it in line with your toes.",
      "Don't let your heel hang off the edge; keep your whole foot on the bench.",
    ],
    video: { youtubeId: "hgkk12L_Umk", title: "HOW TO DO A DUMBBELL STEP-UP | Coach Kelly Cues", channel: "Kelly Matthews", seconds: 260, start: 0 },
  },
  leg_extension: {
    setup: [
      "Adjust the back pad so your knees line up with the machine's pivot point.",
      "Set the shin pad just above your ankles.",
      "If the backrest tilts, set it back a little for a bigger stretch on the front of your thighs.",
      "Hold the side handles and pull your hips down into the seat.",
    ],
    steps: [
      "Start with your knees bent as far as the machine allows.",
      "Straighten your legs until your knees are fully extended.",
      "Pause and squeeze your quads for about a second at the top.",
      "Lower slowly over 2–3 seconds back to the full bend.",
    ],
    mistakes: [
      "Don't let your hips lift off the seat; pull yourself down with the handles.",
      "Don't swing the weight up; lift with control so you can pause at the top.",
      "Don't cut the bottom short; let your knees bend fully before the next rep.",
      "Don't sit with your knees out of line with the pivot; it strains the joint.",
    ],
    video: { youtubeId: "ljO4jkwv8wQ", title: "How To Do Leg Extensions With Perfect Technique (Grow Every Quad Head)", channel: "Jeff Nippard", seconds: 397, start: 209 },
  },
  smith_squat: {
    setup: [
      "Set the bar at upper chest height and the safety stops just below your bottom position.",
      "Step under the bar, rest it across your upper back, and grip it just outside your shoulders.",
      "Place your feet shoulder width apart and slightly forward of the bar, toes turned out a little.",
      "Brace your abs, then rotate the bar to unhook it.",
    ],
    steps: [
      "Bend your knees and hips together and lower over 2–3 seconds.",
      "Squat deep, as low as you can with your heels down and your lower back flat.",
      "Keep your chest up and your knees tracking over your toes the whole way.",
      "Drive through your whole foot back up to standing.",
    ],
    mistakes: [
      "Don't stand with your feet right under the bar; set them slightly forward so your heels stay down.",
      "Don't put your feet so far forward that your lower back rounds at the bottom.",
      "Don't stop high; squat deep for a full stretch on your quads.",
      "Don't drop and bounce; control the way down on every rep.",
    ],
    video: { youtubeId: "fEuYM-miK5U", title: "9 Smith Machine Squat Mistakes and How to Fix Them", channel: "Renaissance Periodization", seconds: 843, start: 0 },
  },
  barbell_back_squat: {
    setup: [
      "Set the rack safeties just below your lowest squat position.",
      "Set the bar at upper chest height, grip it just outside your shoulders, and step under it.",
      "Rest the bar on your upper back, squeeze your shoulder blades together, and walk it out in a few steps.",
      "Stand with your feet about shoulder width apart, toes turned out slightly.",
    ],
    steps: [
      "Take a big breath into your belly and brace hard before each rep.",
      "Sit down between your hips, letting your knees travel forward and out over your toes.",
      "Lower over 2–3 seconds as deep as you can with a flat back, ideally thighs below parallel.",
      "Drive up through your whole foot with your chest up until you're standing tall.",
    ],
    mistakes: [
      "Don't let your knees cave inward; push them out in line with your toes.",
      "Don't let your hips shoot up first; your chest and hips should rise together.",
      "Don't let your heels lift; keep your whole foot planted.",
      "Don't lose your brace at the bottom; hold your breath until you're past the hardest part.",
    ],
    video: { youtubeId: "gcNh17Ckjgg", title: "How to PROPERLY Squat for Growth (4 Easy Steps)", channel: "Jeremy Ethier", seconds: 435, start: 0 },
  },

  // Hamstrings
  db_romanian_deadlift: {
    setup: [
      "Stand with your feet about hip-width apart, a dumbbell in each hand in front of your thighs.",
      "Unlock your knees slightly and keep that same small bend for the whole set.",
      "Brace your abs and pull your shoulders back so your back is flat.",
    ],
    steps: [
      "Push your hips straight back and let the dumbbells slide down the front of your legs.",
      "Lower slowly over two to three seconds, keeping your back flat and the dumbbells close.",
      "Stop at a deep hamstring stretch, usually around mid-shin, before your back starts to round.",
      "Drive your hips forward to stand back up, keeping the dumbbells close to your legs.",
      "Finish standing tall with your glutes squeezed, without leaning back.",
    ],
    mistakes: [
      "Don't turn it into a squat; keep the knee bend small and move from your hips.",
      "Don't round your back to reach lower; stop where your back stays flat.",
      "Don't let the dumbbells drift forward; keep them brushing your thighs and shins.",
      "Don't lean back at the top; just stand tall and squeeze your glutes.",
    ],
    video: { youtubeId: "MAa24xjE9kk", title: "How to: Dumbbell Romanian Deadlift (RDL) - Hamstrings & Glutes", channel: "Physique Development", seconds: 202, start: 0 },
  },
  single_leg_db_rdl: {
    setup: [
      "Hold a dumbbell in the hand opposite your standing leg, or one in each hand.",
      "Stand on your working leg with a slight bend in that knee and your whole foot gripping the floor.",
      "Brace your abs and keep your back flat with your chest up.",
      "Lightly hold a rack or bench with your free hand if balance limits you.",
    ],
    steps: [
      "Push your hips back while your free leg swings back as a counterweight, in line with your body.",
      "Lower slowly with your hips square to the floor and the dumbbell close to your standing leg.",
      "Stop at a deep hamstring stretch in your standing leg, usually with your torso near parallel to the floor.",
      "Drive through your standing heel and bring your hips forward to stand back up.",
      "Finish tall on your standing leg, and do all your reps before switching sides.",
    ],
    mistakes: [
      "Don't let your hips twist open; keep both hip bones pointing at the floor.",
      "Don't squat down on the standing leg; keep a small knee bend and hinge at your hip.",
      "Don't round your back to reach the floor; stop when the stretch peaks.",
      "Don't rush to catch your balance; slow down and use a light hand hold if needed.",
    ],
    video: { youtubeId: "ViVhUZGk6i4", title: "Single Leg RDL...You're Doing It WRONG", channel: "Coach PJ Nestler", seconds: 206, start: 0 },
  },
  leg_curl: {
    setup: [
      "Adjust the machine so your knee lines up with its pivot point.",
      "Set the ankle pad so it sits just above your heels, not on your calves.",
      "On a seated machine, lock the thigh pad down snug; lying down, press your hips into the pad.",
      "Hold the handles and keep your upper body still.",
    ],
    steps: [
      "Start with your legs almost straight and the weight just off the stack.",
      "Curl your heels toward your butt as far as the machine allows.",
      "Squeeze for a moment at full bend.",
      "Lower slowly over two to three seconds until your legs are straight and your hamstrings fully stretch.",
    ],
    mistakes: [
      "Don't cut the range short; curl all the way and straighten fully each rep.",
      "Don't let your hips lift off the pad; lighten the weight so they stay down.",
      "Don't let the weight drop back; control the whole way down.",
      "Don't set the ankle pad on your calves; it belongs just above your heels.",
    ],
    video: { youtubeId: "jobEeklwrrs", title: "9 Leg Curl Mistakes and How to Fix Them", channel: "Renaissance Periodization", seconds: 743, start: 31 },
  },
  barbell_rdl: {
    setup: [
      "Set the bar in a rack at mid-thigh height and lift it out, or deadlift it up from the floor.",
      "Stand with your feet hip-width apart and grip the bar overhand, just outside your thighs.",
      "Unlock your knees slightly, brace your abs, and pull your shoulders back.",
    ],
    steps: [
      "Push your hips back and let the bar slide down your thighs, staying in contact or close.",
      "Lower slowly over two to three seconds, keeping your back flat and your shins nearly vertical.",
      "Stop at a deep hamstring stretch, usually somewhere between just below your knees and mid-shin.",
      "Drive your hips forward to stand up, keeping the bar close to your legs.",
      "Finish standing tall with your glutes squeezed, without leaning back.",
    ],
    mistakes: [
      "Don't let the bar drift away from your legs; drag it down your thighs.",
      "Don't bend your knees more as you lower; push your hips back instead.",
      "Don't round your back to reach the floor; stop where your back stays flat.",
      "Don't lean back at the top; stand tall and squeeze your glutes.",
    ],
    video: { youtubeId: "_oyxCn2iSjU", title: "HOW TO DO ROMANIAN DEADLIFTS (RDLs): Build Beefy Hamstrings With Perfect Technique", channel: "Jeff Nippard", seconds: 382, start: 0 },
  },
  smith_rdl: {
    setup: [
      "Set the safety stops just below the lowest point you'll lower the bar to.",
      "Stand close to the bar with your feet hip-width apart, the bar touching your thighs.",
      "Grip just outside your thighs, twist the bar off the hooks, and stand tall with knees slightly unlocked.",
      "Brace your abs and pull your shoulders back.",
    ],
    steps: [
      "Push your hips back and let the bar slide down your thighs.",
      "Lower slowly over two to three seconds, keeping your back flat.",
      "Stop at a deep hamstring stretch, usually around mid-shin.",
      "Drive your hips forward to stand up, keeping the bar against your legs.",
      "Finish tall with your glutes squeezed, then start the next rep.",
    ],
    mistakes: [
      "Don't stand too far from the bar; it should touch your thighs at the start.",
      "Don't bend your knees more as you lower; keep the movement at your hips.",
      "Don't round your back chasing depth; stop where your back stays flat.",
    ],
    video: { youtubeId: "VQiEo80QQ18", title: "How to: Smith Machine RDL & Stiff Leg Deadlift", channel: "Andreos Canavati", seconds: 96, start: 0 },
  },
  db_leg_curl: {
    setup: [
      "Lie face down on a flat bench with your knees just past the end.",
      "Squeeze the dumbbell handle between your feet so the top end rests on your soles.",
      "Have a partner hand you the dumbbell if it's hard to get into place.",
      "Hold the bench firmly and press your hips into the pad.",
    ],
    steps: [
      "Start with your knees bent about 90°, squeezing the dumbbell tight between your feet.",
      "Lower slowly until your legs are almost straight and your hamstrings are fully stretched.",
      "Curl your heels slowly back up toward your butt, keeping your hips down.",
      "Stop when your shins are about vertical, where the tension starts to fade, then lower again.",
    ],
    mistakes: [
      "Don't loosen your feet; keep squeezing the dumbbell all set so it can't slip.",
      "Don't lift your hips to help the curl; keep them pressed into the bench.",
      "Don't let the dumbbell drop on the way down; lower it under control.",
      "Don't go too heavy; pick a weight you can hold safely through the full range.",
    ],
    video: { youtubeId: "xSjmKTf4QbA", title: "How To: Dumbbell Hamstring Curl", channel: "ScottHermanFitness", seconds: 176, start: 0 },
  },

  // Glutes
  db_hip_thrust: {
    setup: [
      "Sit on the floor with your upper back against the long side of a bench, just below your shoulder blades.",
      "Set the dumbbell across your hip crease and hold both ends to keep it steady.",
      "Plant your feet flat about shoulder-width apart, close enough that your shins are vertical at the top.",
      "Tuck your chin slightly and brace your abs.",
    ],
    steps: [
      "Drive through your heels and push your hips up, pivoting your upper back on the bench.",
      "Rise until your hips are fully extended and your body is straight from knees to shoulders.",
      "Squeeze your glutes hard for a full second at the top.",
      "Lower slowly until your hips are just above the floor, then drive up again.",
    ],
    mistakes: [
      "Don't arch your lower back at the top; keep your ribs down and finish with your glutes.",
      "Don't set your feet too far out; adjust them so your shins are vertical at the top.",
      "Don't rush through the top; hold the squeeze for a full second.",
      "Don't let your upper back slide up the bench; keep it just below your shoulder blades.",
    ],
    video: { youtubeId: "T55MKVmc0G0", title: "Dumbbell Hip Thrust Form | How To Dumbbell Hip Thrust On a Bench", channel: "Lift With Michelle - Exercise Form Tutorials", seconds: 137, start: 0 },
  },
  smith_hip_thrust: {
    setup: [
      "Set a bench behind you inside the Smith machine so the bar lines up over your hips.",
      "Put a bar pad or folded mat on the bar, and set the safety stops just above the floor.",
      "Sit with your upper back on the bench edge, just below your shoulder blades, bar in your hip crease.",
      "Plant your feet so your shins will be vertical at the top, and hold the bar to steady it.",
    ],
    steps: [
      "Drive your hips up to lift the bar, then twist it off the hooks.",
      "Lower slowly until your hips are just above the floor.",
      "Drive up through your heels to full lockout, body straight from knees to shoulders.",
      "Squeeze your glutes for a second at the top, then lower again.",
      "After your last rep, twist the bar back onto the hooks at the top.",
    ],
    mistakes: [
      "Don't stop short of lockout; finish every rep with your hips fully extended.",
      "Don't arch your lower back to get higher; keep your ribs down and chin tucked.",
      "Don't let the bar ride up onto your stomach; keep it in your hip crease.",
    ],
    video: { youtubeId: "ADgWjz9i42Y", title: "How to: Smith Machine Glute Bridge (Hip Thrust) | Grow Bigger Glutes w/ Minimal Setup", channel: "Physique Development", seconds: 138, start: 0 },
  },
  barbell_hip_thrust: {
    setup: [
      "Sit on the floor with your upper back against a stable bench, just below your shoulder blades.",
      "Roll the padded bar over your legs until it sits in your hip crease.",
      "Plant your feet about shoulder-width apart, close enough that your shins are vertical at the top.",
      "Grip the bar on both sides of your hips, tuck your chin, and brace.",
    ],
    steps: [
      "Drive through your heels and push your hips up, pivoting your upper back on the bench.",
      "Rise until your hips are fully locked out and your body is straight from knees to shoulders.",
      "Squeeze your glutes hard at the top for a moment, chin still tucked.",
      "Lower under control until your hips are just above the floor, then drive up again.",
    ],
    mistakes: [
      "Don't arch your lower back at the top; keep your ribs down and finish with your glutes.",
      "Don't throw your head back; keep your chin tucked and eyes looking forward.",
      "Don't let the bench slide; brace it against a wall or rack.",
      "Don't guess your foot spot; move your feet until your shins are vertical at the top.",
    ],
    video: { youtubeId: "LM8XHLYJoYs", title: "Proper Hip Thrust Form", channel: "Bret Contreras Glute Guy", seconds: 275, start: 0 },
  },
  cable_pull_through: {
    setup: [
      "Set the pulley at its lowest position and attach a rope.",
      "Face away from the stack, reach between your legs, and grab the rope with both hands.",
      "Walk out a couple of steps so the weight lifts off the stack, feet a little wider than hip-width.",
      "Unlock your knees slightly and brace your abs.",
    ],
    steps: [
      "Push your hips back and let the rope pull your hands back between your legs.",
      "Lower slowly with a flat back until you feel a deep stretch in your hamstrings and glutes.",
      "Snap your hips forward to stand up, keeping your arms straight.",
      "Finish standing tall with your glutes squeezed, without leaning back.",
    ],
    mistakes: [
      "Don't pull with your arms; they just hold the rope while your hips do the work.",
      "Don't squat down; keep a small knee bend and push your hips back.",
      "Don't lean back at the top; stand tall and squeeze your glutes.",
      "Don't stand too close to the stack; step out far enough to keep tension at the bottom.",
    ],
    video: { youtubeId: "yXopOhzEoeo", title: "How to PROPERLY Perform a Glute Pull Through | Fix Your Cable Pull Through Form NOW!", channel: "Colossus Fitness", seconds: 220, start: 0 },
  },
  db_glute_bridge: {
    setup: [
      "Lie on your back on the floor, knees bent and feet flat about hip-width apart.",
      "Bring your heels in close enough that your fingertips can almost touch them.",
      "Rest the dumbbell across your hip crease and hold both ends to keep it steady.",
      "Brace your abs and keep your ribs down.",
    ],
    steps: [
      "Drive through your heels and lift your hips off the floor.",
      "Rise until your body is straight from knees to shoulders.",
      "Squeeze your glutes hard for a second at the top.",
      "Lower slowly until your hips lightly touch the floor, then drive up again.",
    ],
    mistakes: [
      "Don't arch your lower back to get higher; stop when your hips line up with your torso.",
      "Don't push through your toes; keep your weight in your heels.",
      "Don't bounce off the floor; lower under control and touch lightly.",
      "Don't let your knees cave in; keep them in line with your feet.",
    ],
    video: { youtubeId: "E6VLOEz7tWE", title: "Dumbbell Glute Bridge Tutorial (for Beginners)", channel: "Tim Bullici", seconds: 114, start: 0 },
  },

  // Calves
  single_leg_db_calf_raise: {
    setup: [
      "Hold a dumbbell in the hand on the same side as your working leg.",
      "Stand with the ball of your working foot on the edge of a step, heel hanging off.",
      "Hook your other foot behind your ankle and hold something solid with your free hand.",
    ],
    steps: [
      "Lower your heel slowly until you feel a deep stretch in your calf.",
      "Pause for one to two seconds in the stretch.",
      "Rise onto the ball of your foot as high as you can.",
      "Squeeze briefly at the top, then lower slowly again.",
      "Finish all your reps on one leg before switching.",
    ],
    mistakes: [
      "Don't bounce out of the bottom; pause in the stretch every rep.",
      "Don't cut the top short; rise all the way up onto your big toe.",
      "Don't bend your knee to help; keep the working leg straight but not locked.",
      "Don't roll onto the outside of your foot; push through your big toe.",
    ],
    video: { youtubeId: "RodSTSylf94", title: "How To: Standing Single Dumbbell Single Leg Calf Raise", channel: "Live Lean TV Daily Exercises", seconds: 69, start: 0 },
  },
  leg_press_calf_raise: {
    setup: [
      "Sit in the leg press with the balls of your feet on the platform's bottom edge, heels hanging off.",
      "Set your feet about hip-width apart with your toes pointing straight ahead.",
      "Press the platform up until your legs are straight, with your knees just short of locked.",
      "Keep your back flat on the pad and hold the handles.",
    ],
    steps: [
      "Let the platform push your toes back toward you slowly until you feel a deep calf stretch.",
      "Pause for one to two seconds in the stretch.",
      "Push through the balls of your feet and point your toes as far as you can.",
      "Squeeze briefly at the top, then lower slowly again.",
    ],
    mistakes: [
      "Don't bend your knees to move the weight; keep them almost straight the whole set.",
      "Don't let your feet slide up the platform; keep just the balls of your feet on the edge.",
      "Don't bounce through short reps; use the full stretch and full push every rep.",
    ],
    video: { youtubeId: "PYZY00hI43w", title: "How to PROPERLY Calf Raise on The Leg Press Machine (FIX THIS!)", channel: "Colossus Fitness", seconds: 111, start: 0 },
  },
  smith_calf_raise: {
    setup: [
      "Place a weight plate or sturdy step under the Smith bar.",
      "Set the bar at about shoulder height, step under it, and rest it across your upper back.",
      "Stand with the balls of your feet on the plate edge, heels hanging off, feet hip-width apart.",
      "Twist the bar off the hooks and stand tall with your knees straight but not locked.",
    ],
    steps: [
      "Lower your heels slowly until you feel a deep stretch in your calves.",
      "Pause for one to two seconds at the bottom.",
      "Rise onto the balls of your feet as high as you can.",
      "Squeeze briefly at the top, then lower slowly again.",
    ],
    mistakes: [
      "Don't bounce out of the bottom; hold the stretch before each rep.",
      "Don't bend your knees to push the bar up; keep your legs straight.",
      "Don't use a plate so thin your heels hit the floor; stand high enough for a full stretch.",
    ],
    video: { youtubeId: "FNdI5TynYxs", title: "How To Do A STANDING SMITH MACHINE CALF RAISE ON STEP | Exercise Demonstration Video and Guide", channel: "Live Lean TV Daily Exercises", seconds: 67, start: 0 },
  },
  seated_db_calf_raise: {
    setup: [
      "Sit on the end of a bench with a weight plate or step on the floor in front of you.",
      "Put the balls of your feet on the plate edge, heels hanging toward the floor.",
      "Stand the dumbbells on your knees, at the end of your thighs, and hold them steady.",
      "Sit tall with your shins vertical.",
    ],
    steps: [
      "Lower your heels slowly until you feel a deep stretch in your calves.",
      "Pause for one to two seconds at the bottom.",
      "Push through the balls of your feet and raise your heels as high as you can.",
      "Squeeze briefly at the top, then lower slowly again.",
    ],
    mistakes: [
      "Don't lift the dumbbells with your arms; just hold them in place.",
      "Don't bounce through half reps; get the full stretch and full rise every rep.",
      "Don't lean back; sit tall so the weight stays over your knees.",
    ],
    video: { youtubeId: "71lLP3aglGQ", title: "The Seated Dumbbell Calf Raise", channel: "Testosterone Nation", seconds: 107, start: 0 },
  },

  // Abs
  cable_crunch: {
    setup: [
      "Set the pulley high and attach a rope.",
      "Kneel facing the stack, about an arm's length away, and grab the rope with both hands.",
      "Hold the rope ends by your ears so the rope sits behind your head.",
      "Lean forward slightly at the hips so the weight lifts off the stack.",
    ],
    steps: [
      "Keep your hips still and curl your ribs down toward your hips, rounding your spine.",
      "Keep crunching until your elbows reach about your thighs and your abs are fully squeezed.",
      "Hold the squeeze for a moment at the bottom.",
      "Come back up slowly, letting your spine lengthen until you feel a stretch in your abs.",
    ],
    mistakes: [
      "Don't sit back onto your heels to move the weight; keep your hips in place.",
      "Don't pull with your arms; keep your hands fixed by your head.",
      "Don't keep your back flat and bow at the hips; round your spine to crunch.",
    ],
    video: { youtubeId: "_GUFTy1oBZY", title: "How to: Cable Rope Crunch for Abs | PhysiqueDevelopment.com", channel: "Physique Development", seconds: 243, start: 0 },
  },
  hanging_knee_raise: {
    setup: [
      "Grab a pull-up bar with an overhand grip about shoulder-width apart.",
      "Hang with straight arms and pull your shoulders slightly down, away from your ears.",
      "Let your legs hang still, knees slightly bent, before the first rep.",
    ],
    steps: [
      "Curl your knees up toward your chest, rolling your pelvis up toward your ribs.",
      "Keep going until your hips tilt up and your lower back rounds, not just until your thighs hit parallel.",
      "Pause briefly at the top with your abs squeezed.",
      "Lower your legs slowly until they hang straight below you, without swinging.",
    ],
    mistakes: [
      "Don't swing for momentum; pause at the bottom of each rep to stay still.",
      "Don't stop with your thighs at parallel; tilt your pelvis up to finish each rep.",
      "Don't let your legs drop; lower them over two to three seconds.",
    ],
    video: { youtubeId: "X-ACS9vpRyU", title: "How To: Hanging Knee / Leg Raise | BUILD A “SCIENCED BASED” 6-PACK!", channel: "ScottHermanFitness", seconds: 431, start: 0 },
  },
  db_weighted_crunch: {
    setup: [
      "Lie on your back on the floor with your knees bent and feet flat.",
      "Hold one dumbbell flat against your chest with both hands.",
      "Tuck your chin slightly, leaving about a fist of space between your chin and chest.",
    ],
    steps: [
      "Curl your ribs toward your hips, lifting your head and shoulder blades off the floor.",
      "Keep curling until your upper back is off the floor and your abs are fully squeezed.",
      "Pause for a moment at the top.",
      "Lower slowly until your shoulders touch the floor, then start the next rep.",
    ],
    mistakes: [
      "Don't yank your head forward; keep your chin tucked and move from your ribs.",
      "Don't sit all the way up; your lower back stays on the floor.",
      "Don't drop back down; lower your shoulders under control.",
    ],
    video: { youtubeId: "cbwLMF7oJGI", title: "How To Do Weighted Crunch", channel: "Jim Stoppani, PhD", seconds: 136, start: 0 },
  },
  lying_leg_raise: {
    setup: [
      "Lie on your back on the floor with your legs straight and your arms by your sides, palms down.",
      "Press your lower back flat into the floor and brace your abs.",
      "Keep a slight bend in your knees if your hamstrings feel tight.",
    ],
    steps: [
      "Raise your legs together until they point straight up, about 90° from the floor.",
      "Lower your legs slowly over about three seconds, keeping your lower back pressed down.",
      "Stop just before your heels touch the floor, or sooner if your lower back starts to lift.",
      "Raise your legs again smoothly, without swinging.",
    ],
    mistakes: [
      "Don't let your lower back arch off the floor; stop lowering before it does.",
      "Don't drop your legs fast; control them the whole way down.",
      "Don't swing your legs up with momentum; raise them smoothly.",
      "Don't push hard into the floor with your hands; let your abs do the work.",
    ],
    video: { youtubeId: "3oIpxsn6FxQ", title: "Perfect Lying Leg Raises Form to Strengthen Your Core & Avoid Back Pain", channel: "Mobility Doc", seconds: 135, start: 0 },
  },
};

export function getExerciseGuide(id: string): ExerciseGuide | undefined {
  return EXERCISE_GUIDES[id];
}

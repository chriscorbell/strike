import type { Profile } from "../src/index.ts";

export const profile: Profile = {
  name: "Chris",
  sex: "male",
  birthDate: "1994-05-10",
  heightCm: 180,
  units: "imperial",
  timezone: "America/New_York",
  activityLevel: "light",
  goal: { type: "lose", ratePercentPerWeek: 0.5, targetWeightKg: 80 },
  training: {
    experience: "intermediate",
    days: [1, 2, 4, 5],
    sessionMinutes: 60,
    workoutTime: "17:30",
    defaultLocation: "gym",
    focusMuscles: ["side_delts"],
    limitations: "",
  },
  equipment: {
    home: { available: true, dumbbells: { kind: "adjustable", min: 5, max: 52.5, step: 2.5 }, items: [], machineStep: 10, notes: "" },
    gym: {
      available: true,
      dumbbells: { kind: "fixed", weights: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75] },
      items: ["bench_adjustable", "cable", "lat_pulldown", "leg_press", "leg_extension", "leg_curl", "smith_machine"],
      machineStep: 10,
      notes: "",
    },
  },
  schedule: { wakeTime: "07:00", sleepTime: "23:00", checkInDay: 0 },
  nutrition: {
    mealsPerDay: 4,
    dietStyle: "omnivore",
    allergies: [],
    avoidFoods: "",
    favoriteFoods: "",
    cookingTime: "moderate",
    weeklyBudgetUsd: 90,
    grabAndGo: ["Chipotle", "Publix deli"],
    kitchen: ["microwave", "stove", "oven", "air_fryer"],
  },
};

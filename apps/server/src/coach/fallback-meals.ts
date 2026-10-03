// Rule-based meal options for when the coach is unavailable (and for mock mode). Portions are solved
// from simple foods so each option's macros land near its slot's targets.
import type { GroceryCatalogItem, Macros, MealOption, MealRole, Profile } from "@strike/core";

interface Food {
  name: string;
  /** Macros per unit. */
  p: number;
  c: number;
  f: number;
  unit: "g" | "piece" | "tbsp" | "scoop" | "slice";
  /** Rounding step for the unit. */
  step: number;
  costPerUnit: number;
  section: string;
  /** Most of this food one meal should call for. */
  max: number;
}

const g = (name: string, p100: number, c100: number, f100: number, costPerLb: number, section: string, max = 350): Food => ({
  name,
  p: p100 / 100,
  c: c100 / 100,
  f: f100 / 100,
  unit: "g",
  step: 10,
  costPerUnit: costPerLb / 453.6,
  section,
  max,
});
const u = (name: string, unit: Food["unit"], p: number, c: number, f: number, cost: number, section: string, step = 1, max = 3): Food => ({ name, p, c, f, unit, step, costPerUnit: cost, section, max });

const F = {
  chicken: g("chicken breast (raw weight)", 23, 0, 2, 3.5, "Meat"),
  turkey: g("93% lean ground turkey (raw)", 19, 0, 7, 5, "Meat"),
  beef: g("93% lean ground beef (raw)", 21, 0, 7, 6, "Meat"),
  salmon: g("salmon fillet (raw)", 20, 0, 13, 9, "Seafood"),
  tuna: g("canned tuna in water, drained", 25, 0, 1, 7, "Pantry"),
  eggWhites: g("liquid egg whites", 11, 0.7, 0.2, 3, "Dairy & eggs", 300),
  greekYogurt: g("nonfat Greek yogurt", 10, 3.6, 0.4, 2.5, "Dairy & eggs", 400),
  cottage: g("low-fat cottage cheese", 11, 3.4, 2.3, 2.5, "Dairy & eggs", 400),
  tofu: g("extra-firm tofu", 17, 3, 9, 3, "Produce"),
  tempeh: g("tempeh", 20, 8, 11, 6, "Produce"),
  whey: u("whey protein", "scoop", 24, 3, 1.5, 0.9, "Supplements", 0.5, 2),
  plantProtein: u("plant protein powder", "scoop", 21, 4, 2, 1.1, "Supplements", 0.5, 2),
  eggs: u("eggs", "piece", 6.3, 0.4, 5, 0.3, "Dairy & eggs", 1, 4),
  rice: g("cooked white rice", 2.7, 28, 0.3, 1, "Pantry", 400),
  potato: g("potatoes", 2, 17, 0.1, 1, "Produce", 500),
  pasta: g("cooked pasta", 5.8, 31, 0.9, 1.2, "Pantry", 400),
  oats: g("rolled oats (dry)", 13, 68, 6.5, 1.5, "Pantry", 120),
  berries: g("frozen mixed berries", 0.7, 12, 0.3, 3.5, "Frozen", 250),
  toast: u("whole-wheat bread", "slice", 4, 12, 1, 0.2, "Bakery", 1, 4),
  bagel: u("plain bagel", "piece", 10, 55, 1.5, 0.75, "Bakery", 0.5, 1.5),
  banana: u("bananas", "piece", 1.3, 27, 0.4, 0.25, "Produce", 1, 2),
  tortilla: u("large flour tortillas", "piece", 5, 30, 5, 0.4, "Bakery", 1, 2),
  riceCakes: u("rice cakes", "piece", 0.7, 7.3, 0.3, 0.15, "Pantry", 1, 4),
  oil: u("olive oil", "tbsp", 0, 0, 14, 0.2, "Pantry", 0.5, 2),
  pb: u("peanut butter", "tbsp", 3.5, 3.5, 8, 0.15, "Pantry", 0.5, 2),
  avocado: u("avocado", "piece", 3, 12, 22, 1.2, "Produce", 0.5, 1),
  cheese: g("shredded cheese", 25, 1.3, 33, 5, "Dairy & eggs", 40),
  almonds: g("almonds", 21, 22, 50, 7, "Pantry", 40),
  veg: g("frozen broccoli or mixed vegetables", 3, 7, 0.3, 1.5, "Frozen"),
};

/** How each food is bought: unit, purchase units per recipe unit, and the package a store sells. */
interface Buy {
  unit: GroceryCatalogItem["unit"];
  pieceName?: string;
  factor: number;
  size: number;
  label: string;
  price: number;
  staple?: boolean;
}

const b = (unit: Buy["unit"], factor: number, size: number, label: string, price: number, staple = false, pieceName?: string): Buy => ({ unit, factor, size, label, price, staple, pieceName });

const BUY: Record<keyof typeof F, Buy> = {
  chicken: b("g", 1, 1360, "3 lb family pack", 10.5),
  turkey: b("g", 1, 454, "1 lb pack", 5.5),
  beef: b("g", 1, 454, "1 lb pack", 6.5),
  salmon: b("g", 1, 454, "1 lb of fillets", 10),
  tuna: b("piece", 1 / 113, 1, "5 oz can", 1.5, false, "cans"),
  eggWhites: b("g", 1, 907, "32 oz carton", 6),
  greekYogurt: b("g", 1, 907, "32 oz tub", 5.5),
  cottage: b("g", 1, 680, "24 oz tub", 4.5),
  tofu: b("g", 1, 397, "14 oz block", 2.5),
  tempeh: b("g", 1, 227, "8 oz pack", 3.5),
  whey: b("piece", 1, 30, "2 lb tub (30 scoops)", 30, true, "scoops"),
  plantProtein: b("piece", 1, 25, "tub (25 scoops)", 30, true, "scoops"),
  eggs: b("piece", 1, 12, "dozen", 3.5, false, "eggs"),
  // Recipes use cooked rice and pasta; stores sell them dry.
  rice: b("g", 1 / 3, 2268, "5 lb bag", 6, true),
  potato: b("g", 1, 2268, "5 lb bag", 5),
  pasta: b("g", 1 / 2.4, 454, "1 lb box", 1.6),
  oats: b("g", 1, 1190, "42 oz canister", 5, true),
  berries: b("g", 1, 1360, "3 lb frozen bag", 9),
  toast: b("piece", 1, 20, "loaf", 3, false, "slices"),
  bagel: b("piece", 1, 6, "6-pack", 4, false, "bagels"),
  banana: b("piece", 1, 1, "banana", 0.3, false, "bananas"),
  tortilla: b("piece", 1, 8, "8-pack", 3.5, false, "tortillas"),
  riceCakes: b("piece", 1, 14, "pack of 14", 3, false, "rice cakes"),
  oil: b("ml", 15, 500, "500 ml bottle", 7, true),
  pb: b("g", 16, 454, "16 oz jar", 3.5, true),
  avocado: b("piece", 1, 1, "avocado", 1.2, false, "avocados"),
  cheese: b("g", 1, 227, "8 oz bag", 3),
  almonds: b("g", 1, 454, "16 oz bag", 7),
  veg: b("g", 1, 907, "32 oz frozen bag", 4),
};

const KEY = new Map(Object.entries(F).map(([key, food]) => [food, key as keyof typeof F]));

export function fallbackCatalog(): GroceryCatalogItem[] {
  return Object.entries(F).map(([key, food]) => {
    const buy = BUY[key as keyof typeof F];
    const name = food.name.replace(/ \((raw|raw weight|dry)\)$/, "").replace(/^cooked /, "");
    return { id: key, name: name.charAt(0).toUpperCase() + name.slice(1), section: food.section, unit: buy.unit, pieceName: buy.pieceName, packageSize: buy.size, packageLabel: buy.label, packagePrice: buy.price, staple: buy.staple ?? false };
  });
}

interface Template {
  /** Breakfast food, offered first at breakfast and not later in the day. */
  breakfast?: boolean;
  name: string;
  summary: string;
  protein: Food;
  carb: Food;
  fat: Food | null;
  veg: boolean;
  roles: MealRole[];
  diets: Profile["nutrition"]["dietStyle"][];
  prepMinutes: number;
  steps: string[];
}

const ALL: Profile["nutrition"]["dietStyle"][] = ["omnivore", "pescatarian", "vegetarian", "vegan"];
const ANIMAL: Profile["nutrition"]["dietStyle"][] = ["omnivore", "pescatarian", "vegetarian"];
const MEAT: Profile["nutrition"]["dietStyle"][] = ["omnivore"];
const FISH: Profile["nutrition"]["dietStyle"][] = ["omnivore", "pescatarian"];

const TEMPLATES: Template[] = [
  { breakfast: true, name: "Greek yogurt oats bowl", summary: "Overnight-style oats with yogurt, berries and peanut butter.", protein: F.greekYogurt, carb: F.oats, fat: F.pb, veg: false, roles: ["regular", "bedtime"], diets: ANIMAL, prepMinutes: 5, steps: ["Stir the oats into the yogurt with a splash of water.", "Top with berries and peanut butter. Make it the night before if you like it soft."] },
  { breakfast: true, name: "Egg-white scramble and toast", summary: "Eggs and whites scrambled, toast on the side.", protein: F.eggWhites, carb: F.toast, fat: F.eggs, veg: true, roles: ["regular"], diets: ANIMAL, prepMinutes: 10, steps: ["Scramble the eggs and egg whites in a nonstick pan.", "Toast the bread; add vegetables to the pan if you have them."] },
  { name: "Chicken, rice and broccoli", summary: "The classic: lean, cheap and easy to batch-cook.", protein: F.chicken, carb: F.rice, fat: F.oil, veg: true, roles: ["regular", "post_workout"], diets: MEAT, prepMinutes: 25, steps: ["Season and bake or air-fry the chicken (400°F, ~18 min).", "Microwave the rice and vegetables; drizzle with the oil and season."] },
  { name: "Turkey taco bowl", summary: "Seasoned ground turkey over rice with salsa.", protein: F.turkey, carb: F.rice, fat: F.avocado, veg: true, roles: ["regular", "post_workout"], diets: MEAT, prepMinutes: 20, steps: ["Brown the turkey with taco seasoning.", "Serve over rice with vegetables, salsa and sliced avocado."] },
  { name: "Beef and potato skillet", summary: "Lean beef with crispy potatoes and vegetables.", protein: F.beef, carb: F.potato, fat: null, veg: true, roles: ["regular"], diets: MEAT, prepMinutes: 25, steps: ["Dice and microwave the potatoes 5 minutes, then crisp them in a pan.", "Brown the beef in the same pan, add vegetables, season."] },
  { name: "Salmon, rice and greens", summary: "Sheet-pan salmon with rice.", protein: F.salmon, carb: F.rice, fat: null, veg: true, roles: ["regular"], diets: FISH, prepMinutes: 20, steps: ["Bake the salmon at 400°F for 12–15 minutes.", "Serve with rice and steamed vegetables."] },
  { name: "Tuna pasta", summary: "Pasta tossed with tuna, olive oil and vegetables.", protein: F.tuna, carb: F.pasta, fat: F.oil, veg: true, roles: ["regular", "post_workout"], diets: FISH, prepMinutes: 15, steps: ["Cook the pasta; add frozen vegetables for the last 3 minutes.", "Drain and toss with tuna, olive oil, salt, pepper and lemon."] },
  { name: "Tofu stir-fry", summary: "Crispy tofu and vegetables over rice.", protein: F.tofu, carb: F.rice, fat: F.oil, veg: true, roles: ["regular", "post_workout"], diets: ALL, prepMinutes: 20, steps: ["Press and cube the tofu, pan-fry in the oil until golden.", "Add vegetables and soy sauce; serve over rice."] },
  { name: "Tempeh burrito", summary: "Crumbled tempeh, rice and salsa in a tortilla.", protein: F.tempeh, carb: F.tortilla, fat: null, veg: true, roles: ["regular"], diets: ALL, prepMinutes: 15, steps: ["Crumble and brown the tempeh with taco seasoning.", "Fill the tortillas with tempeh, vegetables and salsa."] },
  { name: "Protein shake and banana", summary: "Fast fuel that sits light before training.", protein: F.whey, carb: F.banana, fat: null, veg: false, roles: ["pre_workout", "post_workout"], diets: ANIMAL, prepMinutes: 2, steps: ["Shake the protein with water or milk; eat the banana."] },
  { name: "Plant protein shake and banana", summary: "Fast fuel that sits light before training.", protein: F.plantProtein, carb: F.banana, fat: null, veg: false, roles: ["pre_workout", "post_workout"], diets: ["vegan"], prepMinutes: 2, steps: ["Shake the protein with water or soy milk; eat the banana."] },
  { breakfast: true, name: "Bagel and egg whites", summary: "A bagel with an egg-white scramble.", protein: F.eggWhites, carb: F.bagel, fat: null, veg: false, roles: ["pre_workout", "post_workout", "regular"], diets: ANIMAL, prepMinutes: 8, steps: ["Toast the bagel.", "Scramble the egg whites with salt and pepper and pile them on."] },
  { name: "Rice cakes, yogurt and honey", summary: "Light, carb-forward, easy on the stomach.", protein: F.greekYogurt, carb: F.riceCakes, fat: null, veg: false, roles: ["pre_workout"], diets: ANIMAL, prepMinutes: 3, steps: ["Spread the yogurt on rice cakes with a drizzle of honey or jam."] },
  { name: "Cottage cheese and berries", summary: "Slow-digesting protein before bed.", protein: F.cottage, carb: F.berries, fat: F.almonds, veg: false, roles: ["bedtime"], diets: ANIMAL, prepMinutes: 2, steps: ["Top the cottage cheese with berries and almonds."] },
];

interface OutItem {
  name: string;
  place: string;
  order: string;
  macros: Macros;
  costUsd: number;
  diets: Profile["nutrition"]["dietStyle"][];
  roles: MealRole[];
}

const m = (kcal: number, proteinG: number, carbsG: number, fatG: number): Macros => ({ kcal, proteinG, carbsG, fatG });

const OUT: OutItem[] = [
  { name: "Chicken burrito bowl", place: "Chipotle", order: "Burrito bowl: double chicken, white rice, fajita veggies, fresh tomato salsa, lettuce. No cheese or sour cream.", macros: m(640, 66, 62, 16), costUsd: 14, diets: MEAT, roles: ["regular", "post_workout"] },
  { name: "Sofritas bowl", place: "Chipotle", order: "Burrito bowl: sofritas, white rice, black beans, fajita veggies, tomato salsa, lettuce.", macros: m(620, 28, 88, 18), costUsd: 12, diets: ALL, roles: ["regular", "post_workout"] },
  { name: "Grilled chicken sandwich and fruit", place: "Chick-fil-A", order: "Grilled chicken sandwich and a medium fruit cup.", macros: m(460, 29, 61, 12), costUsd: 10, diets: MEAT, roles: ["regular", "post_workout"] },
  { name: "Grilled nuggets meal", place: "Chick-fil-A", order: "12-count grilled nuggets, a side salad with light dressing, and a fruit cup.", macros: m(370, 40, 34, 8), costUsd: 12, diets: MEAT, roles: ["regular"] },
  { name: "Turkey sub, double meat", place: "Subway", order: "6-inch turkey on multigrain, double meat, all the vegetables, mustard, no mayo or cheese.", macros: m(400, 34, 48, 6), costUsd: 10, diets: MEAT, roles: ["regular", "post_workout"] },
  { name: "Rotisserie chicken plate", place: "Any grocery store", order: "Half a rotisserie chicken breast (skin off), a microwavable rice cup and a bagged salad kit.", macros: m(560, 55, 52, 14), costUsd: 9, diets: MEAT, roles: ["regular", "post_workout"] },
  { name: "Protein shake and banana", place: "Any convenience store", order: "A ready-to-drink protein shake (about 30 g protein, like Fairlife Core Power or Premier) and a banana.", macros: m(270, 31, 32, 4), costUsd: 5, diets: ANIMAL, roles: ["pre_workout", "post_workout", "regular"] },
  { name: "Greek yogurt and granola bar", place: "Any convenience store", order: "A large Greek yogurt cup (like Oikos Pro) and a granola bar.", macros: m(330, 27, 40, 6), costUsd: 5, diets: ANIMAL, roles: ["pre_workout", "regular", "bedtime"] },
  { name: "Egg white bites and oatmeal", place: "Starbucks", order: "Egg White & Roasted Red Pepper Egg Bites and a Rolled & Steel-Cut Oatmeal (no brown sugar).", macros: m(330, 17, 43, 9), costUsd: 10, diets: ANIMAL, roles: ["regular"] },
  { name: "Protein box", place: "Starbucks", order: "Eggs & Cheddar Protein Box.", macros: m(460, 22, 40, 24), costUsd: 9, diets: ANIMAL, roles: ["regular"] },
  { name: "Oatmeal cup and soy milk", place: "Any convenience store", order: "An instant oatmeal cup made with soy milk, plus a banana.", macros: m(380, 14, 72, 6), costUsd: 4, diets: ALL, roles: ["pre_workout", "regular"] },
];

function portion(qty: number, food: Food) {
  return Math.min(food.max, Math.max(food.step, Math.round(qty / food.step) * food.step));
}

function describe(food: Food, qty: number): string {
  if (food.unit === "g") return `${qty} g`;
  if (food.unit === "piece") return `${qty}`;
  return `${qty} ${food.unit}${qty === 1 ? "" : "s"}`;
}

/** Portions that bring a template close to the slot's targets. */
function fit(t: Template, target: Macros) {
  const veg = t.veg ? 150 : 0;
  const vegM = { p: F.veg.p * veg, c: F.veg.c * veg, f: F.veg.f * veg };
  let qp = target.proteinG / t.protein.p;
  let qc = 0;
  for (let i = 0; i < 3; i++) {
    qc = Math.max(0, (target.carbsG - vegM.c - t.protein.c * qp) / t.carb.c);
    qp = Math.max(0, (target.proteinG - vegM.p - t.carb.p * qc) / t.protein.p);
  }
  qp = portion(qp, t.protein);
  qc = portion(qc, t.carb);
  let qf = 0;
  if (t.fat) {
    const fatLeft = target.fatG - vegM.f - t.protein.f * qp - t.carb.f * qc;
    qf = fatLeft > t.fat.f * t.fat.step * 0.5 ? portion(fatLeft / t.fat.f, t.fat) : 0;
  }
  const items: [Food, number][] = [
    [t.protein, qp],
    [t.carb, qc],
  ];
  if (t.fat && qf > 0) items.push([t.fat, qf]);
  if (veg) items.push([F.veg, veg]);
  const p = items.reduce((a, [fd, q]) => a + fd.p * q, 0);
  const c = items.reduce((a, [fd, q]) => a + fd.c * q, 0);
  const f = items.reduce((a, [fd, q]) => a + fd.f * q, 0);
  return {
    ingredients: items.map(([fd, q]) => {
      const key = KEY.get(fd)!;
      return { item: fd.name, amount: describe(fd, q), groceryId: key, quantity: Math.round(q * BUY[key].factor * 100) / 100 };
    }),
    macros: { kcal: Math.round(p * 4 + c * 4 + f * 9), proteinG: Math.round(p), carbsG: Math.round(c), fatG: Math.round(f) },
    costUsd: Math.round(items.reduce((a, [fd, q]) => a + fd.costPerUnit * q, 0) * 100) / 100,
    grocery: items,
  };
}

export function fallbackOptions(profile: Profile, role: MealRole, target: Macros, idPrefix: string, offset = 0, label = ""): MealOption[] {
  const diet = profile.nutrition.dietStyle;
  const isBreakfast = label === "Breakfast";
  const homes = TEMPLATES.filter((t) => t.diets.includes(diet) && (isBreakfast ? t.breakfast : t.roles.includes(role) && (!t.breakfast || role !== "regular")));
  const base = homes.length >= 2 ? homes : TEMPLATES.filter((t) => t.diets.includes(diet));
  // Plant-based dishes stay in the rotation only for vegans, unless nothing else fits.
  const nonVegan = diet === "vegan" ? base : base.filter((t) => !t.diets.includes("vegan"));
  const pool = nonVegan.length >= 2 ? nonVegan : base;
  const chosenHome = [pool[offset % pool.length]!, pool[(offset + 1) % pool.length]!].filter((t, i, a) => a.indexOf(t) === i);
  const places = profile.nutrition.grabAndGo.map((p) => p.toLowerCase());
  const outs = OUT.filter((o) => o.diets.includes(diet))
    .map((o) => ({
      o,
      score:
        (places.some((p) => o.place.toLowerCase().includes(p) || p.includes(o.place.toLowerCase())) ? -400 : 0) +
        Math.abs(o.macros.kcal - target.kcal) +
        (o.roles.includes(role) ? 0 : 300) +
        // Someone who eats meat probably wants the higher-protein meat option first.
        (diet === "omnivore" && o.diets.length > 1 ? 150 : 0),
    }))
    .sort((a, b) => a.score - b.score)
    .slice(offset % 2, (offset % 2) + 2)
    .map((x) => x.o);
  const home: MealOption[] = chosenHome.map((t, i) => {
    const fitted = fit(t, target);
    return {
      id: `${idPrefix}-h${i}`,
      kind: "home",
      name: t.name,
      summary: t.summary,
      place: null,
      order: null,
      ingredients: fitted.ingredients,
      steps: t.steps,
      prepMinutes: t.prepMinutes,
      costUsd: fitted.costUsd,
      macros: fitted.macros,
    };
  });
  const out: MealOption[] = outs.map((o, i) => ({
    id: `${idPrefix}-o${i}`,
    kind: "out",
    name: o.name,
    summary: o.order.split(/[.:]/)[0]!,
    place: o.place,
    order: o.order,
    ingredients: [],
    steps: [],
    prepMinutes: 0,
    costUsd: o.costUsd,
    macros: o.macros,
  }));
  return [...home, ...out];
}

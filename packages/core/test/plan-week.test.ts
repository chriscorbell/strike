import { describe, expect, it } from "vitest";
import { computeGroceries, prepMomentFor, shoppingDateFor, targetPlanWeek, type GroceryCatalogItem, type MenuSlot, type PlanDay } from "../src/index.ts";
import { profile } from "./fixtures.ts";

// Plan weeks start Sunday (checkInDay 0), so shopping is Saturday and prep is Friday evening.
describe("plan week timing", () => {
  it("shops the day before the week and prepares the evening before that", () => {
    expect(shoppingDateFor(profile, "2026-10-11")).toBe("2026-10-10");
    expect(prepMomentFor(profile, "2026-10-11")).toEqual({ date: "2026-10-09", time: "18:00" });
  });
  it("targets next week from Friday 6 pm", () => {
    expect(targetPlanWeek(profile, "2026-10-09", 17 * 60)).toBe("2026-10-04");
    expect(targetPlanWeek(profile, "2026-10-09", 18 * 60)).toBe("2026-10-11");
    expect(targetPlanWeek(profile, "2026-10-10", 9 * 60)).toBe("2026-10-11");
    expect(targetPlanWeek(profile, "2026-10-11", 9 * 60)).toBe("2026-10-11");
  });
  it("honors a chosen shopping day", () => {
    const thursday = { ...profile, schedule: { ...profile.schedule, shoppingDay: 4 } };
    expect(shoppingDateFor(thursday, "2026-10-11")).toBe("2026-10-08");
  });
});

describe("groceries", () => {
  const catalog: GroceryCatalogItem[] = [
    { id: "chicken", name: "Chicken breast", section: "Meat", unit: "g", packageSize: 1360, packageLabel: "3 lb pack", packagePrice: 10, staple: false },
    { id: "rice", name: "White rice", section: "Pantry", unit: "g", packageSize: 2268, packageLabel: "5 lb bag", packagePrice: 6, staple: true },
  ];
  const ing = (groceryId: string, quantity: number) => ({ item: groceryId, amount: "", groceryId, quantity });
  const option = (id: string, kind: "home" | "out", ingredients: ReturnType<typeof ing>[]) => ({
    id, kind, name: id, summary: "", place: null, order: null, ingredients, steps: [], prepMinutes: 0, costUsd: 0, macros: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  });
  const slots: MenuSlot[] = [
    { dayType: "rest", slotIndex: 0, label: "Lunch", role: "regular", targets: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }, options: [option("bowl", "home", [ing("chicken", 210), ing("rice", 80), { item: "Salt", amount: "pinch", groceryId: null, quantity: null }]), option("chipotle", "out", [])] },
  ];
  const plan = (ids: string[]): PlanDay[] => ids.map((optionId, i) => ({ date: `2026-10-1${i}`, dayType: "rest", meals: [{ slotIndex: 0, optionId }] }));

  it("totals planned meals into packages", () => {
    const list = computeGroceries(catalog, slots, plan(["bowl", "bowl", "bowl", "bowl", "bowl", "bowl", "bowl"]), "imperial");
    const chicken = list.find((g) => g.item === "Chicken breast")!;
    expect(chicken.quantity).toBe("2 x 3 lb pack"); // 1470 g, past the 3% sliver allowance
    expect(chicken.costUsd).toBe(20);
    expect(chicken.needed).toBe("about 3.2 lb");
    expect(list.find((g) => g.item === "White rice")!.staple).toBe(true);
    expect(list.find((g) => g.item === "Salt")!.quantity).toBe("as needed");
  });
  it("drops what grab-and-go replaces", () => {
    const list = computeGroceries(catalog, slots, plan(["chipotle", "chipotle", "bowl"]), "imperial");
    expect(list.find((g) => g.item === "Chicken breast")!.quantity).toBe("1 x 3 lb pack");
  });
});

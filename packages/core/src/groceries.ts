// The week's shopping list: every planned home meal's ingredients, totaled per grocery item and rounded
// up to the packages a store sells.
import type { GroceryCatalogItem, GroceryItem, MealOption, MenuSlot, PlanDay, Units } from "./schemas.ts";
import { round } from "./units.ts";

/** Every planned option, once per time it is eaten. */
export function plannedOptions(slots: MenuSlot[], plan: PlanDay[]): MealOption[] {
  const byId = new Map(slots.flatMap((s) => s.options.map((o) => [o.id, o] as const)));
  return plan.flatMap((day) => day.meals.map((m) => byId.get(m.optionId)).filter((o): o is MealOption => o != null));
}

function formatNeeded(total: number, item: GroceryCatalogItem, units: Units): string {
  if (item.unit === "piece") {
    const count = Math.ceil(total - 0.05);
    return item.pieceName ? `${count} ${item.pieceName}` : `${count}`;
  }
  if (item.unit === "g") {
    if (units === "imperial") return total >= 454 ? `about ${round(total / 453.6, 1)} lb` : total >= 14 ? `about ${Math.round(total / 28.35)} oz` : "a little";
    return total >= 1000 ? `about ${round(total / 1000, 1)} kg` : total >= 5 ? `about ${Math.round(total)} g` : "a little";
  }
  if (units === "imperial") return total >= 240 ? `about ${round(total / 236.6, 1)} cups` : total >= 15 ? `about ${Math.round(total / 29.57)} fl oz` : "a little";
  return total >= 1000 ? `about ${round(total / 1000, 1)} L` : total >= 5 ? `about ${Math.round(total)} ml` : "a little";
}

export function computeGroceries(catalog: GroceryCatalogItem[], slots: MenuSlot[], plan: PlanDay[], units: Units): GroceryItem[] {
  const totals = new Map<string, number>();
  const loose = new Map<string, string>();
  for (const option of plannedOptions(slots, plan)) {
    if (option.kind !== "home") continue;
    for (const ing of option.ingredients) {
      if (ing.groceryId && ing.quantity != null && catalog.some((c) => c.id === ing.groceryId)) {
        totals.set(ing.groceryId, (totals.get(ing.groceryId) ?? 0) + ing.quantity);
      } else {
        loose.set(ing.item.toLowerCase(), ing.item);
      }
    }
  }
  const items: GroceryItem[] = [];
  for (const c of catalog) {
    const total = totals.get(c.id);
    if (!total) continue;
    // A sliver over a package boundary (rounding in recipes) doesn't buy another package.
    const packages = Math.max(1, Math.ceil(total / c.packageSize - 0.03));
    items.push({
      item: c.name,
      quantity: `${packages} x ${c.packageLabel}`,
      needed: formatNeeded(total, c, units),
      section: c.section,
      costUsd: round(packages * c.packagePrice, 2),
      staple: c.staple,
    });
  }
  for (const name of loose.values()) {
    items.push({ item: name, quantity: "as needed", needed: null, section: "Pantry", costUsd: 0, staple: true });
  }
  return items.sort((a, b) => Number(a.staple) - Number(b.staple) || a.section.localeCompare(b.section) || a.item.localeCompare(b.item));
}

import type { GroceryItem, MealMenu } from "@strike/core";
import { ShoppingCart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button.tsx";
import { Checkbox } from "../../components/ui/Field.tsx";
import { EmptyState } from "../../components/ui/States.tsx";
import { cn } from "../../lib/cn.ts";
import { fmtUsd } from "../../lib/format.ts";
import { useProfile } from "../../lib/queries.ts";

/** Checked items, saved per menu so each week's list keeps its own ticks. */
function useCheckedItems(menuId: number) {
  const storageKey = `strike.groceries.${menuId}`;
  const read = () => {
    try {
      return new Set(JSON.parse(localStorage.getItem(storageKey) ?? "[]") as string[]);
    } catch {
      return new Set<string>();
    }
  };
  const [checked, setChecked] = useState<Set<string>>(read);
  // Switching weeks swaps the menu id: load that week's ticks.
  useEffect(() => setChecked(read()), [storageKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...checked]));
    } catch {
      // Storage unavailable: ticks last for this visit only.
    }
  }, [checked, storageKey]);
  const toggle = (item: string, on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(item);
      else next.delete(item);
      return next;
    });
  return { checked, toggle, clear: () => setChecked(new Set()) };
}

/** "about 0 oz" says nothing useful; show nothing instead. */
const usefulNeeded = (needed: string | null) => (needed && !/^about 0(\.0+)?\b/.test(needed) ? needed : null);

/** This week's shopping, grouped by aisle, with pantry staples to check at the end. */
export function GroceriesView({ menu }: { menu: MealMenu }) {
  const profile = useProfile();
  const { checked, toggle, clear } = useCheckedItems(menu.id);

  const { sections, staples, total, count } = useMemo(() => {
    const map = new Map<string, GroceryItem[]>();
    const staples: GroceryItem[] = [];
    let total = 0;
    for (const g of menu.groceryList) {
      if (g.staple) {
        staples.push(g);
        continue;
      }
      total += g.costUsd;
      map.set(g.section, [...(map.get(g.section) ?? []), g]);
    }
    return { sections: [...map.entries()], staples, total, count: menu.groceryList.length - staples.length };
  }, [menu.groceryList]);

  const budget = profile.nutrition.weeklyBudgetUsd;
  const done = menu.groceryList.filter((g) => checked.has(g.item)).length;

  if (menu.groceryList.length === 0) {
    return (
      <EmptyState icon={ShoppingCart} title="Nothing to buy">
        Every planned meal this week is grab and go.
      </EmptyState>
    );
  }

  const list = (items: GroceryItem[]) => (
    <ul className="divide-y divide-line">
      {items.map((g) => {
        const on = checked.has(g.item);
        const needed = usefulNeeded(g.needed);
        return (
          <li key={g.item} className="py-3">
            <Checkbox checked={on} onChange={(v) => toggle(g.item, v)}>
              <span className="flex items-start justify-between gap-4">
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-[15px] leading-snug transition-colors",
                      on ? "text-ink-3 line-through decoration-ink-3/60" : "text-ink",
                    )}
                  >
                    {g.item}
                  </span>
                  {needed && <span className="mt-0.5 block text-[13px] text-ink-3">Plan uses {needed}</span>}
                </span>
                <span className="shrink-0 text-right">
                  <span className={cn("tnum block text-[13px]", on ? "text-ink-3" : "text-ink-2")}>{g.quantity}</span>
                  <span className="tnum mt-0.5 block text-[13px] text-ink-3">{fmtUsd(g.costUsd)}</span>
                </span>
              </span>
            </Checkbox>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-3">
            {count} {count === 1 ? "item" : "items"}, about
          </p>
          <p className="tnum mt-1 text-[28px] font-semibold leading-none tracking-tight text-ink">{fmtUsd(Math.round(total * 100) / 100)}</p>
          {budget > 0 && (
            <p className="tnum mt-2 text-[13px] text-ink-3">
              {total <= budget ? `${fmtUsd(Math.round((budget - total) * 100) / 100)} under` : `${fmtUsd(Math.round((total - budget) * 100) / 100)} over`} your{" "}
              {fmtUsd(budget)} budget
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="tnum text-sm text-ink-3">
            {done} of {menu.groceryList.length} checked
          </span>
          {done > 0 && (
            <Button size="sm" variant="ghost" onClick={clear}>
              Uncheck all
            </Button>
          )}
        </div>
      </div>

      <div className="mt-8 md:columns-2 md:gap-10">
        {sections.map(([section, items]) => (
          <section key={section} className="mb-7 break-inside-avoid" aria-label={section}>
            <h2 className="mb-0.5 text-[15px] font-semibold text-ink">{section}</h2>
            {list(items)}
          </section>
        ))}
      </div>

      {staples.length > 0 && (
        <section className="mt-3 border-t border-line pt-7" aria-label="Check you have these">
          <h2 className="text-[15px] font-semibold text-ink">Check you have these</h2>
          <p className="mt-0.5 text-[13px] text-ink-3">Pantry staples, not in the total. Buy only if you're out.</p>
          <div className="mt-2 md:columns-2 md:gap-10">{list(staples)}</div>
        </section>
      )}
    </div>
  );
}

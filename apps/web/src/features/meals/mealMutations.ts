// Meal logging with optimistic updates on the Today cache, so the macro ring moves immediately.
import type { MealLog, MealLogRequest, TodayResponse } from "@strike/core";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { endpoints } from "../../lib/endpoints.ts";
import { keys } from "../../lib/queries.ts";

function recomputeConsumed(today: TodayResponse): TodayResponse {
  const logs: MealLog[] = [
    ...today.timeline.flatMap((t) => (t.kind === "meal" && t.log ? [t.log] : [])),
    ...today.extraMeals,
  ];
  const consumed = logs
    .filter((l) => l.status === "eaten")
    .reduce(
      (acc, l) => ({
        kcal: acc.kcal + l.macros.kcal,
        proteinG: acc.proteinG + l.macros.proteinG,
        carbsG: acc.carbsG + l.macros.carbsG,
        fatG: acc.fatG + l.macros.fatG,
      }),
      { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    );
  return { ...today, consumed };
}

function optimisticLog(today: TodayResponse, req: MealLogRequest): MealLog | null {
  const zero = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  if (req.status === "skipped") {
    return { id: -1, date: req.date, slotIndex: req.slotIndex, optionId: null, name: "Skipped", macros: zero, status: "skipped", loggedAt: new Date().toISOString() };
  }
  if (req.custom) {
    return { id: -1, date: req.date, slotIndex: req.slotIndex, optionId: null, name: req.custom.name, macros: req.custom.macros, status: "eaten", loggedAt: new Date().toISOString() };
  }
  const slot = today.timeline.find((t) => t.kind === "meal" && t.slotIndex === req.slotIndex);
  const option = slot?.kind === "meal" ? slot.options.find((o) => o.id === req.optionId) : undefined;
  if (!option) return null;
  return { id: -1, date: req.date, slotIndex: req.slotIndex, optionId: option.id, name: option.name, macros: option.macros, status: "eaten", loggedAt: new Date().toISOString() };
}

function patchToday(qc: QueryClient, date: string, fn: (t: TodayResponse) => TodayResponse) {
  qc.setQueryData<TodayResponse>(keys.today(date), (old) => (old ? recomputeConsumed(fn(old)) : old));
}

function withLog(today: TodayResponse, log: MealLog): TodayResponse {
  if (log.slotIndex == null) {
    return { ...today, extraMeals: [...today.extraMeals.filter((m) => m.id !== log.id && m.id !== -1), log] };
  }
  return {
    ...today,
    timeline: today.timeline.map((t) => (t.kind === "meal" && t.slotIndex === log.slotIndex ? { ...t, log } : t)),
  };
}

function withoutLog(today: TodayResponse, id: number): TodayResponse {
  return {
    ...today,
    extraMeals: today.extraMeals.filter((m) => m.id !== id),
    timeline: today.timeline.map((t) => (t.kind === "meal" && t.log?.id === id ? { ...t, log: null } : t)),
  };
}

export function useLogMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: endpoints.logMeal,
    onMutate: async (req) => {
      await qc.cancelQueries({ queryKey: keys.today(req.date) });
      const previous = qc.getQueryData<TodayResponse>(keys.today(req.date));
      if (previous) {
        const log = optimisticLog(previous, req);
        if (log) patchToday(qc, req.date, (t) => withLog(t, log));
      }
      return { previous };
    },
    onError: (_e, req, ctx) => {
      if (ctx?.previous) qc.setQueryData(keys.today(req.date), ctx.previous);
    },
    onSuccess: (log) => patchToday(qc, log.date, (t) => withLog(t, log)),
    onSettled: (_d, _e, req) => {
      void qc.invalidateQueries({ queryKey: keys.today(req.date) });
      void qc.invalidateQueries({ queryKey: keys.mealHistory() });
    },
  });
}

export function useDeleteMealLog(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => endpoints.deleteMealLog(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: keys.today(date) });
      const previous = qc.getQueryData<TodayResponse>(keys.today(date));
      patchToday(qc, date, (t) => withoutLog(t, id));
      return { previous };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(keys.today(date), ctx.previous);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.today(date) });
      void qc.invalidateQueries({ queryKey: keys.mealHistory() });
    },
  });
}

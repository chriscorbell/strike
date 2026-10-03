import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { endpoints } from "../../lib/endpoints.ts";
import { keys } from "../../lib/queries.ts";

export const RANGES = [
  { value: 30, label: "1M" },
  { value: 90, label: "3M" },
  { value: 180, label: "6M" },
  { value: 365, label: "1Y" },
] as const;

export type RangeDays = (typeof RANGES)[number]["value"];

export const parseRange = (raw: string | null): RangeDays => {
  const n = Number(raw);
  return RANGES.some((r) => r.value === n) ? (n as RangeDays) : 90;
};

/** Weights for a range. Keeps the previous range on screen while the next one loads. */
export const useWeightRange = (days: RangeDays) =>
  useQuery({
    queryKey: keys.weights(days),
    queryFn: () => endpoints.weights(days),
    placeholderData: keepPreviousData,
  });

/** Everything a weigh-in change touches. */
export function useInvalidateWeights() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: keys.weights() });
    void qc.invalidateQueries({ queryKey: keys.today() });
  };
}

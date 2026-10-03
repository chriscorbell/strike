import type { Profile, Units, WeightsResponse } from "@strike/core";
import { Scale } from "lucide-react";
import type { ReactNode } from "react";
import { Panel } from "../../components/Page.tsx";
import { Segmented } from "../../components/ui/Segmented.tsx";
import { EmptyState, ErrorState, Skeleton } from "../../components/ui/States.tsx";
import { cn } from "../../lib/cn.ts";
import { bodyUnit, fmtDateShort, fmtRate } from "../../lib/format.ts";
import { fixed, kgToDisplay, rateVerdict, signed } from "./util.ts";
import { WeightChart } from "./WeightChart.tsx";
import { RANGES, type RangeDays } from "./weightData.ts";

interface StatProps {
  label: string;
  value: string | null;
  unit?: string;
  /** Shown instead of the number when there is no value yet. */
  empty?: string;
  children?: ReactNode;
}

function Stat({ label, value, unit, empty, children }: StatProps) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] font-medium text-ink-3">{label}</p>
      {value != null ? (
        <p className="mt-1.5 flex items-baseline gap-1 whitespace-nowrap">
          <span className="text-[28px] font-semibold leading-none tracking-tight text-ink">{value}</span>
          {unit && <span className="text-sm font-medium text-ink-3">{unit}</span>}
        </p>
      ) : (
        <p className="mt-2 text-[15px] text-ink-2">{empty}</p>
      )}
      {children && <div className="mt-2 flex flex-col gap-0.5 text-[13px] leading-snug">{children}</div>}
    </div>
  );
}

function goalText(goal: Profile["goal"], latestKg: number | null, rateKg: number | null, units: Units) {
  if (goal.targetWeightKg == null || latestKg == null) return null;
  const unit = bodyUnit(units);
  const diff = latestKg - goal.targetWeightKg;
  const away = Math.abs(kgToDisplay(diff, units));
  const reached = goal.type === "lose" ? diff <= 0 : goal.type === "gain" ? diff >= 0 : away < 1;
  if (reached) return { remaining: goal.type === "maintain" ? "At your goal" : "Goal reached", eta: null };
  const remaining = goal.type === "maintain" ? `${fixed(away, 1)} ${unit} from goal` : `${fixed(away, 1)} ${unit} to go`;
  let eta: string | null = null;
  if (rateKg != null && Math.abs(rateKg) >= 0.05 && Math.sign(rateKg) === Math.sign(-diff)) {
    const weeks = Math.round(Math.abs(diff) / Math.abs(rateKg));
    if (weeks >= 1 && weeks <= 156) eta = `About ${weeks} ${weeks === 1 ? "week" : "weeks"} at this pace`;
  }
  return { remaining, eta };
}

interface WeightStatsProps {
  data: WeightsResponse | undefined;
  loading: boolean;
  units: Units;
  goal: Profile["goal"];
  layout: "row" | "column";
  className?: string;
}

/** Current trend, weekly rate against target, and the goal. */
export function WeightStats({ data, loading, units, goal, layout, className }: WeightStatsProps) {
  const unit = bodyUnit(units);
  if (loading && !data) {
    return (
      <div className={cn(layout === "row" ? "grid grid-cols-2 gap-5" : "flex flex-col gap-7", className)} aria-hidden>
        {[0, 1].map((i) => (
          <div key={i}>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="mt-2.5 h-7 w-28" />
            <Skeleton className="mt-2.5 h-4 w-32" />
          </div>
        ))}
      </div>
    );
  }
  if (!data) return null;

  const latest = data.latestTrendKg;
  const first = data.points[0];
  const rate = data.rateKgPerWeek;
  const verdict = rateVerdict(rate, data.targetRateKgPerWeek, goal.type);
  const goalInfo = goalText(goal, latest, rate, units);

  let since: string | null = null;
  if (latest != null && first && data.points.length > 1) {
    const change = kgToDisplay(latest, units) - kgToDisplay(first.trendKg, units);
    since =
      Math.abs(change) < 0.05
        ? `Unchanged since ${fmtDateShort(first.date)}`
        : `${signed(change, 1)} ${unit} since ${fmtDateShort(first.date)}`;
  }

  const trend = (
    <Stat label="Trend" value={latest == null ? null : fixed(kgToDisplay(latest, units), 1)} unit={unit} empty="No weigh-ins yet">
      {since && <span className="text-ink-2">{since}</span>}
    </Stat>
  );

  const rateStat = (
    <Stat
      label="Weekly rate"
      value={rate == null ? null : signed(kgToDisplay(rate, units), 2)}
      unit={`${unit}/wk`}
      empty="Needs a week of weigh-ins"
    >
      {verdict && <span className="text-ink-2">{verdict}</span>}
      <span className="text-ink-3">
        {goal.type === "maintain" ? "Target: hold steady" : `Target ${fmtRate(data.targetRateKgPerWeek, units)}`}
      </span>
    </Stat>
  );

  if (layout === "column") {
    return (
      <div className={cn("flex flex-col gap-7", className)}>
        {trend}
        {rateStat}
        {goal.targetWeightKg != null && (
          <Stat label="Goal" value={fixed(kgToDisplay(goal.targetWeightKg, units), 1)} unit={unit}>
            {goalInfo && <span className="text-ink-2">{goalInfo.remaining}</span>}
            {goalInfo?.eta && <span className="text-ink-3">{goalInfo.eta}</span>}
          </Stat>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-x-5 gap-y-6">
        {trend}
        {rateStat}
      </div>
      {goal.targetWeightKg != null && goalInfo && (
        <p className="mt-5 text-[13px] leading-snug text-ink-3">
          <span className="text-ink-2">
            Goal {fixed(kgToDisplay(goal.targetWeightKg, units), 1)} {unit}, {goalInfo.remaining.toLowerCase()}.
          </span>
          {goalInfo.eta && ` ${goalInfo.eta}.`}
        </p>
      )}
    </div>
  );
}

export function RangeControl({ value, onChange, block }: { value: RangeDays; onChange: (v: RangeDays) => void; block?: boolean }) {
  return <Segmented size="sm" options={RANGES} value={value} onChange={onChange} label="Chart range" block={block} />;
}

interface WeightChartPanelProps {
  query: { data: WeightsResponse | undefined; isPending: boolean; isError: boolean; error: unknown; isPlaceholderData: boolean; refetch: () => unknown };
  units: Units;
  goal: Profile["goal"];
  toolbar?: ReactNode;
  footer?: ReactNode;
  className?: string;
  height?: number;
}

export function WeightChartPanel({ query, units, goal, toolbar, footer, className, height = 240 }: WeightChartPanelProps) {
  const unit = bodyUnit(units);
  const data = query.data;
  const weighIns = data?.points.filter((p) => p.weightKg != null).length ?? 0;

  let body: ReactNode;
  if (query.isPending) {
    body = (
      <div aria-hidden>
        <Skeleton className="mb-3 h-5 w-40" />
        <div style={{ height }}>
          <Skeleton className="size-full" />
        </div>
      </div>
    );
  } else if (query.isError && !data) {
    body = <ErrorState error={query.error} onRetry={() => void query.refetch()} className="py-6" />;
  } else if (!data || weighIns === 0) {
    body = (
      <EmptyState icon={Scale} title="No weigh-ins yet" className="py-6">
        Weigh in each morning. The trend line smooths out daily swings.
      </EmptyState>
    );
  } else {
    const first = data.points[0]!;
    const last = data.points[data.points.length - 1]!;
    const summary = `Weight trend since ${fmtDateShort(first.date)}: ${fixed(kgToDisplay(first.trendKg, units), 1)} to ${fixed(
      kgToDisplay(last.trendKg, units),
      1,
    )} ${unit}, from ${weighIns} weigh-ins.`;
    body = (
      <WeightChart
        key={`${first.date}-${data.points.length}`}
        points={data.points}
        units={units}
        goalKg={goal.targetWeightKg}
        summary={summary}
        height={height}
        toolbar={toolbar}
        footer={footer}
        className={cn("transition-opacity duration-200", query.isPlaceholderData && "opacity-50")}
      />
    );
  }

  return <Panel className={cn("p-4 sm:p-5", className)}>{body}</Panel>;
}

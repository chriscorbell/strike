import type { Macros } from "@strike/core";
import { MacroBar, MACRO_META } from "../../components/Macros.tsx";
import { Panel } from "../../components/Page.tsx";
import { ProgressRing } from "../../components/ui/ProgressRing.tsx";
import { fmtKcal } from "../../lib/format.ts";

/** Calories as the ring (the day's headline), macros as meters beside it. */
export function MacroSummary({ consumed, targets }: { consumed: Macros; targets: Macros }) {
  const left = Math.round(targets.kcal - consumed.kcal);
  const over = left < 0;
  return (
    <Panel className="flex items-center gap-5 p-5">
      <ProgressRing
        value={targets.kcal > 0 ? consumed.kcal / targets.kcal : 0}
        size={116}
        stroke={9}
        color={over ? "var(--color-warn)" : "var(--color-accent)"}
        label={`${fmtKcal(consumed.kcal)} of ${fmtKcal(targets.kcal)} calories`}
      >
        <span className="tnum text-[22px] font-semibold leading-none tracking-tight text-ink">{fmtKcal(Math.abs(left))}</span>
        <span className="mt-1 text-xs text-ink-3">{over ? "kcal over" : "kcal left"}</span>
      </ProgressRing>
      <div className="flex min-w-0 flex-1 flex-col gap-3.5">
        <p className="tnum text-[13px] text-ink-3">
          <span className="font-semibold text-ink">{fmtKcal(consumed.kcal)}</span> / {fmtKcal(targets.kcal)} kcal
        </p>
        {MACRO_META.map((m) => (
          <MacroBar key={m.key} label={m.label} color={m.color} consumed={consumed[m.key]} target={targets[m.key]} />
        ))}
      </div>
    </Panel>
  );
}

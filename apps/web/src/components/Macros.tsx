import type { Macros } from "@strike/core";
import { motion } from "motion/react";
import { cn } from "../lib/cn.ts";
import { fmtInt, fmtKcal } from "../lib/format.ts";

export const MACRO_META = [
  { key: "proteinG", label: "Protein", short: "P", color: "var(--color-protein)" },
  { key: "carbsG", label: "Carbs", short: "C", color: "var(--color-carbs)" },
  { key: "fatG", label: "Fat", short: "F", color: "var(--color-fat)" },
] as const;

interface MacroBarProps {
  label: string;
  color: string;
  consumed: number;
  target: number;
  unit?: string;
  compact?: boolean;
}

/** Horizontal meter: the fill carries the macro hue, the track is a faint step of the same hue. */
export function MacroBar({ label, color, consumed, target, unit = "g", compact = false }: MacroBarProps) {
  const ratio = target > 0 ? consumed / target : 0;
  const left = Math.round(target - consumed);
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className={cn("font-medium text-ink-2", compact ? "text-xs" : "text-[13px]")}>{label}</span>
        <span className={cn("tnum text-ink", compact ? "text-xs" : "text-[13px]")}>
          <span className="font-semibold">{fmtInt(consumed)}</span>
          <span className="text-ink-3">
            {" "}
            / {fmtInt(target)}
            {unit}
          </span>
        </span>
      </div>
      <div
        className="relative h-1.5 overflow-hidden rounded-full"
        style={{ background: `color-mix(in oklab, ${color} 18%, transparent)` }}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.round(target)}
        aria-valuenow={Math.round(consumed)}
        aria-valuetext={`${fmtInt(consumed)} of ${fmtInt(target)} ${unit}, ${left >= 0 ? `${left} left` : `${-left} over`}`}
      >
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(1, ratio) * 100}%` }}
          transition={{ type: "spring", stiffness: 80, damping: 20 }}
        />
      </div>
    </div>
  );
}

/** Three macro meters in a row (or stacked on narrow containers). */
export function MacroBars({ consumed, targets, compact = false, className }: { consumed: Macros; targets: Macros; compact?: boolean; className?: string }) {
  return (
    <div className={cn("grid grid-cols-3 gap-4", className)}>
      {MACRO_META.map((m) => (
        <MacroBar key={m.key} label={m.label} color={m.color} consumed={consumed[m.key]} target={targets[m.key]} compact={compact} />
      ))}
    </div>
  );
}

/** "520 kcal  42P 60C 14F" in one quiet line. */
export function MacroLine({ macros, className, kcalFirst = true }: { macros: Macros; className?: string; kcalFirst?: boolean }) {
  return (
    <span className={cn("tnum inline-flex flex-wrap items-baseline gap-x-2 text-[13px] text-ink-3", className)}>
      {kcalFirst && (
        <span>
          <span className="font-medium text-ink-2">{fmtKcal(macros.kcal)}</span> kcal
        </span>
      )}
      <span aria-label={`${fmtInt(macros.proteinG)} grams protein, ${fmtInt(macros.carbsG)} carbs, ${fmtInt(macros.fatG)} fat`}>
        {fmtInt(macros.proteinG)}P {fmtInt(macros.carbsG)}C {fmtInt(macros.fatG)}F
      </span>
    </span>
  );
}

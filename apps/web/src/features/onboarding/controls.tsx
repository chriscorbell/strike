// Form pieces the wizard needs that the shared ui kit does not have.
import { Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Chip } from "../../components/ui/Chip.tsx";
import { cn } from "../../lib/cn.ts";
import { parseNum } from "../../lib/format.ts";
import { WEEKDAY_LONG, WEEKDAY_SHORT } from "../../lib/labels.ts";
import { collapseVariants, spring } from "../../lib/motion.ts";
import { WEEK_ORDER } from "./shared.ts";

/** Height-animated show/hide. Side padding keeps focus rings from being clipped. */
export function Collapse({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="collapse"
          variants={collapseVariants}
          initial="collapsed"
          animate="open"
          exit="collapsed"
          className="-mx-1.5 overflow-hidden px-1.5"
        >
          <div className={className}>{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export interface QuestionA11y {
  labelId: string;
  describedBy: string | undefined;
  invalid: boolean;
}

interface QuestionProps {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  className?: string;
  /** Right side of the label row. */
  aside?: ReactNode;
  children: (a11y: QuestionA11y) => ReactNode;
}

/** A labeled group of controls (radio rows, chips, weekday pickers). Label above, hint or error below. */
export function Question({ label, hint, error, optional, className, aside, children }: QuestionProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && !error ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)} data-invalid={error ? "true" : undefined}>
      <div className="flex items-baseline justify-between gap-3">
        <div id={labelId} className="text-sm font-medium text-ink-2">
          {label}
          {optional && <span className="ml-1.5 font-normal text-ink-3">optional</span>}
        </div>
        {aside}
      </div>
      {children({ labelId, describedBy, invalid: !!error })}
      {hint && !error && (
        <div id={hintId} className="text-[13px] leading-snug text-ink-3">
          {hint}
        </div>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-[13px] leading-snug text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Roving focus for a radiogroup of buttons. */
function useRoving<T>(items: readonly T[], onPick: (item: T) => void) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (i + dir + items.length) % items.length;
    onPick(items[next]!);
    refs.current[next]?.focus();
  };
  const ref = (i: number) => (el: HTMLButtonElement | null) => {
    refs.current[i] = el;
  };
  return { onKeyDown, ref };
}

interface OptionListProps<T extends string> extends Partial<QuestionA11y> {
  options: readonly { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** Single choice as full-width rows with a short description each. */
export function OptionList<T extends string>({ options, value, onChange, labelId, describedBy }: OptionListProps<T>) {
  const { onKeyDown, ref } = useRoving(options, (o) => onChange(o.value));
  return (
    <div role="radiogroup" aria-labelledby={labelId} aria-describedby={describedBy} className="flex flex-col gap-2">
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={ref(i)}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left",
              "transition-[background-color,border-color,transform] duration-150 active:scale-[0.99]",
              selected ? "border-accent/45 bg-accent-soft" : "border-line-strong hover:border-ink-3/40 hover:bg-surface",
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium text-ink">{o.label}</span>
              {o.hint && <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">{o.hint}</span>}
            </span>
            <span
              aria-hidden
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
                selected ? "border-accent bg-accent" : "border-line-strong",
              )}
            >
              <AnimatePresence initial={false}>
                {selected && (
                  <motion.span
                    initial={{ scale: 0.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.3, opacity: 0 }}
                    transition={spring}
                    className="text-accent-ink"
                  >
                    <Check size={12} strokeWidth={3.2} />
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
          </button>
        );
      })}
    </div>
  );
}

const dayClass = (selected: boolean) =>
  cn(
    "flex h-11 min-w-0 select-none items-center justify-center rounded-full border text-[13px] font-medium",
    "transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.96] disabled:opacity-35 disabled:active:scale-100",
    selected
      ? "border-accent/40 bg-accent-soft text-accent"
      : "border-line-strong text-ink-2 hover:border-ink-3/50 hover:text-ink",
  );

interface WeekdayMultiProps extends Partial<QuestionA11y> {
  value: number[];
  onChange: (days: number[]) => void;
  max?: number;
}

/** Pick several weekdays. Unpicked days lock once `max` are chosen. */
export function WeekdayMulti({ value, onChange, max = 7, labelId, describedBy }: WeekdayMultiProps) {
  const full = value.length >= max;
  return (
    <div role="group" aria-labelledby={labelId} aria-describedby={describedBy} className="grid grid-cols-7 gap-1.5">
      {WEEK_ORDER.map((d) => {
        const on = value.includes(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            aria-label={WEEKDAY_LONG[d]}
            disabled={!on && full}
            onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d].sort((a, b) => a - b))}
            className={dayClass(on)}
          >
            {WEEKDAY_SHORT[d]}
          </button>
        );
      })}
    </div>
  );
}

interface WeekdaySingleProps extends Partial<QuestionA11y> {
  value: number;
  onChange: (day: number) => void;
  /** Days to offer, in display order. Defaults to the whole week, Monday first. */
  days?: readonly number[];
}

/** Pick one weekday (radiogroup). */
export function WeekdaySingle({ value, onChange, labelId, describedBy, days = WEEK_ORDER }: WeekdaySingleProps) {
  const { onKeyDown, ref } = useRoving(days, onChange);
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
    >
      {days.map((d, i) => {
        const on = value === d;
        return (
          <button
            key={d}
            ref={ref(i)}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={WEEKDAY_LONG[d]}
            tabIndex={on || (!days.includes(value) && i === days.length - 1) ? 0 : -1}
            onClick={() => onChange(d)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={dayClass(on)}
          >
            {WEEKDAY_SHORT[d]}
          </button>
        );
      })}
    </div>
  );
}

interface ToggleChipsProps<T extends string> extends Partial<QuestionA11y> {
  options: readonly { value: T; label: string }[];
  value: readonly T[];
  onChange: (value: T[]) => void;
  max?: number;
  size?: "sm" | "md";
}

/** Multi-select chips. Order of `value` is kept; new picks go to the end. */
export function ToggleChips<T extends string>({
  options,
  value,
  onChange,
  max,
  size,
  labelId,
  describedBy,
}: ToggleChipsProps<T>) {
  const full = max != null && value.length >= max;
  return (
    <div role="group" aria-labelledby={labelId} aria-describedby={describedBy} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <Chip
            key={o.value}
            size={size}
            selected={on}
            disabled={!on && full}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
          >
            {o.label}
          </Chip>
        );
      })}
    </div>
  );
}

interface LoadInputProps {
  value: number;
  onChange: (value: number) => void;
  unit: string;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
  min?: number;
}

/**
 * Compact number field for values that must stay a positive number. Typing reports each valid number;
 * leaving the field empty or invalid puts the last good value back.
 */
export function LoadInput({ value, onChange, unit, min = 0.01, ...rest }: LoadInputProps) {
  const [text, setText] = useState(fmtLoadText(value));
  useEffect(() => {
    if (parseNum(text) !== value) setText(fmtLoadText(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseNum(e.target.value);
          if (n != null && n >= min) onChange(n);
        }}
        onBlur={() => {
          const n = parseNum(text);
          if (n == null || n < min) setText(fmtLoadText(value));
        }}
        className="tnum h-11 w-full rounded-xl border border-line-strong bg-raised pl-3.5 pr-10 text-[15px] text-ink transition-colors duration-150 placeholder:text-ink-3 focus:border-accent/60 focus:outline-none aria-[invalid=true]:border-danger/70"
        {...rest}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-ink-3">{unit}</span>
    </div>
  );
}

const fmtLoadText = (n: number) => String(Number(n.toFixed(2)));

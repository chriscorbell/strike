import { Check, Minus, Plus } from "lucide-react";
import { motion } from "motion/react";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "../../lib/cn.ts";
import { parseNum } from "../../lib/format.ts";
import { spring } from "../../lib/motion.ts";

const inputBase =
  "w-full rounded-xl border border-line-strong bg-raised text-[15px] text-ink placeholder:text-ink-3 transition-colors duration-150 focus:border-accent/60 focus:outline-none aria-[invalid=true]:border-danger/70 disabled:opacity-50";

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  children: ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean }>;
  className?: string;
  /** Visually hide the label (it stays for screen readers). */
  hideLabel?: boolean;
}

/** Label above, hint and error below. Wires ids into its single child control. */
export function Field({ label, hint, error, optional, children, className, hideLabel }: FieldProps) {
  const generated = useId();
  const own = isValidElement(children) ? children.props : {};
  const id = own.id ?? generated;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [own["aria-describedby"], hint && !error ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, { id, "aria-describedby": describedBy, "aria-invalid": error ? true : own["aria-invalid"] })
    : children;
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <label htmlFor={id} className={cn("text-sm font-medium text-ink-2", hideLabel && "sr-only")}>
        {label}
        {optional && <span className="ml-1.5 font-normal text-ink-3">optional</span>}
      </label>
      {control}
      {hint && !error && (
        <p id={hintId} className="text-[13px] leading-snug text-ink-3">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-[13px] leading-snug text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputBase, "h-11 px-3.5", className)} {...rest} />;
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputBase, "min-h-24 resize-y px-3.5 py-2.5 leading-relaxed", className)} {...rest} />;
}

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: number | null;
  onChange: (value: number | null) => void;
  unit?: string;
  decimals?: number;
}

/**
 * Number field that keeps the user's raw text while typing and reports a parsed number (or null).
 * Shows a unit suffix inside the field.
 */
export function NumberInput({ value, onChange, unit, decimals = 1, className, ...rest }: NumberInputProps) {
  const [text, setText] = useState(value == null ? "" : String(value));
  // Sync when the value changes from outside (unit switch, reset).
  useEffect(() => {
    const parsed = parseNum(text);
    if (parsed !== value) setText(value == null ? "" : String(Number(value.toFixed(decimals))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className={cn("relative", className)}>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseNum(e.target.value));
        }}
        className={cn(inputBase, "tnum h-11 px-3.5", unit && "pr-12")}
        {...rest}
      />
      {unit && (
        <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-ink-3">{unit}</span>
      )}
    </div>
  );
}

interface StepperProps {
  value: number | null;
  onChange: (value: number) => void;
  /** Return the next value in a direction; defaults to +/- step. */
  stepFn?: (current: number, dir: 1 | -1) => number;
  step?: number;
  min?: number;
  max?: number;
  label: string;
  unit?: string;
  decimals?: number;
  size?: "md" | "lg";
  className?: string;
  inputMode?: "decimal" | "numeric";
  id?: string;
}

/** [-] value [+] with an editable middle. */
export function Stepper({
  value,
  onChange,
  stepFn,
  step = 1,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  label,
  unit,
  decimals = 2,
  size = "md",
  className,
  inputMode = "decimal",
  id,
}: StepperProps) {
  const [text, setText] = useState(value == null ? "" : fmt(value, decimals));
  useEffect(() => {
    if (parseNum(text) !== value) setText(value == null ? "" : fmt(value, decimals));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const bump = (dir: 1 | -1) => {
    const cur = value ?? 0;
    const next = clamp(stepFn ? stepFn(cur, dir) : Math.round((cur + dir * step) * 1000) / 1000);
    onChange(next);
    setText(fmt(next, decimals));
  };
  const h = size === "lg" ? "h-12" : "h-11";
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex items-stretch overflow-hidden rounded-xl border border-line-strong bg-raised", h, className)}
    >
      <button
        type="button"
        onClick={() => bump(-1)}
        disabled={value != null && value <= min}
        aria-label={`Decrease ${label}`}
        className="flex w-11 shrink-0 items-center justify-center text-ink-2 transition-colors hover:bg-hover hover:text-ink active:bg-hover disabled:opacity-30"
      >
        <Minus size={17} aria-hidden />
      </button>
      <div className="relative flex min-w-0 flex-1 items-center justify-center">
        <input
          id={id}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          aria-label={label}
          value={text}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            setText(e.target.value);
            const n = parseNum(e.target.value);
            if (n != null) onChange(n);
          }}
          onBlur={() => {
            const n = parseNum(text);
            if (n == null) setText(value == null ? "" : fmt(value, decimals));
            else {
              const c = clamp(n);
              if (c !== n) onChange(c);
              setText(fmt(c, decimals));
            }
          }}
          className={cn(
            "tnum h-full w-full min-w-0 bg-transparent text-center font-semibold text-ink focus:outline-none",
            size === "lg" ? "text-lg" : "text-base",
            unit && "pr-6",
          )}
        />
        {unit && (
          <span className="pointer-events-none absolute right-1.5 text-xs font-medium text-ink-3">{unit}</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => bump(1)}
        disabled={value != null && value >= max}
        aria-label={`Increase ${label}`}
        className="flex w-11 shrink-0 items-center justify-center text-ink-2 transition-colors hover:bg-hover hover:text-ink active:bg-hover disabled:opacity-30"
      >
        <Plus size={17} aria-hidden />
      </button>
    </div>
  );
}

const fmt = (n: number, decimals: number) => String(Number(n.toFixed(decimals)));

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

/** Labeled switch row. */
export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-[15px] font-medium text-ink">
          {label}
        </label>
        {description && <p className="mt-0.5 text-[13px] text-ink-3">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 disabled:opacity-40",
          checked ? "bg-accent" : "bg-hover",
        )}
      >
        <motion.span
          layout
          transition={spring}
          className={cn("block size-6 rounded-full shadow-sm", checked ? "ml-auto bg-accent-ink" : "bg-ink-2")}
        />
      </button>
    </div>
  );
}

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  className?: string;
}

/** Row-sized checkbox with a custom box. */
export function Checkbox({ checked, onChange, children, className }: CheckboxProps) {
  return (
    <label className={cn("group flex cursor-pointer items-start gap-3", className)}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-150 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
          checked ? "border-accent bg-accent text-accent-ink" : "border-line-strong group-hover:border-ink-3",
        )}
      >
        {checked && (
          <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring}>
            <Check size={13} strokeWidth={3} />
          </motion.span>
        )}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}

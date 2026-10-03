import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { useId, useRef, type KeyboardEvent } from "react";
import { cn } from "../../lib/cn.ts";
import { spring } from "../../lib/motion.ts";

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

interface SegmentedProps<T extends string | number> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
  block?: boolean;
  className?: string;
  disabled?: boolean;
}

/** Single-choice segmented control (radiogroup) with a sliding indicator. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  size = "md",
  block = false,
  className,
  disabled,
}: SegmentedProps<T>) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (index + dir + options.length) % options.length;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cn(
        "relative inline-flex rounded-full bg-raised p-1",
        block && "flex w-full",
        disabled && "opacity-50",
        className,
      )}
    >
      {options.map((opt, i) => {
        const selected = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={String(opt.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "relative z-0 inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-medium transition-colors duration-150",
              size === "sm" ? "h-7 px-3 text-[13px]" : "h-9 px-4 text-sm",
              block && "flex-1",
              selected ? "text-ink" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {selected && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={spring}
                className="absolute inset-0 -z-10 rounded-full bg-hover shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
                aria-hidden
              />
            )}
            {Icon && <Icon size={size === "sm" ? 14 : 16} aria-hidden />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

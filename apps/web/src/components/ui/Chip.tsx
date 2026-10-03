import { Check, Plus, X, type LucideIcon } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../../lib/cn.ts";
import { Button } from "./Button.tsx";

interface ChipProps {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  icon?: LucideIcon;
  size?: "sm" | "md";
  disabled?: boolean;
  role?: "radio" | "checkbox";
  className?: string;
  title?: string;
}

/** Toggle chip. Selected chips fill with the accent tint and show a check. */
export function Chip({ selected = false, onClick, children, icon: Icon, size = "md", disabled, role = "checkbox", className, title }: ChipProps) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex select-none items-center gap-1.5 whitespace-nowrap rounded-full border font-medium",
        "transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] disabled:opacity-40",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm",
        selected
          ? "border-accent/40 bg-accent-soft text-accent"
          : "border-line-strong bg-transparent text-ink-2 hover:border-ink-3/50 hover:text-ink",
        className,
      )}
    >
      {selected ? <Check size={14} strokeWidth={2.5} aria-hidden /> : Icon ? <Icon size={14} aria-hidden /> : null}
      {children}
    </button>
  );
}

interface ChoiceChipsProps<T extends string | number> {
  options: readonly { value: T; label: string; hint?: string }[];
  value: T | null;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
}

/** Single choice rendered as chips (radiogroup). */
export function ChoiceChips<T extends string | number>({ options, value, onChange, label, size, className }: ChoiceChipsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (i + dir + options.length) % options.length;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={String(o.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (value === null && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            title={o.hint}
            className={cn(
              "inline-flex select-none items-center gap-1.5 whitespace-nowrap rounded-full border font-medium",
              "transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97]",
              size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm",
              selected
                ? "border-accent/40 bg-accent-soft text-accent"
                : "border-line-strong text-ink-2 hover:border-ink-3/50 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

interface TagInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  label: string;
  placeholder?: string;
  suggestions?: readonly string[];
}

/** Free-entry chips: type and press Enter to add; suggestions add with a tap. */
export function TagInput({ values, onChange, label, placeholder, suggestions = [] }: TagInputProps) {
  const [draft, setDraft] = useState("");
  const id = useId();
  const lower = new Set(values.map((v) => v.toLowerCase()));

  const add = (raw: string) => {
    const v = raw.trim();
    if (!v || lower.has(v.toLowerCase())) return;
    onChange([...values, v]);
  };

  const remaining = suggestions.filter((s) => !lower.has(s.toLowerCase()));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
              setDraft("");
            } else if (e.key === "Backspace" && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          placeholder={placeholder}
          className="h-11 min-w-0 flex-1 rounded-xl border border-line-strong bg-raised px-3.5 text-[15px] text-ink placeholder:text-ink-3 focus:border-accent/60 focus:outline-none"
        />
        <Button
          onClick={() => {
            add(draft);
            setDraft("");
          }}
          disabled={!draft.trim()}
          aria-label={`Add to ${label}`}
        >
          Add
        </Button>
      </div>
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={label}>
          {values.map((v) => (
            <li key={v}>
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                aria-label={`Remove ${v}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent-soft pl-3.5 pr-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
              >
                {v}
                <X size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {remaining.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {remaining.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-line-strong px-3 text-[13px] text-ink-3 transition-colors hover:border-ink-3 hover:text-ink-2"
            >
              <Plus size={13} aria-hidden />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


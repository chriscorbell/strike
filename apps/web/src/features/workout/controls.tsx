// Small controls sized for mid-workout use (44px+ targets), local to the workout screen.
import { ChevronLeft, Ellipsis, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { IconButton } from "../../components/ui/Button.tsx";
import { cn } from "../../lib/cn.ts";
import { spring } from "../../lib/motion.ts";

// ---------- Choice chips ----------

interface ChoiceRowProps<T extends string | number | boolean> {
  label: string;
  options: readonly { value: T; label: string; hint?: string }[];
  value: T | null;
  onChange: (value: T) => void;
  /** wrap: chips that wrap. equal: equal segments in one row. pairs: a 2-column grid on phones, wrapping chips from sm. */
  layout?: "wrap" | "equal" | "pairs";
  className?: string;
}

/** Single choice as large chips (radiogroup with arrow-key movement). */
export function ChoiceRow<T extends string | number | boolean>({ label, options, value, onChange, layout = "wrap", className }: ChoiceRowProps<T>) {
  const equal = layout === "equal";
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((o) => o.value === value);
  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (i + dir + options.length) % options.length;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        equal ? "grid gap-1.5" : layout === "pairs" ? "grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" : "flex flex-wrap gap-2",
        className,
      )}
      style={equal ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((o, i) => {
        const selected = i === selectedIndex;
        return (
          <button
            key={String(o.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={o.hint ? `${o.label}, ${o.hint}` : undefined}
            tabIndex={selected || (selectedIndex === -1 && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "inline-flex h-11 select-none items-center justify-center whitespace-nowrap rounded-full border text-sm font-medium tnum",
              "transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.96]",
              equal ? "px-2" : "px-3 sm:px-4",
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

// ---------- Overflow menu ----------

export interface MenuItem {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  tone?: "danger";
  disabled?: boolean;
}

export function OverflowMenu({ items, label = "More actions" }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])');
    first?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        wrapRef.current?.querySelector<HTMLButtonElement>("button[aria-haspopup]")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onMenuKey = (e: KeyboardEvent) => {
    const dir = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!dir && e.key !== "Tab") return;
    if (e.key === "Tab") {
      setOpen(false);
      return;
    }
    e.preventDefault();
    const list = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])];
    const i = list.indexOf(document.activeElement as HTMLElement);
    list[(i + dir + list.length) % list.length]?.focus();
  };

  return (
    <div ref={wrapRef} className="relative">
      <IconButton
        icon={Ellipsis}
        label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="-mr-2"
      />
      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKey}
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -2, transition: { duration: 0.12 } }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-full z-30 mt-1 min-w-56 rounded-2xl border border-line-strong bg-raised p-1.5 shadow-[0_16px_48px_rgb(0_0_0/0.5)]"
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  // Return focus to the trigger first, so a sheet opened next restores focus there.
                  wrapRef.current?.querySelector<HTMLButtonElement>("button[aria-haspopup]")?.focus();
                  item.onSelect();
                }}
                className={cn(
                  "flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:outline-none disabled:opacity-40",
                  item.tone === "danger" ? "text-danger" : "text-ink",
                )}
              >
                <item.icon size={18} aria-hidden className={item.tone === "danger" ? undefined : "text-ink-3"} />
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- Navigation ----------

export function BackButton() {
  const navigate = useNavigate();
  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) void navigate(-1);
    else void navigate("/");
  };
  return (
    <button
      type="button"
      onClick={goBack}
      className="-ml-2 inline-flex h-11 items-center gap-1 rounded-xl pl-1 pr-3 text-[15px] font-medium text-ink-2 transition-colors hover:bg-raised hover:text-ink"
    >
      <ChevronLeft size={20} aria-hidden />
      Back
    </button>
  );
}

// ---------- Bottom dock (phones) ----------

/** Fixed to the bottom of the screen on phones, outside the page's transformed container. */
export function Dock({ show, children, label }: { show: boolean; children: ReactNode; label: string }) {
  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          role="region"
          aria-label={label}
          initial={{ y: "110%" }}
          animate={{ y: 0 }}
          exit={{ y: "110%" }}
          transition={spring}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line-strong bg-surface/95 pb-safe backdrop-blur-xl lg:hidden"
        >
          <div className="mx-auto max-w-3xl px-4 py-3 sm:px-6">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ---------- Stats ----------

export function StatRow({ items, className }: { items: { label: string; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid gap-4", className)} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((s) => (
        <div key={s.label} className="min-w-0">
          <dt className="text-sm text-ink-3">{s.label}</dt>
          <dd className="mt-1 truncate text-2xl font-semibold tracking-tight text-ink tnum">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

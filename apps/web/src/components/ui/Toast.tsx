import { CircleAlert, CircleCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn.ts";
import { spring } from "../../lib/motion.ts";

type Tone = "default" | "error";
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
  action?: { label: string; onClick: () => void };
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

/** Show a transient message. Errors stay a little longer. */
export function toast(message: string, opts: { tone?: Tone; action?: ToastItem["action"]; duration?: number } = {}) {
  const id = nextId++;
  const tone = opts.tone ?? "default";
  items = [...items.slice(-2), { id, message, tone, action: opts.action }];
  emit();
  window.setTimeout(() => dismiss(id), opts.duration ?? (tone === "error" ? 5000 : 3200));
  return id;
}

export const toastError = (message: string) => toast(message, { tone: "error" });

/** Bottom-centered stack. A page with its own bottom bar (Coach's composer) lifts it with --toast-offset. */
export function Toaster() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => items,
  );
  return createPortal(
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--toast-offset,5.5rem)+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-[var(--toast-offset-lg,1.5rem)]"
    >
      <AnimatePresence initial={false}>
        {list.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98, transition: { duration: 0.15 } }}
            transition={spring}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border bg-raised py-2.5 pl-3.5 pr-2.5 text-sm shadow-[0_8px_32px_rgb(0_0_0/0.4)]",
              t.tone === "error" ? "border-danger/30 text-ink" : "border-line-strong text-ink",
              !t.action && "pr-4",
            )}
          >
            {t.tone === "error" ? (
              <CircleAlert size={17} className="shrink-0 text-danger" aria-hidden />
            ) : (
              <CircleCheck size={17} className="shrink-0 text-accent" aria-hidden />
            )}
            <span className="min-w-0">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
                className="ml-1 shrink-0 rounded-lg px-2.5 py-1 font-medium text-accent transition-colors hover:bg-hover"
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

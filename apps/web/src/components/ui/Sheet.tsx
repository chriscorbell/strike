import { X } from "lucide-react";
import { AnimatePresence, motion, useDragControls, type PanInfo } from "motion/react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn.ts";
import { useMediaQuery } from "../../lib/useMediaQuery.ts";
import { IconButton } from "./Button.tsx";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Short line under the title. */
  description?: ReactNode;
  children: ReactNode;
  /** Pinned action area under the scrolling body. */
  footer?: ReactNode;
  size?: "md" | "lg";
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

let openCount = 0;

/** Bottom sheet on phones, centered dialog from md up. Traps focus, closes on Escape and backdrop. */
export function Sheet({ open, onClose, title, description, children, footer, size = "md" }: SheetProps) {
  const desktop = useMediaQuery("(min-width: 768px)");
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const drag = useDragControls();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    openCount += 1;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const auto = panel.querySelector<HTMLElement>("[data-autofocus]");
      const first = auto ?? panel.querySelector<HTMLElement>(`[data-sheet-body] ${FOCUSABLE}`);
      (first ?? panel).focus({ preventScroll: true });
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      openCount -= 1;
      if (openCount === 0) document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 600) onClose();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
          <motion.div
            className="absolute inset-0 bg-[#060607]/70 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            className={cn(
              "relative flex max-h-[92dvh] w-full flex-col overflow-hidden bg-surface shadow-[0_-12px_48px_rgb(0_0_0/0.45)] focus:outline-none",
              "rounded-t-2xl border-t border-line-strong md:rounded-2xl md:border",
              size === "lg" ? "md:max-w-2xl" : "md:max-w-lg",
              "md:max-h-[86dvh]",
            )}
            initial={desktop ? { opacity: 0, scale: 0.97, y: 8 } : { y: "100%" }}
            animate={desktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={desktop ? { opacity: 0, scale: 0.98, y: 4 } : { y: "100%" }}
            transition={desktop ? { duration: 0.22, ease: [0.16, 1, 0.3, 1] } : { type: "spring", stiffness: 380, damping: 38 }}
            drag={desktop ? false : "y"}
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
          >
            <div
              className="shrink-0 touch-none px-5 pb-3 pt-2.5 md:px-6 md:pt-5"
              onPointerDown={(e) => {
                if (!desktop && !(e.target as HTMLElement).closest("button")) drag.start(e);
              }}
            >
              <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line-strong md:hidden" aria-hidden />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 pt-1">
                  <h2 id={titleId} className="text-lg font-semibold leading-tight tracking-tight text-ink">
                    {title}
                  </h2>
                  {description && (
                    <div id={descId} className="mt-1 text-sm text-ink-3">
                      {description}
                    </div>
                  )}
                </div>
                <IconButton icon={X} label="Close" size="sm" onClick={onClose} className="-mr-1.5" />
              </div>
            </div>
            <div data-sheet-body className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 md:px-6 md:pb-6">
              {children}
            </div>
            {footer && (
              <div className="shrink-0 border-t border-line px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 md:px-6 md:pb-5">
                {footer}
              </div>
            )}
            {!footer && <div className="shrink-0 pb-[env(safe-area-inset-bottom)] md:hidden" />}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { collapseVariants, pageVariants } from "../lib/motion.ts";

/** Page container: max width, gutters, enter animation. */
export function Page({ children, className, wide = false }: { children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <motion.main
      variants={pageVariants}
      initial="initial"
      animate="animate"
      className={cn(
        "mx-auto w-full px-4 pb-32 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 lg:px-10 lg:pb-16 lg:pt-10",
        wide ? "max-w-6xl" : "max-w-3xl",
        className,
      )}
    >
      {children}
    </motion.main>
  );
}

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Content under the title row (badges, controls). */
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, children, className }: PageHeaderProps) {
  return (
    <header className={cn("mb-6 lg:mb-8", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {subtitle && <p className="mb-1 text-sm font-medium text-ink-3">{subtitle}</p>}
          <h1 className="text-[28px] font-semibold leading-[1.1] tracking-tight text-ink lg:text-[32px]">{title}</h1>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </header>
  );
}

interface SectionProps {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  id?: string;
}

/** Titled group of content separated by space, not boxes. */
export function Section({ title, action, children, className, description, id }: SectionProps) {
  const headingId = useId();
  return (
    <section className={cn("mt-10 first:mt-0", className)} aria-labelledby={title ? headingId : undefined} id={id}>
      {(title || action) && (
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 id={headingId} className="text-[17px] font-semibold tracking-tight text-ink">
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 text-sm text-ink-3">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-1">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** The one elevated surface. Use for content that is a distinct object (a card the user acts on). */
export function Panel({ children, className, as: As = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "li" | "article" }) {
  return <As className={cn("rounded-2xl border border-line bg-surface", className)}>{children}</As>;
}

interface CollapseProps {
  open: boolean;
  children: ReactNode;
  id?: string;
  className?: string;
}

/**
 * Height-animated reveal. Content is clipped only while animating, so focus rings and shadows inside
 * aren't cut off once it's open.
 */
export function Collapse({ open, children, id, className }: CollapseProps) {
  const [animating, setAnimating] = useState(true);
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          id={id}
          key="collapse"
          variants={collapseVariants}
          initial="collapsed"
          animate="open"
          exit="collapsed"
          onAnimationStart={() => setAnimating(true)}
          onAnimationComplete={() => setAnimating(false)}
          style={{ overflow: animating ? "hidden" : "visible" }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface DisclosureProps {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  buttonClassName?: string;
}

/** Collapsible content with an animated height. */
export function Disclosure({ summary, children, defaultOpen = false, className, buttonClassName }: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1 text-sm font-medium text-ink-3 transition-colors hover:text-ink-2",
          buttonClassName,
        )}
      >
        {summary}
        <ChevronDown size={15} className={cn("transition-transform duration-200", open && "rotate-180")} aria-hidden />
      </button>
      <Collapse open={open} id={id}>
        {children}
      </Collapse>
    </div>
  );
}

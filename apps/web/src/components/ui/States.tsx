import { RotateCcw, WifiOff, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { errorMessage } from "../../lib/api.ts";
import { cn } from "../../lib/cn.ts";
import { easeOut } from "../../lib/motion.ts";
import { Button } from "./Button.tsx";

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden style={style} className={cn("animate-shimmer rounded-xl bg-raised", className)} />;
}

/** Stack of skeleton rows for list-shaped content. */
export function SkeletonList({ rows = 4, className, rowClassName }: { rows?: number; className?: string; rowClassName?: string }) {
  return (
    <div className={cn("flex flex-col gap-3", className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={cn("h-16", rowClassName)} />
      ))}
    </div>
  );
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, children, action, className }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={easeOut}
      className={cn("flex flex-col items-start gap-3 py-8", className)}
    >
      <div className="flex size-11 items-center justify-center rounded-xl bg-raised text-ink-2">
        <Icon size={20} aria-hidden />
      </div>
      <div>
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        {children && <div className="mt-1 max-w-[52ch] text-sm leading-relaxed text-ink-3">{children}</div>}
      </div>
      {action}
    </motion.div>
  );
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <EmptyState
      icon={WifiOff}
      title="Couldn't load this"
      className={className}
      action={
        onRetry && (
          <Button size="sm" icon={RotateCcw} onClick={onRetry}>
            Try again
          </Button>
        )
      }
    >
      {errorMessage(error)}
    </EmptyState>
  );
}

type BadgeTone = "neutral" | "accent" | "warn" | "danger" | "outline";
const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-raised text-ink-2",
  accent: "bg-accent-soft text-accent",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  outline: "border border-line-strong text-ink-2",
};

export function Badge({
  tone = "neutral",
  icon: Icon,
  children,
  className,
  title,
}: {
  tone?: BadgeTone;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-medium",
        badgeTones[tone],
        className,
      )}
    >
      {Icon && <Icon size={12} strokeWidth={2.25} aria-hidden />}
      {children}
    </span>
  );
}

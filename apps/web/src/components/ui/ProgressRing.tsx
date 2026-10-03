import { motion } from "motion/react";
import type { ReactNode } from "react";

interface ProgressRingProps {
  /** 0..1; values above 1 render a full ring. */
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  children?: ReactNode;
  label?: string;
}

/** Circular meter. The track is a quiet step of the same surface so state reads around the ring. */
export function ProgressRing({
  value,
  size = 120,
  stroke = 10,
  color = "var(--color-accent)",
  trackColor = "var(--color-raised)",
  children,
  label,
}: ProgressRingProps) {
  const r = (size - stroke) / 2;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: v, opacity: v === 0 ? 0 : 1 }}
          transition={{ type: "spring", stiffness: 70, damping: 20 }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>}
    </div>
  );
}

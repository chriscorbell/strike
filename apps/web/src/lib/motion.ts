// Shared motion presets. MotionConfig reducedMotion="user" at the root turns transforms off for
// people who ask for reduced motion; opacity fades remain.
import type { Transition, Variants } from "motion/react";

export const spring: Transition = { type: "spring", stiffness: 420, damping: 36, mass: 0.9 };
export const softSpring: Transition = { type: "spring", stiffness: 260, damping: 30 };
export const easeOut: Transition = { duration: 0.32, ease: [0.16, 1, 0.3, 1] };

/** Page-level enter. */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: easeOut },
};

/** List container that staggers its children. */
export const listVariants: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } },
};

export const itemVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: easeOut },
  exit: { opacity: 0, y: -4, transition: { duration: 0.18 } },
};

/** Height-auto collapse for disclosures. */
export const collapseVariants: Variants = {
  collapsed: { height: 0, opacity: 0, transition: { height: { duration: 0.28, ease: [0.16, 1, 0.3, 1] }, opacity: { duration: 0.15 } } },
  open: { height: "auto", opacity: 1, transition: { height: { duration: 0.32, ease: [0.16, 1, 0.3, 1] }, opacity: { duration: 0.25, delay: 0.05 } } },
};

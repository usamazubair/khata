import type { Transition, Variants } from "motion/react";

/* A small, fixed motion vocabulary — every animation in the app is built from
   these, so timing and easing stay consistent instead of drifting per page. */

// Gentle deceleration for anything entering the screen.
export const ease: Transition["ease"] = [0.22, 1, 0.36, 1];

export const spring: Transition = { type: "spring", stiffness: 380, damping: 32, mass: 0.8 };
export const softSpring: Transition = { type: "spring", stiffness: 220, damping: 28 };

/** Route-level: content lifts in as the previous page fades out. */
export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.16, ease } },
};

/** Parent of a list/grid — children cascade rather than appearing at once. */
export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
};

/** Child of a staggered list. Also used standalone for single cards. */
export const riseItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.18, ease } },
};

/** Table rows: shorter travel than cards so long lists don't feel sloppy. */
export const rowItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.24, ease } },
  exit: { opacity: 0, x: -12, transition: { duration: 0.18, ease } },
};

/** Modal: backdrop fades, panel scales up from slightly small. */
export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.14 } },
};

export const panelVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 12 },
  show: { opacity: 1, scale: 1, y: 0, transition: spring },
  exit: { opacity: 0, scale: 0.97, y: 8, transition: { duration: 0.14, ease } },
};

/** Interactive affordances — subtle, never bouncy. */
export const tapScale = { scale: 0.97 };
export const hoverLift = { y: -3 };

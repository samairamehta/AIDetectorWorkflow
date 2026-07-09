"use client";

import { useEffect, useRef } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  type Variants,
} from "motion/react";

// Shared motion vocabulary. One spring, one stagger rhythm, used everywhere
// so the app feels like a single system instead of a collection of effects.

export const SPRING = { type: "spring", duration: 0.4, bounce: 0 } as const;

// Jakub-style materialize: opacity + small rise + blur into focus.
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: SPRING,
  },
};

export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

// Entrance group: stagger children on first mount.
export function Reveal({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={fadeUp}>
      {children}
    </motion.div>
  );
}

// Animated number. Renders via a ref so re-renders stay cheap; snaps
// instantly when the user prefers reduced motion.
export function CountUp({
  value,
  format = (v: number) => Math.round(v).toLocaleString(),
  duration = 0.7,
  className,
  from,
}: {
  value: number;
  format?: (v: number) => string;
  duration?: number;
  className?: string;
  // When set, the first mount animates from this value (e.g. a score
  // counting up from 0). Otherwise first paint is instant and readable.
  from?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const mv = useMotionValue(from ?? value);
  const first = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const skipAnimation = reduced || (first.current && from === undefined);
    first.current = false;
    if (skipAnimation) {
      mv.set(value);
      el.textContent = format(value);
      return;
    }
    const controls = animate(mv, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = format(v);
      },
    });
    return () => controls.stop();
  }, [value, reduced, duration, format, mv]);

  return (
    <span ref={ref} className={className}>
      {format(from ?? value)}
    </span>
  );
}

"use client";
import * as m from "motion/react-m";
import { useReducedMotion } from "motion/react";
import { DURATION, EASE_OUT_SOFT, STAGGER } from "./motion-provider";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** Position in a staggered group (0, 1, 2…). */
  index?: number;
  delay?: number;
  /** Distance travelled in px. Kept small: the reveal should feel like light arriving, not movement. */
  y?: number;
  as?: "div" | "li" | "section" | "p" | "span";
};

/** Soft fade-and-rise when the element enters the viewport. Transform + opacity only, so no layout shift. */
export function Reveal({ children, className, index = 0, delay = 0, y = 24, as = "div" }: RevealProps) {
  const reduced = useReducedMotion();
  const Comp = m[as];
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y: reduced ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: reduced ? 0.2 : DURATION.reveal, ease: EASE_OUT_SOFT, delay: delay + index * STAGGER }}
    >
      {children}
    </Comp>
  );
}

"use client";
import { LazyMotion, MotionConfig, domAnimation, useReducedMotion } from "motion/react";
import { ReactLenis } from "lenis/react";

/**
 * App-wide motion setup for the brand site.
 * - LazyMotion + `m` components keep the animation runtime small (domAnimation features only).
 * - MotionConfig reducedMotion="user" makes every Motion animation honour prefers-reduced-motion.
 * - Lenis gives the slow, film-like wheel scroll; it is skipped entirely for reduced-motion users,
 *   and touch devices keep native scrolling (Lenis default), which is what feels right on phones.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const content = (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.9, ease: EASE_OUT_SOFT }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
  if (reduced) return content;
  return (
    <ReactLenis root options={{ lerp: 0.085, wheelMultiplier: 0.9, anchors: true, autoRaf: true }}>
      {content}
    </ReactLenis>
  );
}

// Motion tokens mirrored from globals.css for JS-driven animation.
export const EASE_OUT_SOFT = [0.22, 1, 0.36, 1] as const;
export const EASE_IN_OUT_FILM = [0.65, 0, 0.35, 1] as const;
export const DURATION = { uiFast: 0.15, ui: 0.22, reveal: 0.9, revealSlow: 1.2, page: 0.7 } as const;
export const STAGGER = 0.08;

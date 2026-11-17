"use client";
import { useRef } from "react";
import * as m from "motion/react-m";
import { useReducedMotion, useScroll, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Scroll-linked drift for imagery. The media is scaled up slightly so its edges never show while it moves.
 * `strength` is the travel as a share of the frame height (max 12% per the motion tokens).
 */
export function Parallax({
  children,
  className,
  strength = 0.08,
  zoom = false,
}: {
  children: React.ReactNode;
  className?: string;
  strength?: number;
  /** Also grow gently from 1.0 → 1.06 while passing through the viewport. */
  zoom?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const s = Math.min(strength, 0.12);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [`${-s * 50}%`, `${s * 50}%`]);
  const scale = useTransform(scrollYProgress, [0, 1], zoom ? [1 + s, 1 + s + 0.06] : [1 + s, 1 + s]);

  return (
    <div ref={ref} className={cn("relative overflow-hidden", className)}>
      <m.div className="absolute inset-0 will-change-transform" style={reduced ? undefined : { y, scale }}>
        {children}
      </m.div>
    </div>
  );
}

/** Slow Ken Burns drift for a hero still. Pure CSS (runs on the compositor); disabled for reduced motion. */
export function KenBurns({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className="absolute inset-0 motion-safe:animate-[kenburns_18s_var(--ease-in-out-film)_infinite_alternate] will-change-transform">
        {children}
      </div>
    </div>
  );
}

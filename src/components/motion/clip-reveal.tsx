"use client";
import * as m from "motion/react-m";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { DURATION, EASE_IN_OUT_FILM, EASE_OUT_SOFT } from "./motion-provider";

type Direction = "up" | "down" | "left" | "right";
const hidden: Record<Direction, string> = {
  up: "inset(100% 0% 0% 0%)",
  down: "inset(0% 0% 100% 0%)",
  left: "inset(0% 0% 0% 100%)",
  right: "inset(0% 100% 0% 0%)",
};

/**
 * Image wipe: the frame opens with a clip-path while the picture inside settles from a slight zoom.
 * The box keeps its size the whole time (only clip-path/transform animate), so there is no layout shift.
 * Give it a sized child, e.g. <BrandImage fill /> inside an aspect-ratio wrapper.
 */
export function ClipReveal({
  children,
  className,
  direction = "up",
  delay = 0,
  immediate = false,
}: {
  children: React.ReactNode;
  className?: string;
  direction?: Direction;
  delay?: number;
  /**
   * For images visible on load (often the LCP element): a pure-CSS wipe that starts at first paint, with no wait for
   * JavaScript or an IntersectionObserver, so the picture is never held back.
   */
  immediate?: boolean;
}) {
  const reduced = useReducedMotion();
  if (immediate) {
    return (
      <div className={cn("relative overflow-hidden motion-safe:animate-[clip-up_1.1s_var(--ease-in-out-film)_both]", className)}>
        <div className="absolute inset-0 motion-safe:animate-[settle_1.6s_var(--ease-out-soft)_both]">{children}</div>
      </div>
    );
  }
  if (reduced) {
    return (
      <m.div className={cn("relative overflow-hidden", className)} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.3 }}>
        {children}
      </m.div>
    );
  }
  return (
    <m.div
      className={cn("relative overflow-hidden", className)}
      initial={{ clipPath: hidden[direction] }}
      whileInView={{ clipPath: "inset(0% 0% 0% 0%)" }}
      viewport={{ once: true, margin: "0px 0px -15% 0px" }}
      transition={{ duration: DURATION.revealSlow, ease: EASE_IN_OUT_FILM, delay }}
    >
      <m.div
        className="absolute inset-0"
        initial={{ scale: 1.14 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true, margin: "0px 0px -15% 0px" }}
        transition={{ duration: DURATION.revealSlow + 0.4, ease: EASE_OUT_SOFT, delay }}
      >
        {children}
      </m.div>
    </m.div>
  );
}

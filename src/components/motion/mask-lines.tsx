"use client";
import * as m from "motion/react-m";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT_SOFT, STAGGER } from "./motion-provider";

type Props = {
  /** One string per visual line. Lines are given explicitly so nothing is measured at runtime (zero CLS). */
  lines: string[];
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
  lineClassName?: string;
  delay?: number;
  /** "mount" plays immediately (hero); "view" waits until scrolled into view. */
  trigger?: "mount" | "view";
  id?: string;
};

/** Headline revealed line by line, each line rising out of a soft mask. Screen readers get the plain sentence. */
export function MaskLines({ lines, as: Tag = "h2", className, lineClassName, delay = 0, trigger = "view", id }: Props) {
  const reduced = useReducedMotion();
  const show = { y: "0%", opacity: 1 };
  return (
    <Tag id={id} className={className}>
      <span className="sr-only">{lines.join(" ")}</span>
      <span aria-hidden="true">
        {lines.map((line, i) => (
          // pb/-mb gives descenders room inside the mask without changing line height
          <span key={i} className={cn("block overflow-hidden pb-[0.12em] -mb-[0.12em]", lineClassName)}>
            <m.span
              className="block will-change-transform"
              initial={reduced ? { opacity: 0 } : { y: "105%", opacity: 1 }}
              {...(trigger === "mount" ? { animate: show } : { whileInView: show, viewport: { once: true, margin: "0px 0px -10% 0px" } })}
              transition={{ duration: reduced ? 0.2 : DURATION.revealSlow, ease: EASE_OUT_SOFT, delay: delay + i * STAGGER * 1.5 }}
            >
              {line}
            </m.span>
          </span>
        ))}
      </span>
    </Tag>
  );
}

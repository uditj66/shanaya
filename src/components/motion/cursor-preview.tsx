"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import * as m from "motion/react-m";
import { AnimatePresence, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { cn } from "@/lib/utils";
import { EASE_OUT_SOFT } from "./motion-provider";

export type PreviewItem = {
  key: string;
  href: Route;
  title: string;
  /** Right-hand detail, e.g. "from ₹3,499 · 75 min" */
  meta?: string;
  eyebrow?: string;
  /** The preview picture (a <BrandImage fill />). */
  media: React.ReactNode;
};

/**
 * Editorial list where a picture floats beside the cursor for the hovered row (desktop, fine pointer).
 * On touch devices and for reduced motion it is simply a clean list; the picture never covers text.
 */
export function CursorPreview({ items, className }: { items: PreviewItem[]; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const x = useSpring(useMotionValue(0), { stiffness: 140, damping: 22, mass: 0.6 });
  const y = useSpring(useMotionValue(0), { stiffness: 140, damping: 22, mass: 0.6 });

  const preview = useRef<HTMLDivElement>(null);
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    // Keep the floating picture inside the list's own box so it can never push the page wider (no horizontal scroll).
    const w = preview.current?.offsetWidth ?? 0;
    x.set(Math.min(e.clientX - r.left, r.width - w - 32));
    y.set(e.clientY - r.top);
  };

  const current = items.find((i) => i.key === active);

  return (
    <div ref={ref} className={cn("relative", className)} onPointerMove={onMove} onPointerLeave={() => setActive(null)}>
      <ul className="divide-y divide-line border-y border-line">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              onPointerEnter={(e) => e.pointerType === "mouse" && setActive(item.key)}
              onFocus={() => setActive(null)}
              className="group grid grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-1 py-6 transition-colors duration-[var(--duration-ui)] md:py-8"
            >
              {item.eyebrow && <span className="eyebrow col-span-2">{item.eyebrow}</span>}
              <span className="display-cut text-h3 transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover:translate-x-2 md:text-h2">
                {item.title}
              </span>
              {item.meta && <span className="text-sm text-stone tabular-nums">{item.meta}</span>}
            </Link>
          </li>
        ))}
      </ul>

      {!reduced && (
        <m.div
          ref={preview}
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 z-10 hidden h-[clamp(14rem,22vw,20rem)] w-[clamp(11rem,17vw,15rem)] translate-x-8 -translate-y-[110%] [@media(hover:hover)_and_(pointer:fine)]:block"
          style={{ x, y }}
        >
          <AnimatePresence>
            {current && (
              <m.div
                key={current.key}
                className="absolute inset-0 overflow-hidden rounded-[var(--radius-image)] shadow-lift"
                initial={{ opacity: 0, scale: 0.92, clipPath: "inset(12% 12% 12% 12%)" }}
                animate={{ opacity: 1, scale: 1, clipPath: "inset(0% 0% 0% 0%)" }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.6, ease: EASE_OUT_SOFT }}
              >
                {current.media}
              </m.div>
            )}
          </AnimatePresence>
        </m.div>
      )}
    </div>
  );
}

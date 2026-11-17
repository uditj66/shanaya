"use client";
import { useEffect, useState } from "react";
import * as m from "motion/react-m";
import { AnimatePresence, useReducedMotion } from "motion/react";
import { Rating } from "@/components/ui/display";
import { EASE_OUT_SOFT } from "@/components/motion/motion-provider";
import { SampleBadge } from "./sections";

type Item = { id: string; name: string; quote: string; rating: number; studio: string | null; treatment: string | null; isSample: boolean };

/**
 * One large quote at a time, slow cross-fade every 8s. Pauses on hover, on keyboard focus and when the user pauses it
 * (WCAG 2.2.2). No autoplay for reduced-motion users.
 */
export function Testimonials({ items }: { items: Item[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const reduced = useReducedMotion();
  const running = !paused && !hovered && !reduced && items.length > 1;

  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setI((n) => (n + 1) % items.length), 8000);
    return () => clearTimeout(t);
  }, [running, i, items.length]);

  const t = items[i];
  if (!t) return null;
  return (
    <div
      className="mx-auto grid max-w-4xl justify-items-center text-center"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <div className="relative grid min-h-[16rem] w-full place-items-center md:min-h-[14rem]" aria-live={running ? "off" : "polite"}>
        <AnimatePresence mode="wait" initial={false}>
          <m.figure key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.8, ease: EASE_OUT_SOFT }}>
            <blockquote className="display-cut text-h2 leading-[1.2]">
              <span aria-hidden="true" className="text-brass">“</span>
              {t.quote}
              <span aria-hidden="true" className="text-brass">”</span>
            </blockquote>
            <figcaption className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-stone">
              <span className="text-charcoal">{t.name}</span>
              {t.treatment && <span>· {t.treatment}</span>}
              {t.studio && <span>· {t.studio}</span>}
              <SampleBadge show={t.isSample} />
            </figcaption>
            <Rating value={t.rating} className="mt-3 justify-center" />
          </m.figure>
        </AnimatePresence>
      </div>
      {items.length > 1 && (
        <div className="mt-8 flex items-center gap-4">
          <div className="flex gap-1" role="group" aria-label="Choose a review">
            {items.map((it, n) => (
              <button key={it.id} onClick={() => setI(n)} aria-label={`Review ${n + 1} of ${items.length}`} aria-current={n === i} className="grid size-11 place-items-center">
                <span className={`block h-px transition-all duration-500 ${n === i ? "w-8 bg-charcoal" : "w-4 bg-champagne"}`} />
              </button>
            ))}
          </div>
          {!reduced && (
            <button onClick={() => setPaused((p) => !p)} className="inline-flex min-h-11 items-center text-[0.8125rem] text-stone underline decoration-line underline-offset-4 hover:text-charcoal">
              {paused ? "Play" : "Pause"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

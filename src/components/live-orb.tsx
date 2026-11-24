"use client";
// Shanaya's presence during a website voice call: a gold orb that breathes, listens, thinks and speaks.
// Loudness arrives ~10 times a second; it is smoothed on each animation frame and written straight to CSS variables
// (--speak, --listen), so the orb moves fluidly without re-rendering React.
import { useEffect, useRef, type RefObject } from "react";
import { cn } from "@/lib/utils";
import type { Levels } from "./use-shanaya-voice";

export type OrbState = "idle" | "connecting" | "listening" | "thinking" | "working" | "speaking" | "muted";

/** Ease a value towards its target: fast when rising (a syllable), slow when falling (no flicker between words). */
const follow = (cur: number, target: number) => cur + (target - cur) * (target > cur ? 0.35 : 0.08);

export function LiveOrb({ state, levels, size = 176 }: { state: OrbState; levels: RefObject<Levels>; size?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let speak = 0;
    let listen = 0;
    const tick = () => {
      const { ai, you } = levels.current;
      // Microphone levels are small (~0.02–0.3 for normal speech): lift them so a normal voice visibly moves the orb.
      speak = follow(speak, state === "speaking" ? Math.min(1, ai * 1.6) : 0);
      listen = follow(listen, state === "listening" ? Math.min(1, Math.sqrt(you) * 1.8) : 0);
      el.style.setProperty("--speak", speak.toFixed(3));
      el.style.setProperty("--listen", listen.toFixed(3));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [state, levels]);

  return (
    <span
      ref={ref}
      aria-hidden
      data-state={state}
      className="relative inline-grid shrink-0 place-items-center [--listen:0] [--speak:0]"
      style={{ width: size, height: size }}
    >
      {/* Halo: swells with her voice (warm) or with the guest's voice (softer, wider) */}
      <span
        className={cn(
          "absolute inset-[-14%] rounded-full blur-xl transition-opacity duration-500",
          "bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-gold)_55%,transparent)_0%,transparent_68%)]",
          state === "muted" ? "opacity-0" : "opacity-100",
          (state === "connecting" || state === "idle") && "motion-safe:animate-pulse",
        )}
        style={{ transform: "scale(calc(0.85 + var(--speak) * 0.45 + var(--listen) * 0.3))" }}
      />

      {/* Listening ripple: a thin ring that widens as the guest speaks */}
      <span
        className={cn("absolute inset-0 rounded-full border border-brass/40 transition-opacity duration-300", state === "listening" ? "opacity-100" : "opacity-0")}
        style={{ transform: "scale(calc(1.04 + var(--listen) * 0.16))", opacity: state === "listening" ? "calc(0.35 + var(--listen) * 0.65)" : undefined }}
      />

      {/* Thinking: a slow champagne shimmer around the sphere */}
      <span
        className={cn(
          "absolute inset-[-5%] rounded-full transition-opacity duration-500 motion-safe:animate-[spin_2.8s_linear_infinite]",
          "bg-[conic-gradient(from_0deg,transparent_0%,color-mix(in_oklab,var(--color-champagne)_90%,white)_18%,transparent_36%)]",
          "[mask:radial-gradient(circle,transparent_62%,black_63%,black_70%,transparent_71%)]",
          state === "thinking" ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Working (a booking tool is running): a fine brass arc travelling round */}
      <span
        className={cn(
          "absolute inset-[-7%] rounded-full border-2 border-transparent border-t-brass border-r-brass/40 transition-opacity duration-300 motion-safe:animate-[spin_1.1s_linear_infinite]",
          state === "working" ? "opacity-100" : "opacity-0",
        )}
      />

      {/* The sphere */}
      <span
        className={cn(
          "relative h-full w-full rounded-full shadow-lift transition-[filter,opacity] duration-500",
          "bg-[radial-gradient(circle_at_32%_28%,#f6e9d2_0%,#e9d3b0_22%,var(--color-gold)_55%,color-mix(in_oklab,var(--color-rose)_70%,var(--color-gold))_100%)]",
          state === "muted" && "opacity-60 grayscale-[60%]",
          (state === "connecting" || state === "idle") && "motion-safe:animate-pulse",
        )}
        style={{ transform: "scale(calc(0.94 + var(--speak) * 0.09 + var(--listen) * 0.03))" }}
      >
        {/* Soft moving light on the surface while she speaks */}
        <span
          className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_70%_75%,rgba(255,255,255,0.35),transparent_45%)] mix-blend-soft-light"
          style={{ opacity: "calc(0.25 + var(--speak) * 0.75)" }}
        />
      </span>
    </span>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Hero film layered over the still. The still (server-rendered, `priority`) is always the LCP image; the muted loop is
 * only fetched after hydration on larger screens, when the visitor hasn't asked for reduced motion or data saving,
 * and fades in once it can actually play. Phones keep the lighter Ken Burns still.
 */
export function HeroMedia({ src, children, className }: { src: string | null; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const ok =
      window.matchMedia("(min-width: 768px)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      !conn?.saveData &&
      !/2g/.test(conn?.effectiveType ?? "");
    // Defer until the browser is idle so the film never competes with the first paint.
    const start = () => setEnabled(ok);
    const idle = typeof window.requestIdleCallback === "function";
    const id = idle ? window.requestIdleCallback(start, { timeout: 2500 }) : setTimeout(start, 1200);
    return () => (idle ? window.cancelIdleCallback(id as number) : clearTimeout(id));
  }, []);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {children}
      {enabled && src && (
        <video
          ref={ref}
          src={src}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
          onPlaying={() => setPlaying(true)}
          className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-[1.6s] ease-[var(--ease-out-soft)]", playing ? "opacity-100" : "opacity-0")}
        />
      )}
    </div>
  );
}

"use client";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Before / after comparison. A native range input drives it, so it works with keyboard (arrows, Home/End),
 * screen readers and touch out of the box; the brass handle is purely visual.
 */
export function BeforeAfter({
  before,
  after,
  beforeLabel = "Before",
  afterLabel = "After",
  label,
  className,
  initial = 50,
}: {
  before: React.ReactNode;
  after: React.ReactNode;
  beforeLabel?: string;
  afterLabel?: string;
  /** Accessible name, e.g. "Compare skin before and after the Korean Glass Skin Facial". */
  label: string;
  className?: string;
  initial?: number;
}) {
  const [value, setValue] = useState(initial);
  const id = useId();

  return (
    <div className={cn("relative isolate overflow-hidden rounded-[var(--radius-image)] bg-sand select-none", className)}>
      <div className="absolute inset-0">{after}</div>
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - value}% 0 0)` }}>
        {before}
      </div>

      <span className="eyebrow pointer-events-none absolute top-4 left-4 rounded-full bg-ivory/85 px-3 py-1.5 backdrop-blur-sm">{beforeLabel}</span>
      <span className="eyebrow pointer-events-none absolute top-4 right-4 rounded-full bg-ivory/85 px-3 py-1.5 backdrop-blur-sm">{afterLabel}</span>

      {/* handle */}
      <div className="pointer-events-none absolute inset-y-0 w-px bg-ivory shadow-[0_0_0_0.5px_rgb(43_37_35/0.15)]" style={{ left: `${value}%` }}>
        <span className="absolute top-1/2 left-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-champagne bg-ivory/90 text-brass-ink shadow-soft backdrop-blur-sm">
          <svg width="22" height="10" viewBox="0 0 22 10" fill="none" aria-hidden="true">
            <path d="M5 1 1 5l4 4M17 1l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>

      <label htmlFor={id} className="sr-only">{label}</label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        aria-valuetext={`${value}% ${beforeLabel.toLowerCase()}`}
        className="peer absolute inset-0 z-10 h-full w-full cursor-ew-resize touch-pan-y appearance-none opacity-0"
      />
      {/* focus ring for the invisible input */}
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] ring-brass ring-offset-0 peer-focus-visible:ring-2" />
    </div>
  );
}

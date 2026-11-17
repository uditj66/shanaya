import { cva, type VariantProps } from "class-variance-authority";
import { cn, formatDuration, formatPrice } from "@/lib/utils";

/** Small caps label that sits above a heading. */
export function Eyebrow({ className, as: Tag = "p", ...props }: React.ComponentProps<"p"> & { as?: "p" | "span" | "h2" | "h3" }) {
  return <Tag className={cn("eyebrow", className)} {...props} />;
}

/** Refined 1px rule; `ornament` adds a small brass lozenge in the middle. */
export function Divider({ className, ornament = false }: { className?: string; ornament?: boolean }) {
  if (!ornament) return <hr className={cn("border-0 border-t border-line", className)} />;
  return (
    <div role="separator" className={cn("flex items-center gap-4 text-brass", className)}>
      <span className="h-px flex-1 bg-line" />
      <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true"><path d="M4.5 0 9 4.5 4.5 9 0 4.5Z" fill="currentColor" /></svg>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

const badge = cva("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.75rem] font-medium tracking-[0.02em]", {
  variants: {
    tone: {
      neutral: "bg-linen text-charcoal",
      accent: "bg-blush text-blush-ink",
      brass: "border border-champagne bg-ivory text-brass-ink",
      success: "bg-success/10 text-success",
      danger: "bg-danger/10 text-danger",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border border-line bg-white/70 p-6 shadow-soft md:p-8", className)} {...props} />;
}

/** "from ₹3,499 · 1 hr 15 min" with tabular figures. */
export function Price({
  amount,
  currency = "INR",
  from = false,
  minutes,
  className,
}: {
  amount: number;
  currency?: string;
  from?: boolean;
  minutes?: number;
  className?: string;
}) {
  return (
    <p className={cn("text-sm text-stone tabular-nums", className)}>
      {from && <span className="mr-1">from</span>}
      <span className="font-medium text-charcoal">{formatPrice(amount, currency)}</span>
      {minutes != null && (
        <>
          <span aria-hidden="true" className="mx-2 text-champagne">·</span>
          <span>{formatDuration(minutes)}</span>
        </>
      )}
    </p>
  );
}

/** Five fine stars, partially filled; announced as "4.8 out of 5". */
export function Rating({ value, count, className }: { value: number; count?: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  const stars = (
    <span className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 2.8 2.7 6 6.5.6-4.9 4.3 1.5 6.4L12 16.8 6.2 20.1l1.5-6.4L2.8 9.4l6.5-.6Z" fill="currentColor" />
        </svg>
      ))}
    </span>
  );
  return (
    <p className={cn("inline-flex items-center gap-2 text-sm text-stone", className)}>
      <span className="sr-only">Rated {value.toFixed(1)} out of 5{count ? ` from ${count} reviews` : ""}</span>
      <span aria-hidden="true" className="relative inline-block">
        <span className="text-sand">{stars}</span>
        <span className="absolute inset-0 overflow-hidden text-brass" style={{ width: `${pct}%` }}>{stars}</span>
      </span>
      <span aria-hidden="true" className="tabular-nums">
        {value.toFixed(1)}
        {count ? ` · ${count.toLocaleString("en-IN")} reviews` : ""}
      </span>
    </p>
  );
}

/** Calm loading placeholder (no spinners). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block rounded-lg bg-[linear-gradient(90deg,var(--color-linen)_0%,var(--color-sand)_50%,var(--color-linen)_100%)] bg-[length:200%_100%] motion-safe:animate-[shimmer_1.8s_linear_infinite]",
        className,
      )}
    />
  );
}

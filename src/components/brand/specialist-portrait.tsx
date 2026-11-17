import { cn } from "@/lib/utils";
import { BrandImage, imageEntry } from "./brand-image";

/**
 * A specialist's portrait. Until the studio uploads a real photo of that person, we show a quiet monogram rather than a
 * stock photo of a stranger presented as a named team member.
 */
export function SpecialistPortrait({ name, title, portrait, sizes, className }: { name: string; title: string; portrait: string | null; sizes: string; className?: string }) {
  const hasPhoto = !!portrait && !!imageEntry(portrait) && portrait.startsWith("team.");
  if (hasPhoto) return <BrandImage id={portrait!} fill sizes={sizes} alt={`${name}, ${title}`} className={className} />;
  const initials = name
    .replace(/^Dr\.?\s+/i, "")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span role="img" aria-label={`${name}, ${title}`} className={cn("absolute inset-0 grid place-items-center bg-[radial-gradient(120%_90%_at_30%_15%,var(--color-ivory)_0%,var(--color-linen)_55%,var(--color-sand)_100%)]", className)}>
      <span className="grid aspect-square w-[46%] place-items-center rounded-full border border-champagne">
        <span className="display-cut text-[clamp(1.75rem,4vw,3rem)] tracking-[0.04em] text-brass-ink">{initials}</span>
      </span>
    </span>
  );
}

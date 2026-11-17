import Link from "next/link";
import { brandHref, type BrandPath } from "@/lib/brand/href";
import { cn } from "@/lib/utils";
import { MaskLines } from "@/components/motion/mask-lines";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/display";

/** Structured data. JSON is escaped so content can never break out of the script tag. */
export function JsonLd({ data }: { data: object | object[] }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

/** Marks illustrative content in previews; sample rows never reach the live site. */
export function SampleBadge({ show, className }: { show: boolean; className?: string }) {
  if (!show) return null;
  return (
    <Badge tone="brass" className={cn("px-2 py-0.5 text-[0.6875rem]", className)}>
      Sample
    </Badge>
  );
}

/** Eyebrow + serif heading (+ optional lead and link), revealed on scroll. */
export function SectionHeader({
  eyebrow,
  title,
  lines,
  lead,
  link,
  id,
  className,
  align = "left",
}: {
  eyebrow: string;
  title?: string;
  /** Explicit line breaks for the mask reveal; otherwise `title` is used as one block. */
  lines?: string[];
  lead?: string;
  link?: { href: BrandPath; label: string };
  id?: string;
  className?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={cn("grid gap-5", align === "center" && "justify-items-center text-center", className)}>
      <Reveal>
        <p className="eyebrow">{eyebrow}</p>
      </Reveal>
      {lines ? (
        <MaskLines as="h2" lines={lines} className="display-cut text-h1" />
      ) : (
        <Reveal>
          <h2 id={id} className="display-cut max-w-[22ch] text-h1">{title}</h2>
        </Reveal>
      )}
      {lead && (
        <Reveal delay={0.1}>
          <p className={cn("max-w-[52ch] text-lead text-stone", align === "center" && "mx-auto")}>{lead}</p>
        </Reveal>
      )}
      {link && (
        <Reveal delay={0.15}>
          <Link href={brandHref(link.href)} className="group inline-flex min-h-11 items-center gap-3 text-sm tracking-[0.04em]">
            <span className="border-b border-charcoal/30 pb-0.5 transition-colors group-hover:border-charcoal">{link.label}</span>
            <span aria-hidden="true" className="transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover:translate-x-1">→</span>
          </Link>
        </Reveal>
      )}
    </div>
  );
}

/** Top of an inner page: eyebrow, masked headline, lead. */
export function PageIntro({ eyebrow, lines, lead, children }: { eyebrow: string; lines: string[]; lead?: string; children?: React.ReactNode }) {
  return (
    <section className="container-page pt-14 pb-12 md:pt-24 md:pb-20">
      <p className="eyebrow">{eyebrow}</p>
      <MaskLines as="h1" trigger="mount" lines={lines} className="display-cut mt-5 text-display-l" />
      {lead && <p className="mt-7 max-w-[56ch] text-lead text-stone">{lead}</p>}
      {children}
    </section>
  );
}

/** Native disclosure list: keyboard and screen-reader friendly with no JavaScript. */
export function Faqs({ items, className }: { items: { q: string; a: string }[]; className?: string }) {
  return (
    <div className={cn("divide-y divide-line border-y border-line", className)}>
      {items.map((f) => (
        <details key={f.q} className="group py-2">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 text-lead [&::-webkit-details-marker]:hidden">
            {f.q}
            <span aria-hidden="true" className="text-xl text-brass transition-transform duration-300 group-open:rotate-45">+</span>
          </summary>
          <p className="pb-5 text-stone">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

/** Small breadcrumb trail (visual + semantic; the JSON-LD version is added by the page). */
export function Breadcrumbs({ items }: { items: [string, BrandPath | null][] }) {
  return (
    <nav aria-label="Breadcrumb" className="container-page pt-8 md:pt-10">
      <ol className="flex flex-wrap items-center gap-2 text-[0.8125rem] text-stone">
        {items.map(([label, href], i) => (
          <li key={label} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true" className="text-champagne">/</span>}
            {href ? (
              <Link href={brandHref(href)} className="inline-flex min-h-8 items-center hover:text-charcoal">{label}</Link>
            ) : (
              <span aria-current="page" className="text-charcoal">{label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

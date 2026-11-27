import type { Metadata } from "next";
import { PageTransition } from "@/components/motion/page-transition";
import { Reveal } from "@/components/motion/reveal";
import { Divider, Eyebrow } from "@/components/ui/display";
import { ComponentDemos, MotionDemos } from "./demos";

// SSG: no runtime data, prerendered once. Internal reference page, kept out of search results.
export const metadata: Metadata = { title: "Design system", robots: { index: false, follow: false } };

const palette = [
  { token: "ivory", hex: "#FBF8F3", use: "Page base" },
  { token: "linen", hex: "#F4EEE5", use: "Alternate sections, cards" },
  { token: "sand", hex: "#E9DFD0", use: "Fills" },
  { token: "champagne", hex: "#D8C3A0", use: "Decorative lines, mats" },
  { token: "brass", hex: "#9C7A47", use: "Hairlines, icons, focus" },
  { token: "brass-ink", hex: "#7A5C2E", use: "Labels, links" },
  { token: "blush", hex: "#F1E1DC", use: "Accent: chips, selected" },
  { token: "blush-ink", hex: "#874E46", use: "Accent text" },
  { token: "stone", hex: "#655A53", use: "Secondary text" },
  { token: "charcoal", hex: "#2B2523", use: "All primary text" },
];

// WCAG relative-luminance contrast, computed at build time so the numbers on the page are always true.
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const typeScale = [
  { name: "Display XL", cls: "display-cut text-display-xl", sample: "Finest light" },
  { name: "Display L", cls: "display-cut text-display-l", sample: "Skin, in its finest light" },
  { name: "H1", cls: "display-cut text-h1", sample: "Signature rituals" },
  { name: "H2", cls: "display-cut text-h2", sample: "The Korean Glass Skin Facial" },
  { name: "H3", cls: "display-cut text-h3", sample: "Bandra West studio" },
  { name: "Lead", cls: "text-lead text-stone", sample: "Seventy-five unhurried minutes of hydration, gentle exfoliation and a dewy, glass-like finish." },
  { name: "Body", cls: "text-body", sample: "Every Lumière studio follows the same ritual, the same products and the same price, from Bandra to Park Street." },
  { name: "Eyebrow", cls: "eyebrow", sample: "Signature · 75 minutes" },
];

const spacing = [4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 160, 200];

const motionTokens = [
  ["--ease-out-soft", "cubic-bezier(.22, 1, .36, 1)", "Reveals"],
  ["--ease-in-out-film", "cubic-bezier(.65, 0, .35, 1)", "Wipes, page transitions"],
  ["--ease-ui", "cubic-bezier(.2, 0, 0, 1)", "Hover and press"],
  ["ui-fast / ui", "150ms / 220ms", "UI feedback"],
  ["reveal / reveal-slow", "900ms / 1200ms", "Scroll reveals"],
  ["page", "700ms", "Route transition"],
  ["kenburns", "18s", "Hero drift"],
  ["stagger", "80ms", "Per line or item"],
];

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="container-page py-20 md:py-32">
      <Reveal>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 id={`${id}-title`} className="display-cut mt-4 text-h1">{title}</h2>
      </Reveal>
      <div className="mt-12 md:mt-16">{children}</div>
    </section>
  );
}

export default function StyleguidePage() {
  return (
    <PageTransition>
      <section className="container-page pt-16 pb-12 md:pt-28 md:pb-16">
        <Eyebrow>Lumière design system · v1</Eyebrow>
        <h1 className="display-cut mt-5 max-w-[14ch] text-display-l">A sunlit studio, written in code.</h1>
        <p className="mt-6 max-w-[52ch] text-lead text-stone">
          Light only. Warm ivory and sand, one soft blush accent, charcoal for text. Bodoni Moda for display, Hanken Grotesk for
          everything you read and tap. Motion that moves like film: slow, soft and purposeful.
        </p>
        <nav aria-label="Sections" className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-stone">
          {[
            ["colour", "Colour"],
            ["type", "Type"],
            ["space", "Space"],
            ["motion", "Motion"],
            ["components", "Components"],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center underline decoration-line underline-offset-4 hover:text-charcoal hover:decoration-charcoal">
              {label}
            </a>
          ))}
        </nav>
      </section>
      <Divider className="container-page" ornament />

      <Section id="colour" eyebrow="01 · Colour" title="Palette">
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
          {palette.map((c, i) => (
            <Reveal as="li" key={c.token} index={i % 5}>
              <div className="aspect-[4/5] rounded-[var(--radius-image)] border border-line" style={{ background: c.hex }} />
              <p className="mt-3 text-sm font-medium">{c.token}</p>
              <p className="text-[0.8125rem] text-stone tabular-nums">{c.hex} · {c.use}</p>
              <p className="mt-1 text-[0.75rem] text-stone tabular-nums">
                vs ivory {contrast(c.hex, "#FBF8F3").toFixed(1)}:1 · vs charcoal {contrast(c.hex, "#2B2523").toFixed(1)}:1
              </p>
            </Reveal>
          ))}
        </ul>
        <p className="mt-10 max-w-[60ch] text-sm text-stone">
          Text colours (charcoal, stone, brass-ink, blush-ink) all clear WCAG AA 4.5:1 on ivory, linen, sand and blush. Brass and
          champagne are decorative only; brass meets the 3:1 non-text minimum for focus rings and icons.
        </p>
      </Section>

      <div className="bg-linen">
        <Section id="type" eyebrow="02 · Typography" title="Type scale">
          <ul className="divide-y divide-line border-y border-line">
            {typeScale.map((t) => (
              <li key={t.name} className="grid gap-3 py-8 md:grid-cols-[12rem_1fr] md:items-baseline md:gap-10">
                <p className="text-[0.8125rem] text-stone">{t.name}</p>
                <p className={t.cls}>{t.sample}</p>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Section id="space" eyebrow="03 · Space" title="Rhythm & grid">
        <ul className="space-y-3">
          {spacing.map((s) => (
            <li key={s} className="flex items-center gap-6">
              <span className="w-12 text-right text-[0.8125rem] text-stone tabular-nums">{s}</span>
              <span className="h-3 rounded-full bg-champagne" style={{ width: s * 2 }} />
            </li>
          ))}
        </ul>
        <p className="mt-10 max-w-[60ch] text-sm text-stone">
          4px base. Sections breathe at 96px on phones and 160–200px on desktop. Twelve-column editorial grid, max 1440px,
          gutters 20 / 32 / 48px; overlapping compositions use columns 1–7 and 6–12.
        </p>
      </Section>

      <div className="bg-linen">
        <Section id="motion" eyebrow="04 · Motion" title="Moves like film">
          <dl className="grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
            {motionTokens.map(([name, value, use]) => (
              <div key={name} className="border-t border-line pt-4">
                <dt className="text-sm font-medium">{name}</dt>
                <dd className="text-[0.8125rem] text-stone tabular-nums">{value}</dd>
                <dd className="text-[0.8125rem] text-stone">{use}</dd>
              </div>
            ))}
          </dl>
          <MotionDemos />
        </Section>
      </div>

      <Section id="components" eyebrow="05 · Components" title="Building blocks">
        <ComponentDemos />
      </Section>
    </PageTransition>
  );
}

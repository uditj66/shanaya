import type { Metadata } from "next";
import Link from "next/link";
import { brand as brandParam } from "next/root-params";
import { BrandImage } from "@/components/brand/brand-image";
import { Faqs, JsonLd, PageIntro } from "@/components/brand/sections";
import { ClipReveal } from "@/components/motion/clip-reveal";
import { MaskLines } from "@/components/motion/mask-lines";
import { PageTransition } from "@/components/motion/page-transition";
import { Parallax } from "@/components/motion/parallax";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { getBrand, getCities, getMenu, getStudios } from "@/lib/brand/data";
import { brandHref } from "@/lib/brand/href";
import { breadcrumbLd, faqLd } from "@/lib/brand/seo";

export const metadata: Metadata = {
  title: "Our story",
  description: "Why Lumière exists: one standard of skin care across every studio, led by therapists who listen and physicians who lead every medical treatment.",
  alternates: { canonical: "/about" },
};

const PRINCIPLES = [
  ["One standard", "The same rituals, products and prices in every studio, so the facial you love in one city is the facial you find in the next."],
  ["People who listen", "Every visit starts with your skin, not a sales pitch. Therapists train for months before they treat a guest."],
  ["Physicians lead medicine", "Medi-facials such as PRP, microneedling and laser are performed only by our aesthetic physician, after a consultation."],
  ["Time and quiet", "Rooms designed around daylight, unhurried appointments and cleanup time between every guest."],
];

// ISR: brand story and FAQs are editable in the dashboard.
export default async function AboutPage() {
  const slug = await brandParam();
  const [brand, studios, cities, menu] = await Promise.all([getBrand(slug), getStudios(slug), getCities(slug), getMenu(slug)]);
  if (!brand) return null;

  return (
    <PageTransition>
      <JsonLd data={[breadcrumbLd(brand, [["Home", "/"], ["Our story", "/about"]]), faqLd(brand.faqs)]} />
      <PageIntro eyebrow="Our story" lines={["Great skin is", "built slowly."]} />

      <section className="container-page grid gap-12 pb-24 md:grid-cols-12 md:pb-36">
        <div className="md:col-span-7">
          <Parallax className="aspect-[4/3] rounded-[var(--radius-image)]" strength={0.08} zoom>
            <BrandImage id="studios.lounge" fill loading="eager" fetchPriority="high" sizes="(min-width: 768px) 58vw, 100vw" />
          </Parallax>
        </div>
        <div className="md:col-span-4 md:col-start-9 md:self-end">
          <Reveal>
            <p className="text-lead">{brand.story}</p>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="principles-title" className="bg-linen py-24 md:py-36">
        <div className="container-page">
          <MaskLines as="h2" id="principles-title" lines={["What we hold to."]} className="display-cut text-h1" />
          <ol className="mt-14 grid gap-x-12 gap-y-14 md:grid-cols-2">
            {PRINCIPLES.map(([t, d], i) => (
              <Reveal as="li" key={t} index={i % 2} className="grid grid-cols-[3.5rem_1fr] border-t border-line pt-6">
                <span className="display-cut text-h3 text-brass-ink tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="display-cut text-h3">{t}</h3>
                  <p className="mt-3 text-stone">{d}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="container-page grid gap-12 py-24 md:grid-cols-12 md:py-36">
        <div className="md:col-span-5">
          <ClipReveal className="aspect-[3/4]">
            <BrandImage id="rituals.products" fill sizes="(min-width: 768px) 40vw, 100vw" />
          </ClipReveal>
        </div>
        <div className="md:col-span-6 md:col-start-7 md:self-center">
          <dl className="grid grid-cols-3 gap-6">
            {[
              [studios.length, "studios"],
              [cities.length, "cities"],
              [menu.length, "rituals"],
            ].map(([n, l]) => (
              <div key={String(l)}>
                <dt className="sr-only">{l}</dt>
                <dd>
                  <span className="display-cut block text-display-l tabular-nums">{n}</span>
                  <span className="text-stone">{l}</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-10 text-lead text-stone">From {cities.slice(0, 4).map((c) => c.city).join(", ")} and beyond, every studio keeps the same promise.</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild><Link href={brandHref("/studios")}>Find a studio</Link></Button>
            <Button asChild variant="quiet"><Link href={brandHref("/careers")}>Join the team</Link></Button>
          </div>
        </div>
      </section>

      {brand.faqs.length > 0 && (
        <section aria-labelledby="faq-title" className="container-page grid gap-10 md:grid-cols-12">
          <h2 id="faq-title" className="display-cut text-h2 md:col-span-4">Questions, answered</h2>
          <Faqs items={brand.faqs} className="md:col-span-7 md:col-start-6" />
        </section>
      )}
    </PageTransition>
  );
}

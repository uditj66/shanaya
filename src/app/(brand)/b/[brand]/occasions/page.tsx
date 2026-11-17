import type { Metadata } from "next";
import Link from "next/link";
import { brand as brandParam } from "next/root-params";
import { BrandImage } from "@/components/brand/brand-image";
import { JsonLd, PageIntro } from "@/components/brand/sections";
import { PageTransition } from "@/components/motion/page-transition";
import { Parallax } from "@/components/motion/parallax";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/display";
import { getBrand, getPackages } from "@/lib/brand/data";
import { brandHref } from "@/lib/brand/href";
import { breadcrumbLd } from "@/lib/brand/seo";
import { formatDuration, formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Occasions & packages",
  description: "Bridal programmes, festive glow, honeymoon and self-care packages: curated Lumière rituals for the days you'll remember.",
  alternates: { canonical: "/occasions" },
};

// ISR: packages come from the cached menu.
export default async function OccasionsPage() {
  const slug = await brandParam();
  const [brand, packages] = await Promise.all([getBrand(slug), getPackages(slug)]);
  if (!brand) return null;

  return (
    <PageTransition>
      <JsonLd data={breadcrumbLd(brand, [["Home", "/"], ["Occasions", "/occasions"]])} />
      <PageIntro
        eyebrow="Occasions"
        lines={["For the days", "you'll remember."]}
        lead="Curated rituals for weddings, festivals, honeymoons and quiet weekends. Multi-visit programmes begin with a conversation, so we can plan around your date."
      >
        <nav aria-label="Packages" className="mt-10 flex flex-wrap gap-2">
          {packages.map((p) => (
            <a key={p.code} href={`#${p.slug}`} className="inline-flex min-h-10 items-center rounded-full border border-line px-4 text-[0.8125rem] text-stone hover:border-champagne hover:text-charcoal">
              {p.name}
            </a>
          ))}
        </nav>
      </PageIntro>

      <div className="container-page grid gap-24 md:gap-36">
        {packages.map((p, i) => (
          <article key={p.code} id={p.slug} aria-labelledby={`${p.slug}-title`} className="grid scroll-mt-32 items-center gap-10 md:grid-cols-12">
            <div className={i % 2 ? "md:col-span-6 md:col-start-7" : "md:col-span-6"}>
              <Parallax className="aspect-[4/5] rounded-[var(--radius-image)] md:aspect-[5/6]" strength={0.06}>
                <BrandImage id={p.image} fill sizes="(min-width: 768px) 50vw, 100vw" />
              </Parallax>
            </div>
            <Reveal className={i % 2 ? "md:col-span-5 md:col-start-1 md:row-start-1" : "md:col-span-5 md:col-start-8"}>
              <p className="eyebrow">{p.occasion}</p>
              <h2 id={`${p.slug}-title`} className="display-cut mt-4 text-h1">{p.name}</h2>
              <p className="mt-5 text-lead text-stone">{p.description}</p>
              <dl className="mt-8 grid grid-cols-3 gap-4 border-y border-line py-5 text-sm">
                <div>
                  <dt className="text-stone">Price</dt>
                  <dd className="display-cut mt-1 text-h3 tabular-nums">{formatPrice(p.price)}</dd>
                </div>
                <div>
                  <dt className="text-stone">Visits</dt>
                  <dd className="display-cut mt-1 text-h3">{p.visits}</dd>
                </div>
                <div>
                  <dt className="text-stone">{p.validityDays ? "Valid for" : "Time"}</dt>
                  <dd className="display-cut mt-1 text-h3">{p.validityDays ? `${p.validityDays} days` : p.minutes ? formatDuration(p.minutes) : "One visit"}</dd>
                </div>
              </dl>
              {p.includes.length > 0 && (
                <div className="mt-8">
                  <p className="eyebrow">Includes</p>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {p.includes.map((s) => (
                      <li key={s.slug}>
                        <Link href={brandHref(`/services/${s.slug}`)}>
                          <Badge className="min-h-9 hover:bg-sand">{s.name}</Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Button asChild size="lg" className="mt-10">
                <Link href={brandHref(`/book?service=${p.code}`)}>{p.consultationFirst ? "Plan this with us" : "Book this package"}</Link>
              </Button>
            </Reveal>
          </article>
        ))}
      </div>
    </PageTransition>
  );
}

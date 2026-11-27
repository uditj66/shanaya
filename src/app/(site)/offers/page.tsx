import type { Metadata } from "next";
import Link from "next/link";
import { BrandImage } from "@/components/brand/brand-image";
import { JsonLd, PageIntro, SampleBadge } from "@/components/brand/sections";
import { PageTransition } from "@/components/motion/page-transition";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { JoinMembership } from "@/components/brand/join-membership";
import { BRAND, getBrand, getMemberships, getMenu, getOffers, getStudios } from "@/lib/brand/data";
import { isTestMode, razorpayConfigured } from "@/lib/payments/razorpay";
import { siteHref } from "@/lib/brand/href";
import { breadcrumbLd } from "@/lib/brand/seo";
import { cn, formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Offers & membership",
  description: "Current Lumière offers and the Lumière Circle membership: quarterly rituals, priority booking and quiet privileges.",
  alternates: { canonical: "/offers" },
};

// ISR (hours): offers change more often than the rest of the site.
export default async function OffersPage() {
  const slug = BRAND;
  const [brand, offers, memberships, menu, studios] = await Promise.all([getBrand(slug), getOffers(slug), getMemberships(slug), getMenu(slug), getStudios(slug)]);
  const online = razorpayConfigured();
  const studioOptions = studios.map((s) => ({ value: s.slug, label: `${s.area}, ${s.city}` }));
  if (!brand) return null;
  const treatment = (code: string | null) => menu.find((m) => m.code === code);

  return (
    <PageTransition>
      <JsonLd data={breadcrumbLd(brand, [["Home", "/"], ["Offers", "/offers"]])} />
      <PageIntro eyebrow="Offers & membership" lines={["Small privileges,", "thoughtfully given."]} />

      <section aria-labelledby="offers-title" className="container-page">
        <h2 id="offers-title" className="sr-only">Current offers</h2>
        {offers.length ? (
          <ul className="grid gap-8 md:grid-cols-3">
            {offers.map((o, i) => {
              const t = treatment(o.service_code);
              return (
                <Reveal as="li" key={o.id} index={i} className="flex flex-col">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-image)] bg-sand">
                    {o.image && <BrandImage id={o.image} fill sizes="(min-width: 768px) 30vw, 100vw" />}
                  </div>
                  <div className="mt-5 flex items-center gap-2">
                    <h3 className="display-cut text-h3">{o.title}</h3>
                    <SampleBadge show={o.is_sample} />
                  </div>
                  <p className="mt-2 text-stone">{o.description}</p>
                  {o.terms && <p className="mt-3 text-[0.8125rem] text-stone">{o.terms}</p>}
                  {t && (
                    <Link href={siteHref(`/book?service=${t.code}`)} className="mt-5 inline-flex min-h-11 items-center gap-3 text-sm">
                      <span className="border-b border-charcoal/30 pb-0.5 hover:border-charcoal">Book {t.name}</span> <span aria-hidden="true">→</span>
                    </Link>
                  )}
                </Reveal>
              );
            })}
          </ul>
        ) : (
          <p className="text-lead text-stone">There are no special offers right now. Our prices are the same at every studio, every day.</p>
        )}
      </section>

      {memberships.length > 0 && (
        <section aria-labelledby="membership-title" className="mt-24 bg-linen py-20 md:mt-36 md:py-32">
          <div className="container-page">
            <p className="eyebrow">Membership</p>
            <h2 id="membership-title" className="display-cut mt-4 text-h1">The Lumière Circle</h2>
            <ul className="mt-12 grid gap-6 md:grid-cols-2">
              {memberships.map((m, i) => (
                <Reveal as="li" key={m.id} index={i} className={cn("flex flex-col rounded-2xl border p-8 md:p-12", m.highlight ? "border-charcoal bg-ivory shadow-lift" : "border-line bg-white/60")}>
                  <div className="flex items-center gap-3">
                    <h3 className="display-cut text-h2">{m.name}</h3>
                    <SampleBadge show={m.is_sample} />
                  </div>
                  <p className="mt-3 text-stone tabular-nums">
                    <span className="display-cut text-h3 text-charcoal">{formatPrice(m.price)}</span> a {m.period}
                  </p>
                  <ul className="mt-8 grid flex-1 gap-3">
                    {m.benefits.map((b) => (
                      <li key={b} className="flex gap-3">
                        <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rotate-45 bg-brass" />
                        {b}
                      </li>
                    ))}
                  </ul>
                  {online && brand ? (
                    <JoinMembership brand={slug} brandName={brand.name} tier={{ id: m.id, name: m.name, price: m.price, period: m.period }} studios={studioOptions} primary={m.highlight} testMode={isTestMode()} />
                  ) : (
                    <Button asChild variant={m.highlight ? "primary" : "quiet"} className="mt-10 self-start">
                      <Link href={siteHref("/contact")}>Ask about {m.name}</Link>
                    </Button>
                  )}
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      )}
    </PageTransition>
  );
}

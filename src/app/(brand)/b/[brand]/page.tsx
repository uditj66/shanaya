import type { Metadata } from "next";
import Link from "next/link";
import { brand as brandParam } from "next/root-params";
import { ArrowRight } from "lucide-react";
import { BrandImage } from "@/components/brand/brand-image";
import { SpecialistPortrait } from "@/components/brand/specialist-portrait";
import { HeroMedia } from "@/components/brand/hero-media";
import { JsonLd, SampleBadge, SectionHeader } from "@/components/brand/sections";
import { StudioFinder } from "@/components/brand/studio-finder";
import { Testimonials } from "@/components/brand/testimonials";
import { BeforeAfter } from "@/components/motion/before-after";
import { ClipReveal } from "@/components/motion/clip-reveal";
import { CursorPreview } from "@/components/motion/cursor-preview";
import { Magnetic } from "@/components/motion/magnetic";
import { MaskLines } from "@/components/motion/mask-lines";
import { PageTransition } from "@/components/motion/page-transition";
import { KenBurns, Parallax } from "@/components/motion/parallax";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/display";
import { getBrand, getCities, getLookbook, getMemberships, getMenu, getPackages, getPress, getStudios, getTeam, getTestimonials } from "@/lib/brand/data";
import { brandHref } from "@/lib/brand/href";
import { hoursRows } from "@/lib/brand/hours";
import { organizationLd, websiteLd } from "@/lib/brand/seo";
import { formatDuration, formatPrice } from "@/lib/utils";

export const metadata: Metadata = { alternates: { canonical: "/" } };

// ISR: everything on this page comes from cached data functions; dashboard edits refresh it via cache tags.
export default async function Home() {
  const slug = await brandParam();
  const [brand, menu, packages, studios, cities, team, testimonials, press, memberships, lookbook] = await Promise.all([
    getBrand(slug),
    getMenu(slug),
    getPackages(slug),
    getStudios(slug),
    getCities(slug),
    getTeam(slug),
    getTestimonials(slug),
    getPress(slug),
    getMemberships(slug),
    getLookbook(slug),
  ]);
  if (!brand) return null;

  const featured = menu.filter((t) => t.featured).sort((a, b) => a.sort - b.sort);
  const occasions = ["PKG001", "PKG003", "PKG004"].map((c) => packages.find((p) => p.code === c)).filter((p) => !!p);
  const flagship = studios.find((s) => s.isFlagship) ?? studios[0];
  const specialists = team.filter((p) => p.studioSlug === flagship?.slug).slice(0, 6);
  const pair = lookbook.find((l) => l.before_image && l.after_image);
  const menuName = (code: string | null) => menu.find((m) => m.code === code)?.name ?? packages.find((p) => p.code === code)?.name ?? null;
  const fromPrice = Math.min(...menu.filter((m) => m.categorySlug === "facials").map((m) => m.price));

  return (
    <PageTransition>
      <JsonLd data={[organizationLd(brand, studios.length), websiteLd(brand)]} />

      {/* 1 ── Hero ─────────────────────────────────────────── */}
      <section aria-labelledby="hero-title" className="@container relative">
        <div className="container-page grid gap-10 pt-10 pb-16 md:min-h-[calc(100dvh-5rem)] md:grid-cols-12 md:items-center md:gap-0 md:py-12">
          <div className="relative z-10 md:col-span-6 md:pr-10 lg:col-span-5">
            <p className="eyebrow">
              {brand.name} · {studios.length} studios · {cities.length} cities
            </p>
            <MaskLines as="h1" id="hero-title" trigger="mount" lines={["Skin, in its", "finest light."]} className="display-cut mt-6 text-[clamp(3.25rem,1.2rem+6.4vw,6.75rem)] leading-[0.95] tracking-[-0.02em] whitespace-nowrap md:text-[clamp(3.25rem,0.5rem+5.6vw,6.75rem)]" />
            <Reveal delay={0.5}>
              <p className="mt-8 max-w-[38ch] text-lead text-stone">
                Unhurried facials, physician-led skin and quiet spa rituals, with the same care in every studio from Bandra to Park Street.
              </p>
            </Reveal>
            <Reveal delay={0.65}>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Magnetic>
                  <Button asChild size="lg">
                    <Link href={brandHref("/book")}>
                      Book a ritual <ArrowRight strokeWidth={1.5} />
                    </Link>
                  </Button>
                </Magnetic>
                <Button asChild size="lg" variant="quiet">
                  <Link href={brandHref("/studios")}>Find your studio</Link>
                </Button>
              </div>
            </Reveal>
          </div>
          <div className="relative md:col-span-6 md:-mr-[max(1.25rem,calc((100cqw-90rem)/2+3rem))] lg:col-span-7">
            {/* To use a film, drop a muted loop (under 5 MB) at public/videos/hero.mp4 and pass src="/videos/hero.mp4". */}
            <HeroMedia src={null} className="aspect-[4/5] rounded-[var(--radius-image)] md:aspect-auto md:h-[calc(100dvh-8rem)] md:rounded-r-none">
              <KenBurns className="absolute inset-0">
                <BrandImage id="hero.treatment-room" fill loading="eager" fetchPriority="high" sizes="(min-width: 1024px) 58vw, (min-width: 768px) 50vw, 100vw" />
              </KenBurns>
            </HeroMedia>
            <div aria-hidden="true" className="absolute -bottom-6 left-6 hidden h-28 w-px bg-brass md:block" />
          </div>
        </div>
      </section>

      {/* 2 ── Brand story ──────────────────────────────────── */}
      <section aria-labelledby="story-title" className="container-page grid gap-12 py-24 md:grid-cols-12 md:py-40">
        <div className="md:col-span-5 md:col-start-1">
          <ClipReveal className="aspect-[3/4]">
            <BrandImage id="rituals.hands-facial" fill sizes="(min-width: 768px) 38vw, 100vw" />
          </ClipReveal>
        </div>
        <div className="md:col-span-6 md:col-start-7 md:self-center">
          <p className="eyebrow">The Lumière standard</p>
          <MaskLines as="h2" id="story-title" lines={["Great skin is", "built slowly,", "by people who listen."]} className="display-cut mt-5 text-h1" />
          <Reveal delay={0.15}>
            <p className="mt-8 max-w-[50ch] text-lead text-stone">{brand.story.split(". ").slice(0, 2).join(". ")}.</p>
          </Reveal>
          <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-line pt-8">
            {[
              [String(studios.length), "studios"],
              [String(cities.length), "cities"],
              [String(menu.length), "rituals"],
            ].map(([n, l], i) => (
              <Reveal key={l} index={i}>
                <dt className="sr-only">{l}</dt>
                <dd>
                  <span className="display-cut block text-h1 tabular-nums">{n}</span>
                  <span className="text-sm text-stone">{l}</span>
                </dd>
              </Reveal>
            ))}
          </dl>
          <Reveal delay={0.2}>
            <Link href={brandHref("/about")} className="mt-10 inline-flex min-h-11 items-center gap-3 text-sm tracking-[0.04em]">
              <span className="border-b border-charcoal/30 pb-0.5 hover:border-charcoal">Read our story</span> <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* 3 ── Signature rituals ────────────────────────────── */}
      <section aria-labelledby="rituals-title" className="bg-linen py-24 md:py-40">
        <div className="container-page grid gap-12 md:grid-cols-12">
          <div className="md:col-span-4">
            <SectionHeader
              id="rituals-title"
              eyebrow="Signature rituals"
              title="The treatments our guests return for."
              lead={`Facials from ${formatPrice(fromPrice)}. Same menu, same price, every studio.`}
              link={{ href: "/services", label: "View all treatments" }}
            />
          </div>
          <div className="hidden md:col-span-8 md:block">
            <CursorPreview
              items={featured.map((t) => ({
                key: t.code,
                href: brandHref(`/services/${t.slug}`),
                eyebrow: t.categoryLabel,
                title: t.name,
                meta: `from ${formatPrice(t.price)} · ${formatDuration(t.minutes)}`,
                media: <BrandImage id={t.image} fill sizes="240px" alt="" />,
              }))}
            />
          </div>
        </div>
        {/* Phones: a horizontal, snapping carousel of image cards (pure CSS, no JS) */}
        <ul className="mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 px-5 pb-4 [scrollbar-width:none] md:hidden" aria-label="Signature rituals">
          {featured.map((t) => (
            <li key={t.code} className="w-[78vw] max-w-80 shrink-0 snap-start">
              <Link href={brandHref(`/services/${t.slug}`)} className="block">
                <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-image)] bg-sand">
                  <BrandImage id={t.image} fill sizes="78vw" alt="" />
                </div>
                <p className="eyebrow mt-4">{t.categoryLabel}</p>
                <p className="display-cut mt-1 text-h3">{t.name}</p>
                <Price className="mt-1" amount={t.price} from minutes={t.minutes} />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* 4 ── Results ──────────────────────────────────────── */}
      {pair ? (
        <section aria-labelledby="results-title" className="container-page grid gap-12 py-24 md:grid-cols-12 md:py-40">
          <div className="md:col-span-4">
            <SectionHeader id="results-title" eyebrow="Results" title={pair.title} lead={pair.caption} link={{ href: "/lookbook", label: "See the lookbook" }} />
            <SampleBadge show={pair.is_sample} className="mt-4" />
          </div>
          <div className="md:col-span-8">
            <BeforeAfter
              className="aspect-[4/3]"
              label={`Compare before and after: ${pair.title}`}
              before={<BrandImage id={pair.before_image!} fill sizes="(min-width: 768px) 60vw, 100vw" />}
              after={<BrandImage id={pair.after_image!} fill sizes="(min-width: 768px) 60vw, 100vw" />}
            />
          </div>
        </section>
      ) : lookbook.length ? (
        <section aria-labelledby="results-title" className="container-page py-24 md:py-40">
          <SectionHeader id="results-title" eyebrow="Results" title="Skin, hair and hands, after." link={{ href: "/lookbook", label: "See the lookbook" }} />
          <ul className="mt-14 grid grid-cols-2 gap-4 md:grid-cols-12 md:gap-6">
            {lookbook.slice(0, 3).map((l, i) => (
              <Reveal as="li" key={l.id} index={i} className={i === 0 ? "col-span-2 md:col-span-6" : "md:col-span-3 md:mt-24"}>
                <div className={`relative overflow-hidden rounded-[var(--radius-image)] bg-sand ${i === 0 ? "aspect-[4/3]" : "aspect-[3/4]"}`}>
                  <BrandImage id={l.image} fill sizes={i === 0 ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 768px) 25vw, 50vw"} />
                </div>
                <p className="mt-3 flex items-center gap-2 text-sm text-stone">
                  {l.title} <SampleBadge show={l.is_sample} />
                </p>
              </Reveal>
            ))}
          </ul>
        </section>
      ) : null}

      {/* 5 ── Occasions ────────────────────────────────────── */}
      {occasions.length > 0 && (
        <section aria-labelledby="occasions-title" className="container-page py-24 md:py-32">
          <SectionHeader id="occasions-title" eyebrow="Occasions" title="For the days you'll remember." link={{ href: "/occasions", label: "All occasion packages" }} />
          <div className="mt-16 grid gap-20 md:gap-32">
            {occasions.map((p, i) => (
              <article key={p.code} className="grid items-center gap-8 md:grid-cols-12">
                <div className={i % 2 ? "md:col-span-7 md:col-start-6 md:row-start-1" : "md:col-span-7"}>
                  <Parallax className="aspect-[5/4] rounded-[var(--radius-image)]" strength={0.06} zoom>
                    <BrandImage id={p.image} fill sizes="(min-width: 768px) 58vw, 100vw" />
                  </Parallax>
                </div>
                <Reveal className={`relative z-10 bg-ivory md:row-start-1 md:p-10 ${i % 2 ? "md:col-span-5 md:col-start-1" : "md:col-span-5 md:col-start-8 md:-ml-24"}`}>
                  <p className="eyebrow">{p.occasion}</p>
                  <h3 className="display-cut mt-3 text-h2">{p.name}</h3>
                  <p className="mt-4 text-stone">{p.description}</p>
                  <p className="mt-5 text-sm text-stone tabular-nums">
                    <span className="font-medium text-charcoal">{formatPrice(p.price)}</span>
                    <span aria-hidden="true" className="mx-2 text-champagne">·</span>
                    {p.visits > 1 ? `${p.visits} visits` : "One visit"}
                  </p>
                  <Link href={brandHref(`/occasions#${p.slug}`)} className="mt-6 inline-flex min-h-11 items-center gap-3 text-sm">
                    <span className="border-b border-charcoal/30 pb-0.5 hover:border-charcoal">Discover {p.name}</span> <span aria-hidden="true">→</span>
                  </Link>
                </Reveal>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* 6 ── Studios ──────────────────────────────────────── */}
      <section aria-labelledby="studios-title" className="bg-linen py-24 md:py-40">
        <div className="container-page">
          <SectionHeader id="studios-title" eyebrow="Studios" title="Never far from a quiet hour." lead={`${studios.length} studios in ${cities.length} cities, each designed around daylight.`} />
          <div className="mt-14">
            <StudioFinder
              cities={cities.map((c) => c.city)}
              studios={studios.map((s) => ({
                slug: s.slug,
                city: s.city,
                area: s.area,
                address: s.address,
                hoursLine: hoursRows(s.hours).map((r) => `${r.days} ${r.hours}`).join(" · "),
                heroImage: s.heroImage,
                lat: s.lat,
                lng: s.lng,
              }))}
            />
          </div>
        </div>
      </section>

      {/* 7 ── Specialists ──────────────────────────────────── */}
      {specialists.length > 0 && (
        <section aria-labelledby="team-title" className="container-page py-24 md:py-40">
          <SectionHeader id="team-title" eyebrow="The specialists" title="Trained for months before they meet you." link={{ href: "/team", label: "Meet the specialists" }} />
          <ul className="mt-14 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-8 lg:grid-cols-6">
            {specialists.map((p, i) => (
              <Reveal as="li" key={p.id} index={i} className={i % 2 ? "lg:mt-16" : ""}>
                <Link href={brandHref(`/studios/${p.studioSlug}/team/${p.slug}`)} className="group block">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-[var(--radius-image)] bg-sand">
                    <SpecialistPortrait name={p.name} title={p.title} portrait={p.portrait} sizes="(min-width: 1024px) 16vw, (min-width: 768px) 30vw, 50vw" className="transition-transform duration-[1.2s] ease-[var(--ease-out-soft)] group-hover:scale-[1.04]" />
                  </div>
                  <p className="display-cut mt-4 text-h3">{p.name}</p>
                  <p className="text-sm text-stone">{p.title}</p>
                </Link>
              </Reveal>
            ))}
          </ul>
        </section>
      )}

      {/* 8 ── Testimonials ─────────────────────────────────── */}
      {testimonials.length > 0 && (
        <section aria-label="What guests say" className="border-y border-line py-24 md:py-36">
          <div className="container-page">
            <p className="eyebrow text-center">In their words</p>
            <div className="mt-10">
              <Testimonials items={testimonials.map((t) => ({ ...t, treatment: menuName(t.serviceCode) }))} />
            </div>
          </div>
        </section>
      )}

      {/* 9 ── Press ────────────────────────────────────────── */}
      {press.length > 0 && (
        <section aria-labelledby="press-title" className="container-page py-20 md:py-28">
          <h2 id="press-title" className="eyebrow text-center">Recognition</h2>
          <ul className="mt-10 grid gap-8 text-center sm:grid-cols-2 lg:grid-cols-4">
            {press.map((p, i) => (
              <Reveal as="li" key={p.id} index={i} className="grid gap-2">
                <p className="display-cut text-[1.375rem] text-stone">{p.publication}</p>
                <p className="text-[0.8125rem] text-stone">{p.headline}</p>
                <SampleBadge show={p.is_sample} className="justify-self-center" />
              </Reveal>
            ))}
          </ul>
        </section>
      )}

      {/* 10 ── Membership & gift cards ─────────────────────── */}
      <section aria-label="Membership and gift cards" className="container-page grid gap-6 py-12 md:grid-cols-2 md:py-20">
        <Reveal className="flex flex-col justify-between rounded-2xl border border-line bg-white/60 p-8 md:p-12">
          <div>
            <p className="eyebrow">Membership</p>
            <h2 className="display-cut mt-4 text-h2">{memberships[0]?.name ?? "The Lumière Circle"}</h2>
            {memberships.length > 0 ? (
              <ul className="mt-6 grid gap-2 text-stone">
                {memberships[0].benefits.slice(0, 4).map((b) => (
                  <li key={b} className="flex gap-3">
                    <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rotate-45 bg-brass" />
                    {b}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-stone">Quarterly rituals, priority booking and quiet privileges at every studio.</p>
            )}
            <SampleBadge show={!!memberships[0]?.is_sample} className="mt-4" />
          </div>
          <Button asChild variant="quiet" className="mt-10 self-start">
            <Link href={brandHref("/offers")}>Explore membership</Link>
          </Button>
        </Reveal>
        <Reveal index={1} className="relative isolate overflow-hidden rounded-2xl bg-sand p-8 md:p-12">
          <BrandImage id="gift.card" fill sizes="(min-width: 768px) 45vw, 100vw" className="-z-10 opacity-90" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ivory via-ivory/70 to-transparent" />
          <div className="flex h-full min-h-72 flex-col justify-end">
            <p className="eyebrow">Gift cards</p>
            <h2 className="display-cut mt-4 text-h2">Give someone an hour of quiet.</h2>
            <Button asChild className="mt-8 self-start">
              <Link href={brandHref("/gift-cards")}>Send a gift</Link>
            </Button>
          </div>
        </Reveal>
      </section>

      {/* 11 ── Booking CTA ─────────────────────────────────── */}
      <section aria-labelledby="cta-title" className="container-page pt-12 md:pt-20">
        <div className="relative isolate overflow-hidden rounded-2xl">
          <Parallax className="absolute inset-0 -z-10" strength={0.08}>
            <BrandImage id="cta.closing" fill sizes="100vw" />
          </Parallax>
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ivory/95 via-ivory/75 to-ivory/10" />
          <div className="grid min-h-[28rem] content-center p-8 md:min-h-[34rem] md:p-16">
            <p className="eyebrow">Book</p>
            <MaskLines as="h2" id="cta-title" lines={["Your hour of quiet", "awaits."]} className="display-cut mt-4 text-display-l" />
            <p className="mt-6 max-w-[40ch] text-stone">Choose your ritual, your studio and your time. It takes less than a minute.</p>
            <Magnetic>
              <Button asChild size="lg" className="mt-8">
                <Link href={brandHref("/book")}>
                  Book now <ArrowRight strokeWidth={1.5} />
                </Link>
              </Button>
            </Magnetic>
          </div>
        </div>
      </section>
    </PageTransition>
  );
}

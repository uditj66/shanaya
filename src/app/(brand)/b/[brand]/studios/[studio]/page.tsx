import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { brand as brandParam } from "next/root-params";
import { ArrowRight } from "lucide-react";
import { BrandImage } from "@/components/brand/brand-image";
import { ConciergePage } from "@/components/concierge/page-context";
import { SpecialistPortrait } from "@/components/brand/specialist-portrait";
import { StudioMap } from "@/components/brand/studio-map";
import { Breadcrumbs, JsonLd } from "@/components/brand/sections";
import { ClipReveal } from "@/components/motion/clip-reveal";
import { PageTransition } from "@/components/motion/page-transition";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/display";
import { getBrand, getMenu, getStudio, getStudios, getTeam, type Studio } from "@/lib/brand/data";
import { brandHref } from "@/lib/brand/href";
import { hoursRows, openState } from "@/lib/brand/hours";
import { breadcrumbLd, studioLd } from "@/lib/brand/seo";

// SSG: all studios prerendered (ISR via cache tags); the "open now" badge streams at request time.
export async function generateStaticParams() {
  return (await getStudios(await brandParam())).map((s) => ({ studio: s.slug }));
}

export async function generateMetadata({ params }: PageProps<"/b/[brand]/studios/[studio]">): Promise<Metadata> {
  const s = await getStudio(await brandParam(), (await params).studio);
  if (!s) return {};
  return {
    title: `${s.area}, ${s.city}`,
    description: `Lumière ${s.area}, ${s.city}: luxury facials, medi-facials, spa, hair and nails. Opening hours, team and online booking.`,
    alternates: { canonical: `/studios/${s.slug}` },
  };
}

export default function StudioPage({ params }: PageProps<"/b/[brand]/studios/[studio]">) {
  return (
    <PageTransition>
      <Suspense fallback={<div className="container-page py-16" aria-busy="true"><Skeleton className="h-[60vh]" /></div>}>
        <StudioView params={params} />
      </Suspense>
    </PageTransition>
  );
}

async function StudioView({ params }: Pick<PageProps<"/b/[brand]/studios/[studio]">, "params">) {
  const slug = await brandParam();
  const { studio: studioSlug } = await params;
  const [brand, s, team, menu] = await Promise.all([getBrand(slug), getStudio(slug, studioSlug), getTeam(slug), getMenu(slug)]);
  if (!brand || !s) notFound();
  const people = team.filter((p) => p.studioSlug === s.slug);
  const featured = menu.filter((m) => m.featured).slice(0, 4);

  return (
    <>
      <JsonLd data={[studioLd(brand, s), breadcrumbLd(brand, [["Home", "/"], ["Studios", "/studios"], [s.area, `/studios/${s.slug}`]])]} />
      <ConciergePage kind="studio" studio={s.slug} name={s.area} />
      <Breadcrumbs items={[["Studios", "/studios"], [s.area, null]]} />

      <section className="container-page grid gap-10 pt-8 pb-16 md:grid-cols-12 md:pt-12 md:pb-24">
        <div className="md:col-span-5 md:self-end">
          <p className="eyebrow">{s.city}{s.isFlagship ? " · Flagship" : ""}</p>
          <h1 className="display-cut mt-4 text-display-l">{s.area}</h1>
          <Suspense fallback={<span className="mt-6 block h-8" />}>
            <OpenNow studio={s} />
          </Suspense>
          {s.address ? (
            <address className="mt-6 not-italic text-lead text-stone">{s.address}</address>
          ) : (
            <p className="mt-6 text-stone">Address details coming soon.</p>
          )}
          {s.phone && (
            <a href={`tel:${s.phone.replace(/\s/g, "")}`} className="mt-2 inline-flex min-h-11 items-center tabular-nums underline decoration-line underline-offset-4 hover:decoration-charcoal">
              {s.phone}
            </a>
          )}
          {s.isPlaceholder && <Badge tone="brass" className="mt-4 block w-fit">Sample address</Badge>}
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href={brandHref(`/book?studio=${s.slug}`)}>
                Book at {s.area} <ArrowRight strokeWidth={1.5} />
              </Link>
            </Button>
            {s.lat != null && s.lng != null && (
              <Button asChild size="lg" variant="quiet">
                <a href={`https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`} target="_blank" rel="noopener">Directions</a>
              </Button>
            )}
          </div>
        </div>
        <div className="md:col-span-7">
          <ClipReveal immediate className="aspect-[4/3]">
            <BrandImage id={s.heroImage} fill loading="eager" fetchPriority="high" sizes="(min-width: 768px) 58vw, 100vw" alt={`Inside the ${s.area} studio`} />
          </ClipReveal>
        </div>
      </section>

      {/* Gallery: horizontal strip */}
      <section aria-label="Gallery" className="pb-20 md:pb-32">
        <ul className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 [scrollbar-width:none] md:px-8 xl:px-12">
          {s.gallery.map((img, i) => (
            <li key={img} className="w-[70vw] max-w-[28rem] shrink-0 snap-start md:w-[32vw]">
              <Reveal index={i % 4} className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-image)] bg-sand">
                <BrandImage id={img} fill sizes="(min-width: 768px) 32vw, 70vw" />
              </Reveal>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Hours and location" className="bg-linen py-20 md:py-28">
        <div className="container-page grid gap-12 md:grid-cols-12">
          <div className="md:col-span-4">
            <h2 className="eyebrow">Opening hours</h2>
            <dl className="mt-6 divide-y divide-line border-y border-line">
              {hoursRows(s.hours).map((r) => (
                <div key={r.days} className="flex justify-between py-3">
                  <dt>{r.days}</dt>
                  <dd className="tabular-nums text-stone">{r.hours}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 text-sm text-stone">Please arrive 10 minutes early. Free cancellation up to 4 hours before.</p>
          </div>
          <div className="md:col-span-7 md:col-start-6">
            <h2 className="sr-only">Map</h2>
            {s.lat != null && s.lng != null ? (
              <StudioMap lat={s.lat} lng={s.lng} label={`Lumière ${s.area}`} />
            ) : (
              <div className="grid aspect-[16/10] place-items-center rounded-[var(--radius-image)] bg-sand text-stone">Map coming soon</div>
            )}
          </div>
        </div>
      </section>

      {people.length > 0 && (
        <section aria-labelledby="team-title" className="container-page py-20 md:py-32">
          <h2 id="team-title" className="display-cut text-h1">The {s.area} team</h2>
          <ul className="mt-12 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 lg:grid-cols-7">
            {people.map((p, i) => (
              <Reveal as="li" key={p.id} index={i}>
                <Link href={brandHref(`/studios/${s.slug}/team/${p.slug}`)} className="group block">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-[var(--radius-image)] bg-sand">
                    <SpecialistPortrait name={p.name} title={p.title} portrait={p.portrait} sizes="(min-width: 1024px) 14vw, (min-width: 768px) 24vw, 50vw" className="transition-transform duration-[1.2s] ease-[var(--ease-out-soft)] group-hover:scale-[1.04]" />
                  </div>
                  <p className="display-cut mt-3 text-[1.25rem]">{p.name}</p>
                  <p className="text-[0.8125rem] text-stone">{p.title}</p>
                </Link>
              </Reveal>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="popular-title" className="container-page pb-8">
        <h2 id="popular-title" className="display-cut text-h2">Popular at {s.area}</h2>
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {featured.map((t) => (
            <li key={t.code} className="flex flex-wrap items-center justify-between gap-4 py-5">
              <Link href={brandHref(`/services/${t.slug}`)} className="display-cut text-h3 hover:text-brass-ink">{t.name}</Link>
              <Link href={brandHref(`/book?service=${t.code}&studio=${s.slug}`)} className="inline-flex min-h-11 items-center rounded-full border border-charcoal/25 px-5 text-sm hover:border-charcoal">
                Book
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/** Request-time (SSR) part of an otherwise static page: needs the current time. */
async function OpenNow({ studio }: { studio: Studio }) {
  await connection();
  const state = openState(studio.hours, studio.timezone, new Date());
  return (
    <p className="mt-6 inline-flex items-center gap-2 text-sm">
      <span aria-hidden="true" className={`size-2 rounded-full ${state.open ? "bg-success" : "bg-champagne"}`} />
      {state.text}
    </p>
  );
}

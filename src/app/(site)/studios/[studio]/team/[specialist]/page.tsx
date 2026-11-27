import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Breadcrumbs, JsonLd } from "@/components/brand/sections";
import { SpecialistPortrait } from "@/components/brand/specialist-portrait";
import { BrandImage } from "@/components/brand/brand-image";
import { ClipReveal } from "@/components/motion/clip-reveal";
import { PageTransition } from "@/components/motion/page-transition";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/display";
import { BRAND, getBrand, getSpecialist, getStudios, getTeam } from "@/lib/brand/data";
import { siteHref } from "@/lib/brand/href";
import { breadcrumbLd } from "@/lib/brand/seo";

type P = PageProps<"/studios/[studio]/team/[specialist]">;

// SSG for the flagship team (the rest render on first visit and are then cached: ISR).
export async function generateStaticParams() {
  const slug = BRAND;
  const [team, studios] = await Promise.all([getTeam(slug), getStudios(slug)]);
  const flagship = studios.find((s) => s.isFlagship) ?? studios[0];
  return team.filter((p) => p.studioSlug === flagship?.slug).map((p) => ({ studio: p.studioSlug, specialist: p.slug }));
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { studio, specialist } = await params;
  const p = await getSpecialist(BRAND, studio, specialist);
  if (!p) return {};
  return {
    title: `${p.name}, ${p.title} · ${p.studioArea}`,
    description: `${p.bio} Book with ${p.name} at Lumière ${p.studioArea}, ${p.city}.`,
    alternates: { canonical: `/studios/${p.studioSlug}/team/${p.slug}` },
  };
}

export default function SpecialistPage({ params }: P) {
  return (
    <PageTransition>
      <Suspense fallback={<div className="container-page py-16" aria-busy="true"><Skeleton className="h-[60vh]" /></div>}>
        <Profile params={params} />
      </Suspense>
    </PageTransition>
  );
}

async function Profile({ params }: Pick<P, "params">) {
  const slug = BRAND;
  const { studio, specialist } = await params;
  const [brand, p] = await Promise.all([getBrand(slug), getSpecialist(slug, studio, specialist)]);
  if (!brand || !p) notFound();
  const path = `/studios/${p.studioSlug}/team/${p.slug}`;

  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd(brand, [["Home", "/"], ["Studios", "/studios"], [p.studioArea, `/studios/${p.studioSlug}`], [p.name, path]]),
          {
            "@context": "https://schema.org",
            "@type": "Person",
            name: p.name,
            jobTitle: p.title,
            worksFor: { "@id": new URL(`/studios/${p.studioSlug}#studio`, brand.siteUrl).toString() },
            knowsAbout: p.specialties,
            knowsLanguage: p.languages,
          },
        ]}
      />
      <Breadcrumbs items={[["Studios", "/studios"], [p.studioArea, `/studios/${p.studioSlug}`], [p.name, null]]} />
      <section className="container-page grid gap-10 pt-8 pb-20 md:grid-cols-12 md:gap-12 md:pt-12 md:pb-32">
        <div className="md:col-span-5">
          <ClipReveal immediate className="aspect-[3/4]">
            <SpecialistPortrait name={p.name} title={p.title} portrait={p.portrait} sizes="(min-width: 768px) 40vw, 100vw" />
          </ClipReveal>
        </div>
        <div className="md:col-span-6 md:col-start-7 md:self-center">
          <p className="eyebrow">{p.title} · {p.studioArea}</p>
          <h1 className="display-cut mt-4 text-display-l">{p.name}</h1>
          <p className="mt-6 max-w-[52ch] text-lead text-stone">{p.bio}</p>
          <dl className="mt-10 grid gap-6 border-t border-line pt-8 sm:grid-cols-3">
            {p.years != null && (
              <div>
                <dt className="text-[0.8125rem] text-stone">Experience</dt>
                <dd className="display-cut mt-1 text-h3">{p.years} years</dd>
              </div>
            )}
            <div className="sm:col-span-2">
              <dt className="text-[0.8125rem] text-stone">Speaks</dt>
              <dd className="mt-2 text-lead">{p.languages.join(", ")}</dd>
            </div>
          </dl>
          {p.specialties.length > 0 && (
            <div className="mt-8">
              <p className="eyebrow">Specialties</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {p.specialties.map((s) => (
                  <li key={s}><Badge>{s}</Badge></li>
                ))}
              </ul>
            </div>
          )}
          <Button asChild size="lg" className="mt-10">
            <Link href={siteHref(`/book?studio=${p.studioSlug}&specialist=${p.slug}`)}>
              Book with {p.name.replace(/^Dr\.?\s+/, "Dr ").split(" ").slice(0, 2).join(" ")} <ArrowRight strokeWidth={1.5} />
            </Link>
          </Button>
        </div>
      </section>

      {p.portfolio.length > 0 && (
        <section aria-labelledby="portfolio-title" className="container-page">
          <h2 id="portfolio-title" className="display-cut text-h2">Portfolio</h2>
          <ul className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
            {p.portfolio.map((img, i) => (
              <Reveal as="li" key={img} index={i} className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-image)] bg-sand">
                <BrandImage id={img} fill sizes="(min-width: 768px) 25vw, 50vw" />
              </Reveal>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

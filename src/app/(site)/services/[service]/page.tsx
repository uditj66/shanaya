import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { BrandImage } from "@/components/brand/brand-image";
import { ConciergePage } from "@/components/concierge/page-context";
import { Breadcrumbs, Faqs, JsonLd } from "@/components/brand/sections";
import { ClipReveal } from "@/components/motion/clip-reveal";
import { Magnetic } from "@/components/motion/magnetic";
import { PageTransition } from "@/components/motion/page-transition";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Badge, Divider, Skeleton } from "@/components/ui/display";
import { BRAND, getBrand, getMenu, getStudios, getTreatment } from "@/lib/brand/data";
import { siteHref } from "@/lib/brand/href";
import { breadcrumbLd, faqLd, serviceLd } from "@/lib/brand/seo";
import { formatDuration, formatPrice } from "@/lib/utils";

// SSG: every treatment page is prerendered at build; new ones render on first visit, then stay cached (ISR).
export async function generateStaticParams() {
  return (await getMenu(BRAND)).map((t) => ({ service: t.slug }));
}

export async function generateMetadata({ params }: PageProps<"/services/[service]">): Promise<Metadata> {
  const t = await getTreatment(BRAND, (await params).service);
  if (!t) return {};
  return {
    title: `${t.name} · ${formatPrice(t.price)}`,
    description: `${t.headline} ${t.description} ${formatDuration(t.minutes)}, ${formatPrice(t.price)} at every Lumière studio.`,
    alternates: { canonical: `/services/${t.slug}` },
    openGraph: { title: t.name, description: t.headline },
  };
}

export default function TreatmentPage({ params }: PageProps<"/services/[service]">) {
  return (
    <PageTransition>
      <Suspense fallback={<TreatmentSkeleton />}>
        <Treatment params={params} />
      </Suspense>
    </PageTransition>
  );
}

async function Treatment({ params }: Pick<PageProps<"/services/[service]">, "params">) {
  const slug = BRAND;
  const { service } = await params;
  const [brand, t, menu, studios] = await Promise.all([getBrand(slug), getTreatment(slug, service), getMenu(slug), getStudios(slug)]);
  if (!brand || !t) notFound();
  const related = menu.filter((m) => m.categorySlug === t.categorySlug && m.code !== t.code).slice(0, 3);
  const faqs = brand.faqs.filter((f) => (t.consultationFirst ? true : !/medi-facial/i.test(f.q))).slice(0, 4);
  const book = siteHref(`/book?service=${t.code}`);

  return (
    <>
      <JsonLd data={[serviceLd(brand, t), breadcrumbLd(brand, [["Home", "/"], ["Treatments", "/services"], [t.name, `/services/${t.slug}`]]), faqLd(faqs)]} />
      <ConciergePage kind="service" service={t.slug} name={t.name} />
      <Breadcrumbs items={[["Treatments", "/services"], [t.categoryLabel, `/services?category=${t.categorySlug}`], [t.name, null]]} />

      <section className="container-page grid gap-10 pt-8 pb-20 md:grid-cols-12 md:gap-12 md:pt-12 md:pb-32">
        <div className="md:col-span-6 md:col-start-1 lg:col-span-5">
          <ClipReveal immediate className="aspect-[4/5]">
            <BrandImage id={t.image} fill loading="eager" fetchPriority="high" sizes="(min-width: 1024px) 40vw, (min-width: 768px) 50vw, 100vw" />
          </ClipReveal>
        </div>
        <div className="md:col-span-6 md:self-center lg:col-span-6 lg:col-start-7">
          <p className="eyebrow">{t.categoryLabel}</p>
          <h1 className="display-cut mt-4 text-display-l">{t.name}</h1>
          <p className="mt-5 text-lead text-stone">{t.headline}</p>
          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4 border-y border-line py-5">
            <div>
              <dt className="text-[0.8125rem] text-stone">Price</dt>
              <dd className="display-cut text-h3 tabular-nums">{formatPrice(t.price)}</dd>
            </div>
            <div>
              <dt className="text-[0.8125rem] text-stone">Time</dt>
              <dd className="display-cut text-h3">{formatDuration(t.minutes)}</dd>
            </div>
            <div>
              <dt className="text-[0.8125rem] text-stone">Available at</dt>
              <dd className="display-cut text-h3">{studios.length} studios</dd>
            </div>
          </dl>
          <p className="mt-8 max-w-[56ch]">{t.description}</p>
          {t.consultationFirst && (
            <p className="mt-5 flex items-start gap-3 rounded-xl bg-blush/50 p-4 text-sm text-blush-ink">
              <Badge tone="accent">Consultation first</Badge>
              Our aesthetic physician meets you before this treatment. Request a consultation and we will call to plan it.
            </p>
          )}
          <div className="mt-10 flex flex-wrap gap-4">
            <Magnetic>
              <Button asChild size="lg">
                <Link href={book}>
                  {t.consultationFirst ? "Request a consultation" : "Book this ritual"} <ArrowRight strokeWidth={1.5} />
                </Link>
              </Button>
            </Magnetic>
            <Button asChild size="lg" variant="quiet">
              <Link href={siteHref("/studios")}>Choose a studio</Link>
            </Button>
            <Button type="button" variant="link" data-open-concierge={`Is the ${t.name} right for my skin?`}>
              Ask Shanaya if it suits you
            </Button>
          </div>
        </div>
      </section>

      {(t.ritual.length > 0 || t.benefits.length > 0 || t.suitableFor.length > 0) && (
        <section aria-label="The ritual" className="bg-linen py-20 md:py-32">
          <div className="container-page grid gap-14 md:grid-cols-12">
            {t.ritual.length > 0 && (
              <div className="md:col-span-6">
                <p className="eyebrow">The ritual</p>
                <ol className="mt-8 grid gap-6">
                  {t.ritual.map((step, i) => (
                    <Reveal as="li" key={step} index={i} className="grid grid-cols-[3rem_1fr] items-baseline border-t border-line pt-5">
                      <span className="display-cut text-h3 text-brass-ink tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                      <span className="text-lead">{step}</span>
                    </Reveal>
                  ))}
                </ol>
              </div>
            )}
            <div className="grid content-start gap-12 md:col-span-5 md:col-start-8">
              {t.benefits.length > 0 && (
                <div>
                  <p className="eyebrow">What you&apos;ll notice</p>
                  <ul className="mt-6 grid gap-3">
                    {t.benefits.map((b) => (
                      <li key={b} className="flex gap-3">
                        <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rotate-45 bg-brass" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {t.suitableFor.length > 0 && (
                <div>
                  <p className="eyebrow">Lovely for</p>
                  <ul className="mt-5 flex flex-wrap gap-2">
                    {t.suitableFor.map((s) => (
                      <li key={s}><Badge>{s}</Badge></li>
                    ))}
                  </ul>
                </div>
              )}
              {t.addOns.length > 0 && (
                <div>
                  <p className="eyebrow">Add at the studio</p>
                  <p className="mt-4 text-stone">{t.addOns.join(" · ")}. Your therapist will confirm the price.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {faqs.length > 0 && (
        <section aria-labelledby="faq-title" className="container-page grid gap-10 py-20 md:grid-cols-12 md:py-32">
          <h2 id="faq-title" className="display-cut text-h2 md:col-span-4">Before you come</h2>
          <Faqs items={faqs} className="md:col-span-7 md:col-start-6" />
        </section>
      )}

      {related.length > 0 && (
        <section aria-labelledby="related-title" className="container-page pb-8">
          <Divider ornament />
          <h2 id="related-title" className="display-cut mt-16 text-h2">More {t.categoryLabel.toLowerCase()}</h2>
          <ul className="mt-10 grid gap-8 md:grid-cols-3">
            {related.map((r, i) => (
              <Reveal as="li" key={r.code} index={i}>
                <Link href={siteHref(`/services/${r.slug}`)} className="group block">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-image)] bg-sand">
                    <BrandImage id={r.image} fill sizes="(min-width: 768px) 30vw, 100vw" alt="" className="transition-transform duration-[1.2s] ease-[var(--ease-out-soft)] group-hover:scale-[1.04]" />
                  </div>
                  <p className="display-cut mt-4 text-h3">{r.name}</p>
                  <p className="text-sm text-stone tabular-nums">{formatPrice(r.price)} · {formatDuration(r.minutes)}</p>
                </Link>
              </Reveal>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function TreatmentSkeleton() {
  return (
    <div className="container-page grid gap-10 py-16 md:grid-cols-12" aria-busy="true">
      <Skeleton className="aspect-[4/5] md:col-span-5" />
      <div className="grid content-center gap-4 md:col-span-6 md:col-start-7">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-4/5" />
        <Skeleton className="h-6 w-2/3" />
      </div>
    </div>
  );
}

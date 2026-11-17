import type { Metadata } from "next";
import Link from "next/link";
import { brand as brandParam } from "next/root-params";
import { BrandImage } from "@/components/brand/brand-image";
import { JsonLd, PageIntro } from "@/components/brand/sections";
import { StudioFinder } from "@/components/brand/studio-finder";
import { PageTransition } from "@/components/motion/page-transition";
import { Reveal } from "@/components/motion/reveal";
import { getBrand, getCities, getStudios } from "@/lib/brand/data";
import { brandHref } from "@/lib/brand/href";
import { hoursRows } from "@/lib/brand/hours";
import { breadcrumbLd } from "@/lib/brand/seo";

export const metadata: Metadata = {
  title: "Studios",
  description: "Find a Lumière studio near you in Mumbai, New Delhi, Bengaluru, Kolkata, Chennai, Jaipur, Goa and more. Opening hours, addresses and booking.",
  alternates: { canonical: "/studios" },
};

// ISR: studio list from cached data; "nearest" is computed in the browser.
export default async function StudiosPage() {
  const slug = await brandParam();
  const [brand, studios, cities] = await Promise.all([getBrand(slug), getStudios(slug), getCities(slug)]);
  if (!brand) return null;
  const line = (h: Parameters<typeof hoursRows>[0]) => hoursRows(h).map((r) => `${r.days} ${r.hours}`).join(" · ");

  return (
    <PageTransition>
      <JsonLd data={breadcrumbLd(brand, [["Home", "/"], ["Studios", "/studios"]])} />
      <PageIntro eyebrow="Studios" lines={[`${studios.length} studios.`, "One standard."]} lead="Every Lumière studio is designed around daylight, quiet and time, with the same menu, the same products and the same care." />

      <section aria-label="Find a studio" className="container-page pb-20 md:pb-32">
        <StudioFinder
          cities={cities.map((c) => c.city)}
          studios={studios.map((s) => ({ slug: s.slug, city: s.city, area: s.area, address: s.address, hoursLine: line(s.hours), heroImage: s.heroImage, lat: s.lat, lng: s.lng }))}
        />
      </section>

      <section aria-labelledby="all-title" className="container-page">
        <h2 id="all-title" className="display-cut border-t border-line pt-16 text-h2">All studios</h2>
        <div className="mt-12 grid gap-16">
          {cities.map(({ city, studios: list }) => (
            <div key={city} className="grid gap-6 md:grid-cols-12">
              <h3 className="eyebrow md:col-span-3 md:pt-2">{city}</h3>
              <ul className="grid gap-8 sm:grid-cols-2 md:col-span-9 lg:grid-cols-3">
                {list.map((s, i) => (
                  <Reveal as="li" key={s.slug} index={i}>
                    <Link href={brandHref(`/studios/${s.slug}`)} className="group block">
                      <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-image)] bg-sand">
                        <BrandImage id={s.heroImage} fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 100vw" alt={`Inside the ${s.area} studio`} className="transition-transform duration-[1.2s] ease-[var(--ease-out-soft)] group-hover:scale-[1.04]" />
                      </div>
                      <p className="display-cut mt-4 text-h3">
                        {s.area}
                        {s.isFlagship && <span className="eyebrow ml-3 align-middle">Flagship</span>}
                      </p>
                      {s.address && <p className="mt-1 text-sm text-stone">{s.address}</p>}
                    </Link>
                  </Reveal>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </PageTransition>
  );
}

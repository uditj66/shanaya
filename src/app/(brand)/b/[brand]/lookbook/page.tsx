import type { Metadata } from "next";
import Link from "next/link";
import { brand as brandParam } from "next/root-params";
import { BrandImage } from "@/components/brand/brand-image";
import { JsonLd, PageIntro, SampleBadge } from "@/components/brand/sections";
import { BeforeAfter } from "@/components/motion/before-after";
import { PageTransition } from "@/components/motion/page-transition";
import { Reveal } from "@/components/motion/reveal";
import { getBrand, getLookbook, getMenu, getPackages } from "@/lib/brand/data";
import { brandHref } from "@/lib/brand/href";
import { breadcrumbLd } from "@/lib/brand/seo";

export const metadata: Metadata = {
  title: "Lookbook",
  description: "Skin, hair and nails after Lumière rituals: an editorial lookbook of results.",
  alternates: { canonical: "/lookbook" },
};

// ISR. Before/after pairs only appear when real, consented photos have been added.
export default async function LookbookPage() {
  const slug = await brandParam();
  const [brand, items, menu, packages] = await Promise.all([getBrand(slug), getLookbook(slug), getMenu(slug), getPackages(slug)]);
  if (!brand) return null;
  const pairs = items.filter((i) => i.before_image && i.after_image);
  const gallery = items.filter((i) => !(i.before_image && i.after_image));
  const link = (code: string | null) => {
    const t = menu.find((m) => m.code === code);
    if (t) return { href: brandHref(`/services/${t.slug}`), name: t.name };
    const p = packages.find((x) => x.code === code);
    return p ? { href: brandHref(`/occasions#${p.slug}`), name: p.name } : null;
  };

  return (
    <PageTransition>
      <JsonLd data={breadcrumbLd(brand, [["Home", "/"], ["Lookbook", "/lookbook"]])} />
      <PageIntro
        eyebrow="Lookbook"
        lines={["Skin, hair", "and hands, after."]}
        lead={items.length ? undefined : "Our lookbook of real guest results is being photographed, with every guest's consent. Until then, explore the rituals behind them."}
      >
        {!items.length && (
          <div className="mt-8 flex flex-wrap gap-6 text-sm">
            <Link href={brandHref("/services")} className="underline decoration-champagne underline-offset-4">See all treatments</Link>
            <Link href={brandHref("/book")} className="underline decoration-champagne underline-offset-4">Book a ritual</Link>
          </div>
        )}
      </PageIntro>

      {pairs.length > 0 && (
        <section aria-label="Before and after" className="container-page grid gap-16 pb-24">
          {pairs.map((p) => (
            <div key={p.id} className="grid gap-8 md:grid-cols-12 md:items-center">
              <BeforeAfter
                className="aspect-[4/3] md:col-span-8"
                label={`Compare before and after: ${p.title}`}
                before={<BrandImage id={p.before_image!} fill sizes="(min-width: 768px) 60vw, 100vw" />}
                after={<BrandImage id={p.after_image!} fill sizes="(min-width: 768px) 60vw, 100vw" />}
              />
              <div className="md:col-span-4">
                <p className="eyebrow">{p.category}</p>
                <h2 className="display-cut mt-3 text-h2">{p.title}</h2>
                <p className="mt-3 text-stone">{p.caption}</p>
                <SampleBadge show={p.is_sample} className="mt-3" />
              </div>
            </div>
          ))}
        </section>
      )}

      <section aria-label="Gallery" className="container-page">
        <ul className="columns-1 gap-6 sm:columns-2 lg:columns-3 [&>li]:mb-10 [&>li]:break-inside-avoid">
          {gallery.map((g, i) => {
            const l = link(g.service_code);
            return (
              <Reveal as="li" key={g.id} index={i % 3}>
                <div className={`relative overflow-hidden rounded-[var(--radius-image)] bg-sand ${i % 3 === 1 ? "aspect-[4/5]" : "aspect-[3/4]"}`}>
                  <BrandImage id={g.image} fill sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw" />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <p className="eyebrow">{g.category}</p>
                  <SampleBadge show={g.is_sample} />
                </div>
                <p className="display-cut mt-2 text-h3">{g.title}</p>
                <p className="mt-1 text-sm text-stone">{g.caption}</p>
                {l && (
                  <Link href={l.href} className="mt-2 inline-flex min-h-10 items-center text-sm underline decoration-line underline-offset-4 hover:decoration-charcoal">
                    {l.name}
                  </Link>
                )}
              </Reveal>
            );
          })}
        </ul>
      </section>
    </PageTransition>
  );
}

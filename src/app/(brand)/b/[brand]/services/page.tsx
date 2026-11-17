import { Suspense } from "react";
import type { Metadata } from "next";
import { brand as brandParam } from "next/root-params";
import { MenuBrowser } from "@/components/brand/menu-browser";
import { JsonLd, PageIntro } from "@/components/brand/sections";
import { PageTransition } from "@/components/motion/page-transition";
import { Skeleton } from "@/components/ui/display";
import { CATEGORIES, getBrand, getMenu, getStudios } from "@/lib/brand/data";
import { breadcrumbLd } from "@/lib/brand/seo";

export const metadata: Metadata = {
  title: "Treatments & prices",
  description: "The full Lumière menu: luxury facials, physician-led medi-facials, massage, body rituals, hair spa, nails and threading, with prices and durations.",
  alternates: { canonical: "/services" },
};

// SSG/ISR shell (cached menu); the filter island reads the URL at request time inside <Suspense>.
export default async function ServicesPage() {
  const slug = await brandParam();
  const [brand, menu, studios] = await Promise.all([getBrand(slug), getMenu(slug), getStudios(slug)]);
  if (!brand) return null;
  const items = menu.map(({ code, slug, name, headline, categorySlug, categoryLabel, minutes, price, consultationFirst, image }) => ({
    code, slug, name, headline, categorySlug, categoryLabel, minutes, price, consultationFirst, image,
  }));

  return (
    <PageTransition>
      <JsonLd data={breadcrumbLd(brand, [["Home", "/"], ["Treatments", "/services"]])} />
      <PageIntro
        eyebrow="Treatments"
        lines={["The menu."]}
        lead={`${menu.length} rituals, one standard. Every studio offers the same treatments at the same price. Prices exclude GST.`}
      />
      <div className="container-page">
        <Suspense fallback={<MenuFallback count={items.length} />}>
          <MenuBrowser
            items={items}
            categories={CATEGORIES.filter((c) => items.some((i) => i.categorySlug === c.slug)).map((c) => ({ slug: c.slug, label: c.label }))}
            studios={studios.map((s) => ({ slug: s.slug, label: `${s.area}, ${s.city}` }))}
          />
        </Suspense>
      </div>
    </PageTransition>
  );
}

function MenuFallback({ count }: { count: number }) {
  return (
    <div aria-busy="true">
      <Skeleton className="h-14" />
      <p className="mt-8 text-sm text-stone">{count} treatments</p>
      <div className="mt-14 grid gap-4">
        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    </div>
  );
}

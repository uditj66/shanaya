import Link from "next/link";
import { cacheLife } from "next/cache";
import { brandHref, type BrandPath } from "@/lib/brand/href";
import { getCities, type BrandData } from "@/lib/brand/data";
import { Divider } from "@/components/ui/display";

const LINKS: [string, [BrandPath, string][]][] = [
  ["Visit", [["/services", "Treatments"], ["/occasions", "Occasions & packages"], ["/book", "Book online"], ["/gift-cards", "Gift cards"], ["/offers", "Offers & membership"]]],
  ["Lumière", [["/about", "Our story"], ["/team", "Specialists"], ["/lookbook", "Lookbook"], ["/careers", "Careers"], ["/contact", "Contact"]]],
];

// Reading the clock during prerender must be cached explicitly under Cache Components.
async function Year() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

export async function SiteFooter({ brand }: { brand: BrandData }) {
  const cities = await getCities(brand.slug);
  return (
    <footer className="mt-24 border-t border-line bg-linen md:mt-40">
      <div className="container-page grid gap-14 py-16 md:grid-cols-12 md:py-24">
        <div className="md:col-span-4">
          <p className="display-cut text-h2">{brand.name}</p>
          <p className="mt-4 max-w-[34ch] text-stone">{brand.tagline} {cities.reduce((n, c) => n + c.studios.length, 0)} studios across {cities.length} cities, one standard of care.</p>
          {brand.instagram && (
            <a href={brand.instagram} className="mt-6 inline-flex min-h-11 items-center text-sm underline decoration-line underline-offset-4 hover:decoration-charcoal" rel="noopener" target="_blank">
              Instagram
            </a>
          )}
        </div>
        {LINKS.map(([title, links]) => (
          <nav key={title} aria-label={title} className="md:col-span-2">
            <p className="eyebrow">{title}</p>
            <ul className="mt-5 grid gap-1">
              {links.map(([href, label]) => (
                <li key={href}>
                  <Link href={brandHref(href)} className="inline-flex min-h-10 items-center text-[0.9375rem] text-charcoal/85 hover:text-charcoal">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <nav aria-label="Studios" className="md:col-span-4">
          <p className="eyebrow">Studios</p>
          <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 text-[0.9375rem]">
            {cities.map(({ city, studios }) => (
              <li key={city}>
                <p className="text-charcoal">{city}</p>
                <ul className="mt-1">
                  {studios.map((s) => (
                    <li key={s.slug}>
                      <Link href={brandHref(`/studios/${s.slug}`)} className="inline-flex min-h-8 items-center text-stone hover:text-charcoal">
                        {s.area}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="container-page pb-10">
        <Divider />
        <div className="flex flex-col gap-3 pt-6 text-[0.8125rem] text-stone md:flex-row md:items-center md:justify-between">
          <p>© <Year /> {brand.full_name}. Prices exclude GST.</p>
          <div className="flex gap-6">
            <Link href={brandHref("/privacy")} className="inline-flex min-h-10 items-center hover:text-charcoal">Privacy</Link>
            <Link href={brandHref("/contact")} className="inline-flex min-h-10 items-center hover:text-charcoal">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

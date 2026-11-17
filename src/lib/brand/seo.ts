// schema.org structured data for brand pages. Placeholder studio details are never emitted.
import type { BrandData, Studio, Treatment } from "./data";
import { openingHoursSpec } from "./hours";

const abs = (brand: BrandData, path: string) => new URL(path, brand.siteUrl).toString();

export function organizationLd(brand: BrandData, studioCount: number) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": abs(brand, "/#organization"),
    name: brand.full_name,
    alternateName: brand.name,
    url: abs(brand, "/"),
    slogan: brand.tagline,
    description: `${brand.full_name}: ${studioCount} studios offering luxury facials, medi-facials, spa and hair rituals.`,
    ...(brand.instagram && { sameAs: [brand.instagram] }),
  };
}

export function websiteLd(brand: BrandData) {
  return { "@context": "https://schema.org", "@type": "WebSite", name: brand.full_name, url: abs(brand, "/"), inLanguage: brand.locale };
}

/** One BeautySalon / DaySpa (LocalBusiness subtypes) per studio. */
export function studioLd(brand: BrandData, s: Studio, imageUrl?: string) {
  return {
    "@context": "https://schema.org",
    "@type": ["BeautySalon", "DaySpa"],
    "@id": abs(brand, `/studios/${s.slug}#studio`),
    name: s.name,
    url: abs(brand, `/studios/${s.slug}`),
    parentOrganization: { "@id": abs(brand, "/#organization") },
    priceRange: "₹₹₹",
    currenciesAccepted: brand.currency,
    paymentAccepted: "Cash, Credit Card, UPI",
    ...(imageUrl && { image: imageUrl }),
    ...(s.address && {
      address: { "@type": "PostalAddress", streetAddress: s.address, addressLocality: s.city, addressCountry: "IN" },
    }),
    ...(s.phone && { telephone: s.phone }),
    ...(s.lat != null && s.lng != null && { geo: { "@type": "GeoCoordinates", latitude: s.lat, longitude: s.lng } }),
    openingHoursSpecification: openingHoursSpec(s.hours),
  };
}

export function serviceLd(brand: BrandData, t: Treatment) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: t.name,
    description: t.description,
    serviceType: t.categoryLabel,
    url: abs(brand, `/services/${t.slug}`),
    provider: { "@id": abs(brand, "/#organization") },
    offers: { "@type": "Offer", price: t.price, priceCurrency: brand.currency, availability: "https://schema.org/InStock" },
  };
}

export function breadcrumbLd(brand: BrandData, items: [string, string][]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: abs(brand, path) })),
  };
}

export function faqLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

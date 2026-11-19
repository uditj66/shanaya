// Public brand-site data. Every read is a `use cache` function (ISR): pages are prerendered and stay static until
// the dashboard changes something and calls `updateTag(tags.x(slug))`. Only explicit, public columns are selected.
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { adminClient } from "@/lib/supabase/admin";

/** Sample rows (is_sample) show in development and previews; production hides them unless SHOW_SAMPLE_CONTENT=true. */
export const SHOW_SAMPLES = process.env.SHOW_SAMPLE_CONTENT === "true" || (process.env.NODE_ENV !== "production" && process.env.SHOW_SAMPLE_CONTENT !== "false");

export const tags = {
  brand: (b: string) => `brand:${b}`,
  studios: (b: string) => `studios:${b}`,
  menu: (b: string) => `menu:${b}`,
  team: (b: string) => `team:${b}`,
  content: (b: string) => `content:${b}`,
};

const db = () => adminClient();

/** Category order, URL slugs and the short names used on the site. */
export const CATEGORIES = [
  { name: "Luxury Facials", slug: "facials", label: "Facials" },
  { name: "Advanced Medi-Facials", slug: "medi-facials", label: "Medi-facials" },
  { name: "Detan & Brightening", slug: "brightening", label: "Brightening" },
  { name: "Body Spa & Massage", slug: "massage", label: "Massage" },
  { name: "Body Polishing & Treatments", slug: "body", label: "Body rituals" },
  { name: "Hair Services & Hair Spa", slug: "hair", label: "Hair" },
  { name: "Manicure & Pedicure", slug: "hands-feet", label: "Hands & feet" },
  { name: "Threading & Waxing", slug: "threading-waxing", label: "Threading & waxing" },
] as const;
export type CategorySlug = (typeof CATEGORIES)[number]["slug"];
const categoryOf = (name: string) => CATEGORIES.find((c) => c.name === name);

export type Faq = { q: string; a: string };
export type NudgeSettings = { enabled: boolean; delay_seconds: number; scroll_ratio: number; max_per_session: number };

/* ───────────────────────────── Brand ───────────────────────────── */
export async function getBrand(slug: string) {
  "use cache";
  cacheLife("days");
  cacheTag(tags.brand(slug));
  const { data } = await db()
    .from("brands")
    .select("id, slug, name, full_name, tagline, story, agent_name, site_url, currency, locale, instagram, email, phone, faqs, nudge_settings, deposit_amount, deposit_refund_hours, deposit_hold_minutes")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  return {
    ...data,
    faqs: (data.faqs ?? []) as Faq[],
    nudge: data.nudge_settings as NudgeSettings,
    siteUrl: data.site_url ?? process.env[`${slug.toUpperCase()}_SITE_URL`] ?? `http://${slug}.localhost:3000`,
  };
}
export type BrandData = NonNullable<Awaited<ReturnType<typeof getBrand>>>;

export async function getBrandSlugs() {
  "use cache";
  cacheLife("days");
  const { data } = await db().from("brands").select("slug");
  return (data ?? []).map((b) => b.slug);
}

/* ───────────────────────────── Studios ─────────────────────────── */
export type Hours = Record<string, [string, string][]>;

export async function getStudios(slug: string) {
  "use cache";
  cacheLife("days");
  cacheTag(tags.studios(slug), tags.brand(slug));
  const brand = await getBrand(slug);
  if (!brand) return [];
  const { data } = await db()
    .from("salons")
    .select("id, slug, studio_slug, city, area, address, phone, timezone, business_hours, latitude, longitude, hero_image, gallery, is_flagship, is_placeholder, max_days_ahead")
    .eq("brand_id", brand.id)
    .eq("published", true)
    .not("studio_slug", "is", null)
    .order("is_flagship", { ascending: false })
    .order("city")
    .order("area");
  return (data ?? []).map((s) => {
    const showContact = !s.is_placeholder || SHOW_SAMPLES;
    return {
      id: s.id,
      salonSlug: s.slug, // the branch slug used by the voice/widget endpoints
      slug: s.studio_slug!,
      city: s.city ?? "",
      area: s.area ?? "",
      name: `${brand.name} ${s.area}`,
      // Placeholder branch details are never shown on the live site.
      address: showContact ? s.address : null,
      phone: showContact ? s.phone : null,
      isPlaceholder: s.is_placeholder,
      timezone: s.timezone,
      hours: s.business_hours as Hours,
      lat: s.latitude,
      lng: s.longitude,
      heroImage: s.hero_image ?? "studios.reception",
      gallery: s.gallery,
      isFlagship: s.is_flagship,
      maxDaysAhead: s.max_days_ahead,
    };
  });
}
export type Studio = Awaited<ReturnType<typeof getStudios>>[number];

export async function getStudio(slug: string, studioSlug: string) {
  return (await getStudios(slug)).find((s) => s.slug === studioSlug) ?? null;
}

/** Cities in display order with their studios. */
export async function getCities(slug: string) {
  const studios = await getStudios(slug);
  const order = ["Mumbai", "New Delhi", "Bengaluru", "Kolkata", "Chennai"];
  const cities = [...new Set(studios.map((s) => s.city))].sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
  return cities.map((city) => ({ city, studios: studios.filter((s) => s.city === city) }));
}

/* ───────────────────────────── Menu ───────────────────────────── */
export async function getMenu(slug: string) {
  "use cache";
  cacheLife("days");
  cacheTag(tags.menu(slug), tags.brand(slug));
  const brand = await getBrand(slug);
  if (!brand) return [];
  const studios = await getStudios(slug);
  const flagship = studios.find((s) => s.isFlagship) ?? studios[0];
  if (!flagship) return [];
  // The menu is a chain-wide standard (SOP): read it from the flagship, enrich with brand page content.
  const [{ data: services }, { data: content }] = await Promise.all([
    db()
      .from("services")
      .select("code, name, category, description, duration_minutes, price, suitable_for, add_ons, consultation_first")
      .eq("salon_id", flagship.id)
      .eq("active", true)
      .not("code", "is", null)
      .neq("category", "Occasion Packages"),
    db().from("service_content").select("code, slug, headline, image, featured, sort_order, ritual, benefits").eq("brand_id", brand.id),
  ]);
  const byCode = new Map((content ?? []).map((c) => [c.code, c]));
  return (services ?? [])
    .map((s) => {
      const c = byCode.get(s.code!);
      const cat = categoryOf(s.category);
      if (!c || !cat) return null;
      return {
        code: s.code!,
        slug: c.slug,
        name: s.name,
        category: cat.name,
        categorySlug: cat.slug as CategorySlug,
        categoryLabel: cat.label,
        description: s.description,
        headline: c.headline,
        minutes: s.duration_minutes,
        price: Number(s.price),
        suitableFor: s.suitable_for,
        addOns: s.add_ons,
        consultationFirst: s.consultation_first,
        image: c.image ?? "services.facials",
        featured: c.featured,
        sort: c.sort_order,
        ritual: c.ritual,
        benefits: c.benefits,
      };
    })
    .filter((s) => s !== null)
    .sort((a, b) => CATEGORIES.findIndex((c) => c.name === a.category) - CATEGORIES.findIndex((c) => c.name === b.category) || a.sort - b.sort);
}
export type Treatment = Awaited<ReturnType<typeof getMenu>>[number];

export async function getTreatment(slug: string, serviceSlug: string) {
  return (await getMenu(slug)).find((s) => s.slug === serviceSlug) ?? null;
}

export async function getPackages(slug: string) {
  "use cache";
  cacheLife("days");
  cacheTag(tags.menu(slug), tags.brand(slug));
  const studios = await getStudios(slug);
  const flagship = studios.find((s) => s.isFlagship) ?? studios[0];
  if (!flagship) return [];
  const { data } = await db()
    .from("packages")
    .select("code, name, occasion, price, visits, validity_days, description, included_codes, target_customers, service:service_id (duration_minutes, consultation_first)")
    .eq("salon_id", flagship.id)
    .eq("active", true)
    .order("code");
  const menu = await getMenu(slug);
  const images: Record<string, string> = { PKG001: "occasions.bridal", PKG002: "occasions.festive", PKG003: "occasions.festive", PKG004: "occasions.honeymoon", PKG007: "occasions.festive" };
  return (data ?? []).map((p) => ({
    code: p.code,
    slug: p.name.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    name: p.name,
    occasion: p.occasion,
    price: Number(p.price),
    visits: p.visits,
    validityDays: p.validity_days,
    description: p.description,
    includes: p.included_codes.map((code) => menu.find((m) => m.code === code)).filter((m) => !!m).map((m) => ({ name: m.name, slug: m.slug })),
    minutes: p.service?.duration_minutes ?? null,
    consultationFirst: p.service?.consultation_first ?? p.visits > 1,
    image: images[p.code] ?? "rituals.products",
  }));
}
/* ───────────────────────────── Team ───────────────────────────── */
export async function getTeam(slug: string) {
  "use cache";
  cacheLife("days");
  cacheTag(tags.team(slug), tags.studios(slug), tags.brand(slug));
  const studios = await getStudios(slug);
  if (!studios.length) return [];
  const { data } = await db()
    .from("staff")
    .select("id, salon_id, slug, name, title, bio, specialties, languages, years_experience, portrait, portfolio, sort_order")
    .in("salon_id", studios.map((s) => s.id))
    .eq("active", true)
    .eq("public_profile", true)
    .not("slug", "is", null)
    .order("sort_order");
  return (data ?? []).map((p) => {
    const studio = studios.find((s) => s.id === p.salon_id)!;
    return {
      id: p.id,
      slug: p.slug!,
      name: p.name,
      title: p.title ?? "Specialist",
      bio: p.bio,
      specialties: p.specialties,
      languages: p.languages,
      years: p.years_experience,
      portrait: p.portrait ?? "stylists.01",
      portfolio: p.portfolio,
      studioSlug: studio.slug,
      studioArea: studio.area,
      city: studio.city,
      sort: p.sort_order,
    };
  });
}
export type Specialist = Awaited<ReturnType<typeof getTeam>>[number];

export async function getSpecialist(slug: string, studioSlug: string, staffSlug: string) {
  return (await getTeam(slug)).find((p) => p.studioSlug === studioSlug && p.slug === staffSlug) ?? null;
}

/* ─────────────────────────── Editorial content ─────────────────────────── */
async function brandId(slug: string) {
  return (await getBrand(slug))?.id ?? "00000000-0000-0000-0000-000000000000";
}

export async function getTestimonials(slug: string) {
  "use cache";
  cacheLife("days");
  cacheTag(tags.content(slug));
  let q = db().from("testimonials").select("id, guest_name, quote, rating, service_code, is_sample, salon:salon_id (area)").eq("brand_id", await brandId(slug)).eq("published", true);
  if (!SHOW_SAMPLES) q = q.eq("is_sample", false);
  const { data } = await q.order("sort_order");
  return (data ?? []).map((t) => ({ id: t.id, name: t.guest_name, quote: t.quote, rating: t.rating, serviceCode: t.service_code, studio: t.salon?.area ?? null, isSample: t.is_sample }));
}

export async function getPress(slug: string) {
  "use cache";
  cacheLife("days");
  cacheTag(tags.content(slug));
  let q = db().from("press").select("id, publication, headline, url, year, is_sample").eq("brand_id", await brandId(slug)).eq("published", true);
  if (!SHOW_SAMPLES) q = q.eq("is_sample", false);
  const { data } = await q.order("sort_order");
  return data ?? [];
}

export async function getOffers(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(tags.content(slug));
  let q = db().from("offers").select("id, title, description, terms, image, service_code, starts_on, ends_on, is_sample").eq("brand_id", await brandId(slug)).eq("published", true);
  if (!SHOW_SAMPLES) q = q.eq("is_sample", false);
  const { data } = await q.order("sort_order");
  return data ?? [];
}

export async function getMemberships(slug: string) {
  "use cache";
  cacheLife("days");
  cacheTag(tags.content(slug));
  let q = db().from("memberships").select("id, name, price, period, benefits, highlight, is_sample").eq("brand_id", await brandId(slug)).eq("published", true);
  if (!SHOW_SAMPLES) q = q.eq("is_sample", false);
  const { data } = await q.order("sort_order");
  return (data ?? []).map((m) => ({ ...m, price: Number(m.price) }));
}

export async function getLookbook(slug: string) {
  "use cache";
  cacheLife("days");
  cacheTag(tags.content(slug));
  let q = db().from("lookbook_items").select("id, title, category, caption, image, before_image, after_image, service_code, is_sample").eq("brand_id", await brandId(slug)).eq("published", true);
  if (!SHOW_SAMPLES) q = q.eq("is_sample", false);
  const { data } = await q.order("sort_order");
  return data ?? [];
}

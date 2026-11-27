// /sitemap.xml for the website. Cached with the site data and refreshed by the same tags.
import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { BRAND, getBrand, getMenu, getStudios, getTeam, tags } from "@/lib/brand/data";

const STATIC = ["/", "/services", "/occasions", "/studios", "/team", "/lookbook", "/offers", "/gift-cards", "/about", "/careers", "/contact", "/book", "/privacy"];

async function entries(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  cacheLife("days");
  cacheTag(tags.brand(BRAND), tags.menu(BRAND), tags.studios(BRAND), tags.team(BRAND));
  const [brand, menu, studios, team] = await Promise.all([getBrand(BRAND), getMenu(BRAND), getStudios(BRAND), getTeam(BRAND)]);
  if (!brand) return [];
  const paths = [
    ...STATIC,
    ...menu.map((t) => `/services/${t.slug}`),
    ...studios.map((s) => `/studios/${s.slug}`),
    ...team.map((p) => `/studios/${p.studioSlug}/team/${p.slug}`),
  ];
  return paths.map((p) => ({
    url: new URL(p, brand.siteUrl).toString(),
    changeFrequency: p === "/" || p === "/offers" ? "weekly" : "monthly",
    priority: p === "/" ? 1 : p.split("/").length > 3 ? 0.5 : 0.8,
  }));
}

export default function sitemap(): Promise<MetadataRoute.Sitemap> {
  return entries();
}

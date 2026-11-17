// /sitemap.xml on the brand domain (proxy rewrites it here). Cached with the brand data and refreshed by the same tags.
import { cacheLife, cacheTag } from "next/cache";
import { getBrand, getMenu, getStudios, getTeam, tags } from "@/lib/brand/data";

const STATIC = ["/", "/services", "/occasions", "/studios", "/team", "/lookbook", "/offers", "/gift-cards", "/about", "/careers", "/contact", "/book", "/privacy"];

async function sitemap(slug: string) {
  "use cache";
  cacheLife("days");
  cacheTag(tags.brand(slug), tags.menu(slug), tags.studios(slug), tags.team(slug));
  const [brand, menu, studios, team] = await Promise.all([getBrand(slug), getMenu(slug), getStudios(slug), getTeam(slug)]);
  if (!brand) return null;
  const paths = [
    ...STATIC,
    ...menu.map((t) => `/services/${t.slug}`),
    ...studios.map((s) => `/studios/${s.slug}`),
    ...team.map((p) => `/studios/${p.studioSlug}/team/${p.slug}`),
  ];
  const urls = paths
    .map((p) => `  <url><loc>${new URL(p, brand.siteUrl).toString()}</loc><changefreq>${p === "/" || p === "/offers" ? "weekly" : "monthly"}</changefreq><priority>${p === "/" ? "1.0" : p.split("/").length > 3 ? "0.5" : "0.8"}</priority></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export async function GET(_req: Request, { params }: RouteContext<"/b/[brand]/sitemap.xml">) {
  const xml = await sitemap((await params).brand);
  if (!xml) return new Response("Not found", { status: 404 });
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}

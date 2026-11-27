// /robots.txt. Staff pages, internal pages (design system) and API routes stay out of search results.
import type { MetadataRoute } from "next";
import { BRAND, getBrand } from "@/lib/brand/data";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const brand = await getBrand(BRAND);
  const base = brand?.siteUrl ?? process.env.PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/styleguide", "/dashboard", "/login"] },
    sitemap: new URL("/sitemap.xml", base).toString(),
  };
}

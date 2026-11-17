// /robots.txt on the brand domain. Internal pages (design system) and API routes stay out of search results.
import { getBrand } from "@/lib/brand/data";

export async function GET(_req: Request, { params }: RouteContext<"/b/[brand]/robots.txt">) {
  const brand = await getBrand((await params).brand);
  if (!brand) return new Response("Not found", { status: 404 });
  const body = ["User-agent: *", "Allow: /", "Disallow: /api/", "Disallow: /styleguide", `Sitemap: ${new URL("/sitemap.xml", brand.siteUrl)}`, ""].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

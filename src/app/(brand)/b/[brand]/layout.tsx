import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { brand as brandParam } from "next/root-params";
import { Bodoni_Moda, Hanken_Grotesk } from "next/font/google";
import { MotionProvider } from "@/components/motion/motion-provider";
import { SiteFooter } from "@/components/brand/site-footer";
import { SiteHeader } from "@/components/brand/site-header";
import { Toaster } from "@/components/ui/toast";
import { Concierge } from "@/components/concierge/concierge";
import { getBrand, getBrandSlugs, getStudios } from "@/lib/brand/data";
import "../../../globals.css";

/*
 * Root layout for every brand website (served on the brand's own domain via proxy.ts).
 * `brand` is a root param: any server code can read it with `brand()` from next/root-params, and cached
 * functions get it in their cache key automatically, so each brand has its own static (SSG/ISR) pages.
 * Display: Bodoni Moda (optical sizes give true high contrast at hero sizes). UI/body: Hanken Grotesk.
 */
const display = Bodoni_Moda({ variable: "--font-display", subsets: ["latin"], axes: ["opsz"], style: ["normal", "italic"], display: "swap" });
const ui = Hanken_Grotesk({ variable: "--font-ui", subsets: ["latin"], display: "swap" });

// SSG: every brand site is prerendered at build time; unknown brands 404.
export async function generateStaticParams() {
  return (await getBrandSlugs()).map((brand) => ({ brand }));
}

export const viewport: Viewport = { colorScheme: "light", themeColor: "#fbf8f3" };

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand(await brandParam());
  if (!brand) return {};
  return {
    metadataBase: new URL(brand.siteUrl),
    title: { default: `${brand.full_name} · Luxury facials, spa & hair`, template: `%s · ${brand.name}` },
    description: `${brand.tagline} Luxury facials, physician-led medi-facials, massage, hair spa and nails, with one standard of care in every studio.`,
    openGraph: { siteName: brand.full_name, locale: brand.locale.replace("-", "_"), type: "website" },
    twitter: { card: "summary_large_image" },
  };
}

export default async function BrandRootLayout({ children }: LayoutProps<"/b/[brand]">) {
  const slug = await brandParam();
  const [brand, studios] = await Promise.all([getBrand(slug), getStudios(slug)]);
  if (!brand) notFound();
  const flagship = studios.find((s) => s.isFlagship) ?? studios[0];

  return (
    <html lang={brand.locale} className={`${display.variable} ${ui.variable} antialiased`}>
      <body className="min-h-dvh bg-ivory font-sans text-body text-charcoal">
        <a href="#main" className="sr-only z-[70] rounded-full bg-charcoal px-5 py-3 text-sm text-ivory focus:not-sr-only focus:fixed focus:top-4 focus:left-4">
          Skip to content
        </a>
        <MotionProvider>
          <SiteHeader name={brand.name} />
          <main id="main">{children}</main>
          <SiteFooter brand={brand} />
          {flagship && <Concierge brand={brand.slug} agentName={brand.agent_name} voiceSlug={flagship.salonSlug} nudge={brand.nudge} />}
        </MotionProvider>
        <Toaster />
      </body>
    </html>
  );
}

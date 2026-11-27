import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Bodoni_Moda, Hanken_Grotesk } from "next/font/google";
import { MotionProvider } from "@/components/motion/motion-provider";
import { SiteFooter } from "@/components/brand/site-footer";
import { SiteHeader } from "@/components/brand/site-header";
import { Toaster } from "@/components/ui/toast";
import { Concierge } from "@/components/concierge/concierge";
import { SiteTracker } from "@/components/brand/site-tracker";
import { BRAND, getBrand, getLookbook, getStudios } from "@/lib/brand/data";
import "../globals.css";

/*
 * Root layout for the Lumière website (guest pages). Staff pages (/login, /dashboard) use the (platform) root layout.
 * Display: Bodoni Moda (optical sizes give true high contrast at hero sizes). UI/body: Hanken Grotesk.
 */
const display = Bodoni_Moda({ variable: "--font-display", subsets: ["latin"], axes: ["opsz"], style: ["normal", "italic"], display: "swap" });
const ui = Hanken_Grotesk({ variable: "--font-ui", subsets: ["latin"], display: "swap" });

export const viewport: Viewport = { colorScheme: "light", themeColor: "#fbf8f3" };

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand(BRAND);
  if (!brand) return {};
  return {
    metadataBase: new URL(brand.siteUrl),
    title: { default: `${brand.full_name} · Luxury facials, spa & hair`, template: `%s · ${brand.name}` },
    description: `${brand.tagline} Luxury facials, physician-led medi-facials, massage, hair spa and nails, with one standard of care in every studio.`,
    openGraph: { siteName: brand.full_name, locale: brand.locale.replace("-", "_"), type: "website" },
    twitter: { card: "summary_large_image" },
  };
}

export default async function SiteRootLayout({ children }: { children: ReactNode }) {
  const slug = BRAND;
  const [brand, studios, lookbook] = await Promise.all([getBrand(slug), getStudios(slug), getLookbook(slug)]);
  const hide = lookbook.length ? [] : (["/lookbook"] as const);
  if (!brand) notFound();
  const flagship = studios.find((s) => s.isFlagship) ?? studios[0];

  return (
    <html lang={brand.locale} className={`${display.variable} ${ui.variable} antialiased`}>
      <body className="min-h-dvh bg-ivory font-sans text-body text-charcoal">
        <a href="#main" className="sr-only z-[70] rounded-full bg-charcoal px-5 py-3 text-sm text-ivory focus:not-sr-only focus:fixed focus:top-4 focus:left-4">
          Skip to content
        </a>
        <SiteTracker brand={brand.slug} />
        <MotionProvider>
          <SiteHeader name={brand.name} hide={[...hide]} />
          <main id="main">{children}</main>
          <SiteFooter brand={brand} hide={[...hide]} />
          {flagship && <Concierge brand={brand.slug} brandName={brand.name} agentName={brand.agent_name} voiceSlug={flagship.salonSlug} nudge={brand.nudge} />}
        </MotionProvider>
        <Toaster />
      </body>
    </html>
  );
}

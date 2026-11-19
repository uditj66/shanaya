import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Hanken_Grotesk } from "next/font/google";
import "../globals.css";

// Same type system as the brand websites, so the dashboard feels like part of the studio.
const display = Bodoni_Moda({ variable: "--font-display", subsets: ["latin"], axes: ["opsz"], display: "swap" });
const ui = Hanken_Grotesk({ variable: "--font-ui", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Shanaya · AI Receptionist for Salons & Spas",
  description: "Answers every call, books appointments into your calendar, and hands staff a clear summary.",
};

export const viewport: Viewport = { colorScheme: "light", themeColor: "#fbf8f3" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable} h-full antialiased`}>
      <body className="min-h-full bg-ivory font-sans text-charcoal">{children}</body>
    </html>
  );
}

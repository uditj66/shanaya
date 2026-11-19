import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { THEME_SCRIPT } from "@/components/admin/theme";
import "../globals.css";

// The team app (dashboard, login, privacy) uses the admin theme: html.admin in admin-theme.css.
// Outfit is the UI font; light/dark is applied by THEME_SCRIPT before first paint.
const ui = Outfit({ variable: "--font-ui", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Lumière · Team dashboard",
  description: "Bookings, calls and Shanaya, the AI receptionist, for the Lumière team.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfc" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`admin ${ui.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}

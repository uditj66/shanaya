import { ImageResponse } from "next/og";
import { BRAND, getBrand, getStudios } from "@/lib/brand/data";

// Generated, on-brand social card (1200×630) used by every page that doesn't set its own image.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Lumière Facial Studio & Spa";

/** Bodoni Moda subset for just the glyphs on the card (Google Fonts serves TTF to non-browser clients). */
async function displayFont(text: string) {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,96,400;1,96,400&text=${encodeURIComponent(text)}`)).text();
    // One @font-face block per style: pick each file by its declared font-style.
    const url = (style: string) => css.split("@font-face").find((b) => b.includes(`font-style: ${style}`))?.match(/src: url\((.+?)\)/)?.[1];
    const [normal, italic] = await Promise.all(["normal", "italic"].map(async (st) => { const u = url(st); return u ? (await fetch(u)).arrayBuffer() : null; }));
    if (!normal) return [];
    return [
      { name: "Bodoni", data: normal, style: "normal" as const, weight: 400 as const },
      ...(italic ? [{ name: "Bodoni", data: italic, style: "italic" as const, weight: 400 as const }] : []),
    ];
  } catch {
    return []; // falls back to the default font; the card still renders
  }
}

export default async function OpengraphImage() {
  const [brand, studios] = await Promise.all([getBrand(BRAND), getStudios(BRAND)]);
  const cities = new Set(studios.map((s) => s.city)).size;
  const eyebrow = `${studios.length} studios · ${cities} cities`.toUpperCase();
  const fonts = await displayFont(`${brand?.name ?? "Lumière"}${brand?.tagline ?? ""}${eyebrow}FACIAL STUDIO & SPA`);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#fbf8f3", padding: 80, color: "#2b2523", fontFamily: "Bodoni, serif" }}>
        <div style={{ display: "flex", fontSize: 22, letterSpacing: 8, color: "#7a5c2e" }}>
          {eyebrow}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 132, lineHeight: 1, letterSpacing: -2 }}>{brand?.name ?? "Lumière"}</div>
          <div style={{ marginTop: 28, fontSize: 44, color: "#655a53", fontStyle: "italic" }}>{brand?.tagline ?? ""}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ width: 120, height: 2, background: "#9c7a47" }} />
          <div style={{ fontSize: 22, letterSpacing: 6, color: "#655a53" }}>FACIAL STUDIO &amp; SPA</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}

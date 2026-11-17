"use client";
import { useState } from "react";
import Link from "next/link";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import { brandHref } from "@/lib/brand/href";
import { cn } from "@/lib/utils";
import { BrandImage } from "./brand-image";
import { Button } from "@/components/ui/button";
import { EASE_OUT_SOFT } from "@/components/motion/motion-provider";

export type FinderStudio = { slug: string; city: string; area: string; address: string | null; hoursLine: string; heroImage: string; lat: number | null; lng: number | null };

/** Great-circle distance in km. */
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/**
 * City selector that cross-fades a studio photo and card. "Use my location" finds the nearest studio entirely in the
 * browser: the position is never sent to our servers.
 */
export function StudioFinder({ studios, cities }: { studios: FinderStudio[]; cities: string[] }) {
  const [city, setCity] = useState(cities[0]);
  const [selected, setSelected] = useState(studios.find((s) => s.city === cities[0])?.slug);
  const [locating, setLocating] = useState<"idle" | "busy" | "denied">("idle");
  const [distance, setDistance] = useState<number | null>(null);
  const inCity = studios.filter((s) => s.city === city);
  const studio = studios.find((s) => s.slug === selected) ?? inCity[0];

  const choose = (c: string) => {
    setCity(c);
    setSelected(studios.find((s) => s.city === c)?.slug);
    setDistance(null);
  };

  const nearest = () => {
    if (!("geolocation" in navigator)) return setLocating("denied");
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const here = { lat: coords.latitude, lng: coords.longitude };
        const ranked = studios
          .filter((s) => s.lat != null && s.lng != null)
          .map((s) => ({ s, d: km(here, { lat: s.lat!, lng: s.lng! }) }))
          .sort((a, b) => a.d - b.d);
        if (ranked[0]) {
          setCity(ranked[0].s.city);
          setSelected(ranked[0].s.slug);
          setDistance(ranked[0].d);
        }
        setLocating("idle");
      },
      () => setLocating("denied"),
      { maximumAge: 600_000, timeout: 10_000 },
    );
  };

  return (
    <div className="grid gap-10 md:grid-cols-12 md:gap-12">
      <div className="md:col-span-5">
        <div role="group" aria-label="Choose a city" className="flex flex-wrap gap-2">
          {cities.map((c) => (
            <button
              key={c}

              aria-pressed={c === city}
              onClick={() => choose(c)}
              className={cn(
                "min-h-11 rounded-full border px-4 text-sm transition-colors duration-[var(--duration-ui)]",
                c === city ? "border-charcoal bg-charcoal text-ivory" : "border-line text-stone hover:border-champagne hover:text-charcoal",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <button onClick={nearest} disabled={locating === "busy"} className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm text-brass-ink underline decoration-champagne underline-offset-4 hover:decoration-brass-ink">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {locating === "busy" ? "Finding your nearest studio…" : "Use my location"}
        </button>
        <p aria-live="polite" className="mt-1 min-h-5 text-[0.8125rem] text-stone">
          {locating === "denied" ? "Location isn't available, so choose a city above." : distance != null && studio ? `Nearest to you: ${studio.area}, about ${Math.round(distance)} km away.` : ""}
        </p>

        {inCity.length > 1 && (
          <ul className="mt-6 grid gap-1 border-t border-line pt-4" aria-label={`Studios in ${city}`}>
            {inCity.map((s) => (
              <li key={s.slug}>
                <button
                  onClick={() => setSelected(s.slug)}
                  aria-pressed={s.slug === studio?.slug}
                  className={cn("flex min-h-11 w-full items-center justify-between text-left transition-colors", s.slug === studio?.slug ? "text-charcoal" : "text-stone hover:text-charcoal")}
                >
                  <span className="display-cut text-h3">{s.area}</span>
                  <span aria-hidden="true" className={cn("h-px w-8 bg-charcoal transition-transform duration-500 ease-[var(--ease-out-soft)] origin-right", s.slug === studio?.slug ? "scale-x-100" : "scale-x-0")} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="md:col-span-7">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-image)] bg-sand">
          <AnimatePresence initial={false}>
            {studio && (
              <m.div key={studio.slug} className="absolute inset-0" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.9, ease: EASE_OUT_SOFT }}>
                <BrandImage id={studio.heroImage} fill sizes="(min-width: 768px) 55vw, 100vw" alt={`Inside the ${studio.area} studio`} />
              </m.div>
            )}
          </AnimatePresence>
        </div>
        {studio && (
          <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <div aria-live="polite">
              <p className="eyebrow">{studio.city}</p>
              <p className="display-cut mt-2 text-h2">{studio.area}</p>
              {studio.address && <p className="mt-2 max-w-[40ch] text-sm text-stone">{studio.address}</p>}
              <p className="mt-1 text-sm text-stone">{studio.hoursLine}</p>
            </div>
            <div className="flex gap-3">
              <Button asChild variant="quiet">
                <Link href={brandHref(`/studios/${studio.slug}`)}>View studio</Link>
              </Button>
              <Button asChild>
                <Link href={brandHref(`/book?studio=${studio.slug}`)}>Book here</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

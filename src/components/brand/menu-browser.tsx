"use client";
import { useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import { siteHref } from "@/lib/brand/href";
import { cn, formatDuration, formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/display";
import { Select } from "@/components/ui/form-controls";
import { EASE_OUT_SOFT } from "@/components/motion/motion-provider";
import { BrandImage } from "./brand-image";

export type MenuItem = {
  code: string; slug: string; name: string; headline: string; categorySlug: string; categoryLabel: string;
  minutes: number; price: number; consultationFirst: boolean; image: string;
};

const DURATIONS = [
  { value: "any", label: "Any length" },
  { value: "short", label: "Under 45 min" },
  { value: "mid", label: "45–90 min" },
  { value: "long", label: "Over 90 min" },
];
const PRICES = [
  { value: "any", label: "Any price" },
  { value: "1500", label: "Under ₹1,500" },
  { value: "3500", label: "Under ₹3,500" },
  { value: "6000", label: "Under ₹6,000" },
];

/**
 * The full menu with filters kept in the URL (?category=&duration=&price=&studio=), so filtered views can be shared and the
 * back button works. The page itself is static; only this island reads search params (inside <Suspense>).
 */
export function MenuBrowser({
  items,
  categories,
  studios,
}: {
  items: MenuItem[];
  categories: { slug: string; label: string }[];
  studios: { slug: string; label: string }[];
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = "/services"; // the visible URL (usePathname would read the internal rewrite path)
  const category = params.get("category") ?? "all";
  const duration = params.get("duration") ?? "any";
  const price = params.get("price") ?? "any";
  const studio = params.get("studio") ?? "";

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === "all" || value === "any") next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}` as Route, { scroll: false });
  };

  const visible = useMemo(
    () =>
      items.filter(
        (i) =>
          (category === "all" || i.categorySlug === category) &&
          (duration === "any" || (duration === "short" ? i.minutes < 45 : duration === "mid" ? i.minutes >= 45 && i.minutes <= 90 : i.minutes > 90)) &&
          (price === "any" || i.price < Number(price)),
      ),
    [items, category, duration, price],
  );
  const groups = categories.map((c) => ({ ...c, items: visible.filter((v) => v.categorySlug === c.slug) })).filter((g) => g.items.length);
  const studioLabel = studios.find((s) => s.slug === studio)?.label;
  const bookHref = (code: string) => siteHref(`/book?service=${code}${studio ? `&studio=${studio}` : ""}`);

  return (
    <div>
      <div className="sticky top-16 z-30 -mx-5 border-y border-line bg-ivory/92 px-5 py-4 backdrop-blur-md md:top-20 md:-mx-8 md:px-8 xl:-mx-12 xl:px-12">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div role="group" aria-label="Category" className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0">
            {[{ slug: "all", label: "All" }, ...categories].map((c) => (
              <button
                key={c.slug}
                aria-pressed={category === c.slug}
                onClick={() => set("category", c.slug)}
                className={cn(
                  "min-h-10 shrink-0 rounded-full border px-4 text-[0.8125rem] transition-colors duration-[var(--duration-ui)]",
                  category === c.slug ? "border-charcoal bg-charcoal text-ivory" : "border-line text-stone hover:border-champagne hover:text-charcoal",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 lg:w-[34rem] lg:shrink-0">
            <Select aria-label="Studio" value={studio || "all"} onValueChange={(v) => set("studio", v)} options={[{ value: "all", label: "Any studio" }, ...studios.map((s) => ({ value: s.slug, label: s.label }))]} className="h-10 text-[0.8125rem]" />
            <Select aria-label="Duration" value={duration} onValueChange={(v) => set("duration", v)} options={DURATIONS} className="h-10 text-[0.8125rem]" />
            <Select aria-label="Price" value={price} onValueChange={(v) => set("price", v)} options={PRICES} className="h-10 text-[0.8125rem]" />
          </div>
        </div>
      </div>

      <p aria-live="polite" className="mt-8 text-sm text-stone">
        {visible.length} {visible.length === 1 ? "treatment" : "treatments"}
        {studioLabel ? ` · all available at ${studioLabel}` : " · same menu and price at every studio"}
      </p>

      {groups.length === 0 && (
        <div className="py-24 text-center">
          <p className="display-cut text-h3">Nothing matches those filters.</p>
          <button onClick={() => router.replace(pathname as Route, { scroll: false })} className="mt-4 min-h-11 text-sm underline underline-offset-4">
            Clear filters
          </button>
        </div>
      )}

      <AnimatePresence initial={false}>
        {groups.map((g) => (
          <m.section key={g.slug} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: EASE_OUT_SOFT }} aria-labelledby={`cat-${g.slug}`} className="mt-14 md:mt-20">
            <h2 id={`cat-${g.slug}`} className="display-cut text-h2">{g.label}</h2>
            <ul className="mt-6 divide-y divide-line border-y border-line">
              {g.items.map((i) => (
                <li key={i.code} className="group grid grid-cols-[4.5rem_1fr] gap-4 py-6 sm:grid-cols-[6rem_1fr_auto] sm:items-center md:gap-8">
                  <div className="relative aspect-square overflow-hidden rounded-[var(--radius-image)] bg-sand">
                    <BrandImage id={i.image} fill sizes="96px" alt="" className="transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:scale-105" />
                  </div>
                  <div className="min-w-0">
                    <Link href={siteHref(`/services/${i.slug}`)} className="display-cut text-h3 after:absolute after:inset-0 sm:relative">
                      {i.name}
                    </Link>
                    <p className="mt-1 text-sm text-stone">{i.headline}</p>
                    <p className="mt-2 text-sm text-stone tabular-nums">
                      <span className="font-medium text-charcoal">{formatPrice(i.price)}</span>
                      <span aria-hidden="true" className="mx-2 text-champagne">·</span>
                      {formatDuration(i.minutes)}
                      {i.consultationFirst && <Badge tone="brass" className="ml-3 align-middle">Consultation first</Badge>}
                    </p>
                  </div>
                  <Link
                    href={bookHref(i.code)}
                    className="col-start-2 inline-flex min-h-11 items-center justify-self-start rounded-full border border-charcoal/25 px-5 text-sm transition-colors hover:border-charcoal sm:col-start-3"
                    aria-label={`${i.consultationFirst ? "Request a consultation for" : "Book"} ${i.name}`}
                  >
                    {i.consultationFirst ? "Request" : "Book"}
                  </Link>
                </li>
              ))}
            </ul>
          </m.section>
        ))}
      </AnimatePresence>
    </div>
  );
}

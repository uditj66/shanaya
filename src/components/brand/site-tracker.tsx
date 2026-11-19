"use client";
import { Suspense, useEffect } from "react";
import { usePathname } from "next/navigation";
import { setTrackBrand, track } from "@/lib/track-client";

/** Records one page view per navigation (client-side only, after hydration). Renders nothing, so it streams in its own boundary. */
export function SiteTracker({ brand }: { brand: string }) {
  return (
    <Suspense fallback={null}>
      <Tracker brand={brand} />
    </Suspense>
  );
}

function Tracker({ brand }: { brand: string }) {
  const pathname = usePathname();
  useEffect(() => {
    setTrackBrand(brand);
    track("page_view");
  }, [brand, pathname]);
  return null;
}

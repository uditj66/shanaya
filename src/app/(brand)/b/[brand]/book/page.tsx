import { Suspense } from "react";
import type { Metadata } from "next";
import { brand as brandParam } from "next/root-params";
import { BookingFlow } from "@/components/brand/booking-flow";
import { Skeleton } from "@/components/ui/display";
import { getBrand, getMenu, getPackages, getStudios } from "@/lib/brand/data";
import { razorpayConfigured } from "@/lib/payments/razorpay";

export const metadata: Metadata = {
  title: "Book an appointment",
  description: "Book a Lumière facial, spa, hair or nail ritual online in four steps, with live availability at every studio.",
  alternates: { canonical: "/book" },
  robots: { index: true, follow: true },
};

// Static shell (cached menu + studios). The flow itself is a client island: choices live in the URL,
// live times come from /api/book/slots, and the booking is a Server Action.
export default async function BookPage() {
  const slug = await brandParam();
  const [brand, menu, packages, studios] = await Promise.all([getBrand(slug), getMenu(slug), getPackages(slug), getStudios(slug)]);
  // Online bookings take a deposit when the brand sets one and payments are configured.
  const deposit = brand && brand.deposit_amount > 0 && razorpayConfigured() ? { amount: brand.deposit_amount, refundHours: brand.deposit_refund_hours } : null;
  const treatments = [
    ...menu.map((t) => ({ code: t.code, name: t.name, group: t.categoryLabel, minutes: t.minutes, price: t.price, consultationFirst: t.consultationFirst, image: t.image })),
    ...packages.map((p) => ({ code: p.code, name: p.name, group: "Occasions", minutes: p.minutes, price: p.price, consultationFirst: p.consultationFirst, image: p.image })),
  ];

  return (
    <div className="container-page pt-12 pb-32 md:pt-20">
      <p className="eyebrow">Book</p>
      <h1 className="sr-only">Book an appointment</h1>
      <div className="mt-6">
        <Suspense fallback={<FlowSkeleton />}>
          <BookingFlow brand={slug} deposit={deposit} treatments={treatments} studios={studios.map((s) => ({ slug: s.slug, city: s.city, area: s.area, lat: s.lat, lng: s.lng }))} />
        </Suspense>
      </div>
    </div>
  );
}

function FlowSkeleton() {
  return (
    <div className="grid gap-10 lg:grid-cols-12" aria-busy="true">
      <div className="grid gap-6 lg:col-span-8">
        <Skeleton className="h-6" />
        <Skeleton className="h-14 w-2/3" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[5.5rem]" />)}
        </div>
      </div>
      <Skeleton className="hidden h-96 lg:col-span-4 lg:block" />
    </div>
  );
}

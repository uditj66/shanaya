import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { brand as brandParam } from "next/root-params";
import { BrandImage } from "@/components/brand/brand-image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getBrand } from "@/lib/brand/data";
import { brandHref } from "@/lib/brand/href";
import { adminClient } from "@/lib/supabase/admin";

// A private link: never indexed, never cached.
export const metadata: Metadata = { title: "Your gift card", robots: { index: false, follow: false } };

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;
/** Runs at request time (this page is dynamic). */
function hasExpired(iso: string | null) {
  return !!iso && Date.parse(iso) < Date.now();
}
const date = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(iso));

async function Card({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{24,64}$/.test(token)) notFound();
  const brand = await getBrand(await brandParam());
  if (!brand) notFound();
  const { data: g } = await adminClient()
    .from("gift_cards")
    .select("code, amount, balance, recipient_name, sender_name, message, status, expires_at")
    .eq("view_token", token)
    .eq("brand_id", brand.id)
    .maybeSingle();
  if (!g || g.status === "pending" || g.status === "cancelled") notFound();
  const expired = g.status === "expired" || hasExpired(g.expires_at);

  return (
    <section className="container-page grid gap-12 py-16 md:grid-cols-12 md:py-24">
      <div className="md:col-span-5">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[2px]">
          <BrandImage id="gift.card" fill sizes="(min-width: 768px) 40vw, 100vw" priority />
        </div>
      </div>
      <div className="md:col-span-6 md:col-start-7 md:self-center">
        <p className="eyebrow">A gift for you</p>
        <h1 className="display-cut mt-4 text-h1">{g.recipient_name}, an hour of quiet awaits.</h1>
        <p className="mt-4 text-lead text-stone">From {g.sender_name}</p>
        {g.message && <blockquote className="mt-8 border-l border-brass pl-5 font-display text-[1.375rem] leading-snug italic">“{g.message}”</blockquote>}

        <div className="mt-10 rounded-2xl border border-champagne bg-white/70 p-6 md:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <p className="eyebrow">Gift card code</p>
              <p className="display-cut mt-2 whitespace-nowrap text-[clamp(1.5rem,3.2vw,2.25rem)] tracking-[0.1em] tabular-nums">{g.code}</p>
            </div>
            <div className="text-right">
              <p className="eyebrow">Balance</p>
              <p className="display-cut mt-2 text-h2 tabular-nums">{inr(g.balance)}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-stone">
            {expired ? "This gift card has expired." : g.status === "redeemed" ? "This gift card has been fully used." : `Worth ${inr(g.amount)}${g.expires_at ? ` · valid until ${date(g.expires_at)}` : ""} · at every ${brand.name} studio`}
          </p>
        </div>

        {!expired && g.status === "active" && (
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button asChild size="lg"><Link href={brandHref("/book")}>Book a ritual</Link></Button>
            <p className="text-sm text-stone">Enter this code when you book online to pay with it, or show it at the studio.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default function Page(props: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<div className="container-page min-h-[60vh] py-24" aria-busy="true" />}>
      <Card {...props} />
    </Suspense>
  );
}

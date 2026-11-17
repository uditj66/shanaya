import type { Metadata } from "next";
import { brand as brandParam } from "next/root-params";
import { BrandImage } from "@/components/brand/brand-image";
import { EnquiryForm } from "@/components/brand/enquiry-form";
import { JsonLd, PageIntro } from "@/components/brand/sections";
import { ClipReveal } from "@/components/motion/clip-reveal";
import { PageTransition } from "@/components/motion/page-transition";
import { getBrand, getStudios } from "@/lib/brand/data";
import { breadcrumbLd } from "@/lib/brand/seo";

export const metadata: Metadata = {
  title: "Gift cards",
  description: "Give an hour of quiet: Lumière gift cards for facials, spa and hair rituals, valid at every studio.",
  alternates: { canonical: "/gift-cards" },
};

const AMOUNTS = [2500, 5000, 10000, 15000].map((a) => ({ value: String(a), label: `₹${a.toLocaleString("en-IN")}` }));

export default async function GiftCardsPage() {
  const slug = await brandParam();
  const [brand, studios] = await Promise.all([getBrand(slug), getStudios(slug)]);
  if (!brand) return null;
  return (
    <PageTransition>
      <JsonLd data={breadcrumbLd(brand, [["Home", "/"], ["Gift cards", "/gift-cards"]])} />
      <PageIntro eyebrow="Gift cards" lines={["Give someone", "an hour of quiet."]} lead="Tell us who it is for and the studio will call you to personalise and complete it. Gift cards are also available at every Lumière studio." />
      <section className="container-page grid gap-12 md:grid-cols-12">
        <div className="md:col-span-5">
          <ClipReveal immediate className="aspect-[4/5]">
            <BrandImage id="gift.card" fill sizes="(min-width: 768px) 40vw, 100vw" />
          </ClipReveal>
          <ul className="mt-8 grid gap-3 text-stone">
            {/* Only facts from the brand policies; terms such as validity are confirmed by the studio when it calls. */}
            {["Available at every Lumière studio", "Choose an amount or ask us to suggest a ritual", "The studio calls you to personalise and complete it"].map((l) => (
              <li key={l} className="flex gap-3">
                <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rotate-45 bg-brass" />
                {l}
              </li>
            ))}
          </ul>
        </div>
        <div className="md:col-span-6 md:col-start-7">
          <EnquiryForm
            brand={slug}
            kind="gift"
            submitLabel="Request this gift card"
            fields={[
              { name: "amount", label: "Amount", type: "chips", options: AMOUNTS },
              { name: "recipient_name", label: "Who is it for?", type: "text", wide: true },
              { name: "message", label: "Your message", type: "textarea", placeholder: "A few words for the card", optional: true },
              { name: "sender_name", label: "Your name", type: "text", autoComplete: "name" },
              { name: "sender_phone", label: "Your mobile", type: "tel", autoComplete: "tel", inputMode: "tel" },
              { name: "sender_email", label: "Your email", type: "email", autoComplete: "email", optional: true },
              { name: "studio", label: "Preferred studio", type: "select", optional: true, options: studios.map((s) => ({ value: s.slug, label: `${s.area}, ${s.city}` })) },
            ]}
          />
        </div>
      </section>
    </PageTransition>
  );
}

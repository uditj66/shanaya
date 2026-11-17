import type { Metadata } from "next";
import Link from "next/link";
import { brand as brandParam } from "next/root-params";
import { EnquiryForm } from "@/components/brand/enquiry-form";
import { JsonLd, PageIntro } from "@/components/brand/sections";
import { PageTransition } from "@/components/motion/page-transition";
import { getBrand, getCities, getStudios } from "@/lib/brand/data";
import { brandHref } from "@/lib/brand/href";
import { breadcrumbLd } from "@/lib/brand/seo";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Lumière: write to the studio team, or find each studio's address and opening hours.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const slug = await brandParam();
  const [brand, studios, cities] = await Promise.all([getBrand(slug), getStudios(slug), getCities(slug)]);
  if (!brand) return null;
  return (
    <PageTransition>
      <JsonLd data={breadcrumbLd(brand, [["Home", "/"], ["Contact", "/contact"]])} />
      <PageIntro eyebrow="Contact" lines={["We'd love", "to hear from you."]} lead="Questions about a treatment, a membership or a past visit? Write to us and the studio team will get back to you. To book, use online booking for the fastest answer." />
      <section className="container-page grid gap-14 md:grid-cols-12">
        <div className="md:col-span-7">
          <EnquiryForm
            brand={slug}
            kind="contact"
            submitLabel="Send message"
            fields={[
              { name: "name", label: "Your name", type: "text", autoComplete: "name" },
              { name: "phone", label: "Mobile number", type: "tel", autoComplete: "tel", inputMode: "tel" },
              { name: "email", label: "Email", type: "email", autoComplete: "email", optional: true },
              { name: "studio", label: "Studio", type: "select", optional: true, options: studios.map((s) => ({ value: s.slug, label: `${s.area}, ${s.city}` })) },
              { name: "message", label: "How can we help?", type: "textarea" },
            ]}
          />
        </div>
        <aside className="md:col-span-4 md:col-start-9">
          <p className="eyebrow">Studios</p>
          <ul className="mt-6 grid gap-5">
            {cities.map(({ city, studios: list }) => (
              <li key={city}>
                <p className="text-charcoal">{city}</p>
                <ul className="mt-1">
                  {list.map((s) => (
                    <li key={s.slug}>
                      <Link href={brandHref(`/studios/${s.slug}`)} className="inline-flex min-h-9 items-center text-stone hover:text-charcoal">
                        {s.area}
                        {s.phone && <span className="ml-3 text-[0.8125rem] tabular-nums">{s.phone}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </aside>
      </section>
    </PageTransition>
  );
}

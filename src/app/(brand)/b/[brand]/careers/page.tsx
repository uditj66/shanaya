import type { Metadata } from "next";
import { brand as brandParam } from "next/root-params";
import { EnquiryForm } from "@/components/brand/enquiry-form";
import { JsonLd, PageIntro } from "@/components/brand/sections";
import { PageTransition } from "@/components/motion/page-transition";
import { Reveal } from "@/components/motion/reveal";
import { getBrand, getCities } from "@/lib/brand/data";
import { breadcrumbLd } from "@/lib/brand/seo";

export const metadata: Metadata = {
  title: "Careers",
  description: "Join Lumière as a skin therapist, aesthetic physician, spa therapist, hair stylist, nail and beauty technician or front-desk host.",
  alternates: { canonical: "/careers" },
};

const ROLES = ["Skin Therapist", "Aesthetic Physician", "Spa Therapist", "Hair Stylist", "Nail & Beauty Technician", "Front-desk Host", "Studio Manager"];

export default async function CareersPage() {
  const slug = await brandParam();
  const [brand, cities] = await Promise.all([getBrand(slug), getCities(slug)]);
  if (!brand) return null;
  return (
    <PageTransition>
      <JsonLd data={breadcrumbLd(brand, [["Home", "/"], ["Careers", "/careers"]])} />
      <PageIntro
        eyebrow="Careers"
        lines={["Do the best work", "of your career."]}
        lead={`We are always glad to meet therapists, physicians, stylists and hosts who care about the details. ${cities.length} cities, one standard, and months of training before you meet a guest.`}
      />
      <section className="container-page grid gap-14 md:grid-cols-12">
        <div className="md:col-span-4">
          <p className="eyebrow">Roles we hire for</p>
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {ROLES.map((r, i) => (
              <Reveal as="li" key={r} index={i} className="display-cut py-4 text-h3">{r}</Reveal>
            ))}
          </ul>
        </div>
        <div className="md:col-span-7 md:col-start-6">
          <EnquiryForm
            brand={slug}
            kind="careers"
            submitLabel="Send application"
            fields={[
              { name: "role", label: "Role", type: "select", options: ROLES.map((r) => ({ value: r, label: r })) },
              { name: "city", label: "City", type: "select", options: cities.map((c) => ({ value: c.city, label: c.city })) },
              { name: "name", label: "Your name", type: "text", autoComplete: "name" },
              { name: "phone", label: "Mobile number", type: "tel", autoComplete: "tel", inputMode: "tel" },
              { name: "email", label: "Email", type: "email", autoComplete: "email" },
              { name: "experience_years", label: "Years of experience", type: "number", inputMode: "numeric", optional: true },
              { name: "message", label: "Tell us about yourself", type: "textarea", optional: true, placeholder: "Where you trained, what you love doing, where you'd like to work" },
            ]}
          />
        </div>
      </section>
    </PageTransition>
  );
}

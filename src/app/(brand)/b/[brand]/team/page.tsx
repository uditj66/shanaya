import type { Metadata } from "next";
import Link from "next/link";
import { brand as brandParam } from "next/root-params";
import { JsonLd, PageIntro } from "@/components/brand/sections";
import { SpecialistPortrait } from "@/components/brand/specialist-portrait";
import { PageTransition } from "@/components/motion/page-transition";
import { Reveal } from "@/components/motion/reveal";
import { getBrand, getCities, getTeam } from "@/lib/brand/data";
import { brandHref } from "@/lib/brand/href";
import { breadcrumbLd } from "@/lib/brand/seo";

export const metadata: Metadata = {
  title: "Specialists",
  description: "Meet the Lumière skin therapists, aesthetic physicians, spa therapists, hair stylists and nail artists at every studio.",
  alternates: { canonical: "/team" },
};

const ROLES = ["Senior Skin Therapist", "Skin Therapist", "Aesthetic Physician", "Spa Therapist", "Hair Stylist", "Nail & Beauty Technician"];

// ISR: the whole team, grouped by city and studio. Anchors (#bandra-west) let studio links jump straight to a team.
export default async function TeamPage() {
  const slug = await brandParam();
  const [brand, team, cities] = await Promise.all([getBrand(slug), getTeam(slug), getCities(slug)]);
  if (!brand) return null;

  return (
    <PageTransition>
      <JsonLd data={breadcrumbLd(brand, [["Home", "/"], ["Specialists", "/team"]])} />
      <PageIntro
        eyebrow="Specialists"
        lines={["Trained for months", "before they meet you."]}
        lead={`${team.length} specialists across ${cities.length} cities: skin therapists, aesthetic physicians, spa therapists, hair stylists and nail artists. Every one trained to the same Lumière standard.`}
      >
        <ul className="mt-10 flex flex-wrap gap-2" aria-label="Roles">
          {ROLES.map((r) => (
            <li key={r} className="rounded-full bg-linen px-4 py-2 text-[0.8125rem] text-stone">{r}</li>
          ))}
        </ul>
      </PageIntro>

      <div className="container-page grid gap-20">
        {cities.map(({ city, studios }) => (
          <section key={city} aria-labelledby={`city-${city}`}>
            <h2 id={`city-${city}`} className="eyebrow border-t border-line pt-8">{city}</h2>
            <div className="mt-8 grid gap-14">
              {studios.map((s) => {
                const people = team.filter((p) => p.studioSlug === s.slug);
                return (
                  <div key={s.slug} id={s.slug} className="scroll-mt-28">
                    <h3 className="display-cut text-h2">
                      <Link href={brandHref(`/studios/${s.slug}`)} className="hover:text-brass-ink">{s.area}</Link>
                    </h3>
                    <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4 lg:grid-cols-7">
                      {people.map((p, i) => (
                        <Reveal as="li" key={p.id} index={i % 7}>
                          <Link href={brandHref(`/studios/${s.slug}/team/${p.slug}`)} className="group block">
                            <div className="relative aspect-[3/4] overflow-hidden rounded-[var(--radius-image)] bg-sand">
                              <SpecialistPortrait name={p.name} title={p.title} portrait={p.portrait} sizes="(min-width: 1024px) 14vw, (min-width: 640px) 24vw, 50vw" className="transition-transform duration-[1.2s] ease-[var(--ease-out-soft)] group-hover:scale-[1.04]" />
                            </div>
                            <p className="display-cut mt-3 text-[1.25rem]">{p.name}</p>
                            <p className="text-[0.8125rem] text-stone">{p.title}</p>
                          </Link>
                        </Reveal>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </PageTransition>
  );
}

import type { Metadata } from "next";
import { privacySections } from "@/content/privacy";

export const metadata: Metadata = { title: "Privacy · Shanaya" };


export default function Privacy() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <p className="text-xs uppercase tracking-[0.35em] text-gold">Shanaya</p>
      <h1 className="mt-3 font-serif text-4xl font-semibold">Privacy notice</h1>
      <p className="mt-3 text-sm text-muted">How the AI receptionist handles your information.</p>
      <div className="mt-10 space-y-8">
        {privacySections.map(([title, items]) => (
          <section key={title}>
            <h2 className="font-serif text-2xl font-semibold">{title}</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
              {items.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>
        ))}
        <section>
          <h2 className="font-serif text-2xl font-semibold">Contact</h2>
          <p className="mt-2 text-sm">For privacy requests, speak to the front desk of the branch you visited. Salons using Shanaya should add their grievance officer&apos;s contact details here before going live.</p>
        </section>
      </div>
    </main>
  );
}

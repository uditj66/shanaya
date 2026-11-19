import type { Metadata } from "next";
import { privacySections } from "@/content/privacy";

export const metadata: Metadata = { title: "Privacy · Shanaya" };


export default function Privacy() {
  return (
    <main className="mx-auto max-w-prose px-6 py-14">
      <p className="text-xs font-medium text-muted-foreground">Shanaya</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Privacy notice</h1>
      <p className="mt-2 text-sm text-muted-foreground">How the AI receptionist handles your information.</p>
      <div className="mt-10 space-y-8">
        {privacySections.map(([title, items]) => (
          <section key={title}>
            <h2 className="text-lg font-semibold">{title}</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
              {items.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>
        ))}
        <section>
          <h2 className="text-lg font-semibold">Contact</h2>
          <p className="mt-2 text-sm leading-relaxed">For privacy requests, speak to the front desk of the branch you visited. Salons using Shanaya should add their grievance officer&apos;s contact details here before going live.</p>
        </section>
      </div>
    </main>
  );
}

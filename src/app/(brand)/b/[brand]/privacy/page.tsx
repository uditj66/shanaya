import type { Metadata } from "next";
import { PageIntro } from "@/components/brand/sections";
import { PageTransition } from "@/components/motion/page-transition";
import { privacySections } from "@/content/privacy";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "How Lumière and its booking assistant handle your personal information.",
  alternates: { canonical: "/privacy" },
};

// SSG: static text.
export default function PrivacyPage() {
  return (
    <PageTransition>
      <PageIntro eyebrow="Privacy" lines={["Your details,", "handled with care."]} lead="How we use the information you share when you book, chat or call." />
      <div className="container-page max-w-3xl">
        {privacySections.map(([title, items]) => (
          <section key={title} className="border-t border-line py-10">
            <h2 className="display-cut text-h3">{title}</h2>
            <ul className="mt-4 grid gap-3 text-stone">
              {items.map((t) => (
                <li key={t} className="flex gap-3">
                  <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rotate-45 bg-brass" />
                  {t}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <section className="border-t border-line py-10">
          <h2 className="display-cut text-h3">Contact</h2>
          <p className="mt-4 text-stone">For privacy requests, speak to the front desk of the studio you visited, or write to us through the contact page.</p>
        </section>
      </div>
    </PageTransition>
  );
}

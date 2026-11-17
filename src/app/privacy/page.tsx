import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy · Shanaya" };

const sections: [string, string[]][] = [
  [
    "Who we are",
    [
      "Shanaya is the AI receptionist used by the salons and spas listed on this site (for example Lumière Facial Studio & Spa) to answer calls and website chats and to manage bookings. Each salon is responsible for the bookings made with it.",
    ],
  ],
  [
    "What we collect",
    [
      "Your name and mobile number, and optionally your email.",
      "Your bookings: treatment, branch, date, time, therapist and any notes you share (for example skin concerns or allergies).",
      "Conversations with Shanaya: chat messages, and for voice calls an audio recording, transcript and summary.",
      "Technical data needed to run the service, such as approximate request information used to prevent abuse.",
    ],
  ],
  [
    "Why we use it",
    [
      "To book, change and remind you about appointments, and to let you request a call-back.",
      "To let the salon's team see your booking, preferences and past visits so they can serve you well (for example booking the same therapist again).",
      "To check quality and fix mistakes in Shanaya's answers.",
      "We do not sell your data or use it for unrelated advertising.",
    ],
  ],
  [
    "AI and recordings",
    [
      "Shanaya is an AI assistant, and she tells you so. Voice calls may be recorded for quality and booking purposes; if you prefer not to be recorded, say so and ask for a call-back from the studio team, or call the branch directly.",
      "Shanaya never gives medical advice. Medical and advanced aesthetic treatments are arranged through a consultation with a qualified professional.",
    ],
  ],
  [
    "Who processes it",
    [
      "We use trusted service providers to run Shanaya: hosting and database (Vercel, Supabase), voice calling (Vapi and its speech and voice partners) and AI language models (OpenAI). They process data only to provide these services.",
    ],
  ],
  [
    "How long we keep it",
    [
      "Booking records are kept while you are a guest of the salon and as required for accounting.",
      "Call recordings and transcripts are kept for up to 12 months unless the salon needs them longer to resolve a complaint.",
    ],
  ],
  [
    "Your rights",
    [
      "You can ask to see, correct or delete your personal data, or withdraw consent, as provided under India's Digital Personal Data Protection Act, 2023. Contact the salon's front desk or the contact below and we will respond within a reasonable time.",
    ],
  ],
];

export default function Privacy() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <p className="text-xs uppercase tracking-[0.35em] text-gold">Shanaya</p>
      <h1 className="mt-3 font-serif text-4xl font-semibold">Privacy notice</h1>
      <p className="mt-3 text-sm text-muted">How the AI receptionist handles your information.</p>
      <div className="mt-10 space-y-8">
        {sections.map(([title, items]) => (
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

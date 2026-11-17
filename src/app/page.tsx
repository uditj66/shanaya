import { ButtonLink } from "@/components/ui";

const points = [
  ["Answers every call", "Day, night and on your busiest Saturday. No more missed bookings going to the salon down the road."],
  ["Books into your real calendar", "Checks each therapist's hours, skills and breaks, and can never double-book."],
  ["Your team stays in control", "Live calendar, call summaries and recordings, and a call-back list for anything the AI shouldn't handle."],
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <p className="text-xs uppercase tracking-[0.35em] text-gold">Shanaya</p>
      <h1 className="mt-4 max-w-3xl font-serif text-5xl leading-tight font-semibold md:text-6xl">The AI receptionist for premium salons and spas.</h1>
      <p className="mt-6 max-w-2xl text-lg text-muted">
        Shanaya picks up the phone and chats on your website, recommends the right treatment, and books it straight into your studio calendar.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/login">Open dashboard</ButtonLink>
        <ButtonLink href="/w/lumiere" variant="outline">Try the demo assistant</ButtonLink>
        <ButtonLink href="/privacy" variant="ghost">Privacy</ButtonLink>
      </div>
      <div className="mt-16 grid gap-4 md:grid-cols-3">
        {points.map(([t, d]) => (
          <div key={t} className="rounded-2xl border border-line bg-white p-6">
            <h2 className="font-serif text-2xl font-semibold">{t}</h2>
            <p className="mt-2 text-sm text-muted">{d}</p>
          </div>
        ))}
      </div>
    </main>
  );
}

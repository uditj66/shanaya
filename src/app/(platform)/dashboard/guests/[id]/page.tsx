import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import { requireArea } from "@/lib/session";
import { Badge, Card, Empty, PageHeader, Stat, money } from "@/components/dashboard-ui";
import { GuestForm } from "./guest-form";

/** Past visits (not cancelled) and upcoming confirmed bookings, soonest first. Runs at request time (dynamic page). */
function splitVisits<B extends { starts_at: string; status: string }>(bookings: B[]) {
  const now = Date.now();
  return {
    past: bookings.filter((b) => Date.parse(b.starts_at) < now && b.status !== "cancelled"),
    upcoming: bookings.filter((b) => Date.parse(b.starts_at) >= now && b.status === "confirmed").reverse(),
  };
}

async function Guest({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireArea("guests");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: g } = await s.supabase.from("customers").select("*").eq("id", id).maybeSingle();
  if (!g) notFound();
  const tz = s.salon.timezone;

  const [{ data: bookings }, { data: calls }] = await Promise.all([
    s.supabase
      .from("bookings")
      .select("id, reference, starts_at, status, source, price, notes, salon_id, staff:staff_id (id, name), service:service_id (name)")
      .eq("customer_id", g.id)
      .order("starts_at", { ascending: false })
      .limit(50),
    s.supabase.from("calls").select("id, channel, created_at, outcome, summary").or(`customer_id.eq.${g.id},customer_phone.eq.${g.phone}`).order("created_at", { ascending: false }).limit(10),
  ]);
  // A therapist can only open guests they treat.
  if (s.role === "stylist" && !(bookings ?? []).some((b) => b.staff?.id === s.staffId)) notFound();

  const { past, upcoming } = splitVisits(bookings ?? []);
  const spend = past.filter((b) => b.status !== "no_show").reduce((t, b) => t + Number(b.price), 0);
  const fav = Object.entries(past.reduce<Record<string, number>>((m, b) => (b.staff?.name ? ((m[b.staff.name] = (m[b.staff.name] ?? 0) + 1), m) : m), {})).sort((a, b) => b[1] - a[1])[0];
  const studio = (sid: string) => s.salons.find((x) => x.id === sid)?.area ?? "";

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Guest"
        title={g.name}
        subtitle={`+${g.phone}${g.email ? ` · ${g.email}` : ""} · guest since ${formatInTimeZone(new Date(g.created_at), tz, "MMM yyyy")}`}
        action={s.role !== "stylist" ? <Link href={`/dashboard/bookings/new?phone=${g.phone}&name=${encodeURIComponent(g.name)}` as Route} className="inline-flex min-h-10 items-center rounded-full bg-charcoal px-4 text-sm text-ivory">Book again</Link> : null}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Visits" value={past.length} />
        <Stat label="Spend" value={money(spend, s.salon.currency)} />
        <Stat label="Favourite therapist" value={fav ? fav[0] : "—"} hint={fav ? `${fav[1]} visit${fav[1] === 1 ? "" : "s"}` : undefined} />
        <Stat label="Next visit" value={upcoming[0] ? formatInTimeZone(new Date(upcoming[0].starts_at), tz, "d MMM") : "—"} hint={upcoming[0]?.service?.name} />
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <h2 className="display-cut text-[1.375rem]">Visits</h2>
          {bookings?.length ? (
            <ul className="mt-3 divide-y divide-line">
              {bookings.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{b.service?.name}</p>
                    <p className="text-xs text-stone">
                      {formatInTimeZone(new Date(b.starts_at), tz, "EEE d MMM yyyy, h:mm a")}
                      {b.staff?.name ? ` · ${b.staff.name}` : ""}
                      {s.salons.length > 1 ? ` · ${studio(b.salon_id)}` : ""}
                      {` · ref ${b.reference}`}
                    </p>
                    {b.notes && <p className="mt-1 text-xs text-stone">“{b.notes}”</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-stone">{money(b.price, s.salon.currency)}</span>
                    <Badge tone={b.status}>{b.status}</Badge>
                    {b.source !== "staff" && <Badge tone={b.source}>{b.source}</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No bookings yet.</Empty>
          )}
        </Card>

        <div className="grid content-start gap-6 xl:col-span-2">
          <Card>
            <h2 className="display-cut text-[1.375rem]">Profile</h2>
            <div className="mt-4">
              <GuestForm g={{ id: g.id, name: g.name, email: g.email, tags: g.tags, preferences: g.preferences, notes: g.notes }} readOnly={s.role === "stylist"} />
            </div>
          </Card>
          <Card>
            <h2 className="display-cut text-[1.375rem]">Conversations</h2>
            {calls?.length ? (
              <ul className="mt-3 divide-y divide-line text-sm">
                {calls.map((c) => (
                  <li key={c.id} className="py-2.5">
                    <Link href={`/dashboard/inbox?id=${c.id}` as Route} className="flex items-center justify-between gap-3 hover:underline">
                      <span>{c.channel === "phone" ? "Phone call" : "Website chat"} · {formatInTimeZone(new Date(c.created_at), tz, "d MMM, h:mm a")}</span>
                      {c.outcome && <Badge tone={c.outcome}>{c.outcome}</Badge>}
                    </Link>
                    {c.summary && <p className="mt-1 line-clamp-2 text-xs text-stone">{c.summary}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-stone">No calls or chats linked to this guest.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function Page(props: Parameters<typeof Guest>[0]) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <Guest {...props} />
    </Suspense>
  );
}

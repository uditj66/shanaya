import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarCheck, CalendarClock, CalendarPlus, Heart, IndianRupee } from "lucide-react";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import { requireArea } from "@/lib/session";
import { ButtonLink, EmptyState, PageHeader, Section, StatCard, StatusBadge, money } from "@/components/admin/kit";
import { GuestForm } from "./guest-form";
import { MemoryPanel, type PanelNote } from "./memory-panel";
import { parseNotes, tidyNotes } from "@/lib/agent/guest-memory";
import { todayIn } from "@/lib/time";

/** Past visits (not cancelled) and upcoming confirmed bookings, soonest first. Runs at request time (dynamic page). */
function splitVisits<B extends { starts_at: string; status: string }>(bookings: B[], membership?: { tier_name: string; ends_at: string | null }) {
  const now = Date.now();
  return {
    member: membership?.ends_at && Date.parse(membership.ends_at) > now ? membership : null,
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

  const [{ data: bookings }, { data: memberships }, { data: memoryRows }] = await Promise.all([
    s.supabase
      .from("bookings")
      .select("id, reference, starts_at, status, source, price, notes, salon_id, call_id, guest_name, staff:staff_id (id, name), service:service_id (name)")
      .eq("customer_id", g.id)
      .order("starts_at", { ascending: false })
      .limit(50),
    // Memberships bought online, matched by mobile number across the brand.
    s.supabase.from("membership_purchases").select("tier_name, ends_at").eq("phone", g.phone).eq("status", "active").order("ends_at", { ascending: false }).limit(1),
    // What Shanaya remembers about her (one row per brand, on the branch of her latest call).
    s.supabase.from("guest_memory").select("notes, opted_out").eq("phone", g.phone).order("updated_at", { ascending: false }).limit(1),
  ]);
  // Her conversations: calls she made (by guest or number, which phone calls store as "+91…"), and calls where
  // someone else booked her in ("book my sister-in-law").
  const bookedOn = [...new Set((bookings ?? []).map((b) => b.call_id).filter((x): x is string => !!x))];
  const { data: calls } = await s.supabase
    .from("calls")
    .select("id, channel, external_id, created_at, outcome, summary")
    .or([`customer_id.eq.${g.id}`, `customer_phone.eq.${g.phone}`, `customer_phone.eq.+${g.phone}`, ...(bookedOn.length ? [`id.in.(${bookedOn.join(",")})`] : [])].join(","))
    .order("created_at", { ascending: false })
    .limit(10);
  const today = todayIn(tz);
  const memory = memoryRows?.[0];
  const memoryNotes: PanelNote[] = tidyNotes(parseNotes(memory?.notes), today).map((n) => ({
    text: n.text,
    kind: n.kind,
    when: n.until ? formatInTimeZone(new Date(`${n.until}T12:00:00Z`), tz, "d MMM yyyy") : null,
    past: !!n.until && n.until < today,
    added: formatInTimeZone(new Date(n.at), tz, "d MMM yyyy"),
  }));
  // A therapist can only open guests they treat.
  if (s.role === "stylist" && !(bookings ?? []).some((b) => b.staff?.id === s.staffId)) notFound();

  const { past, upcoming, member } = splitVisits(bookings ?? [], memberships?.[0]);
  const spend = past.filter((b) => b.status !== "no_show").reduce((t, b) => t + Number(b.price), 0);
  const fav = Object.entries(past.reduce<Record<string, number>>((m, b) => (b.staff?.name ? ((m[b.staff.name] = (m[b.staff.name] ?? 0) + 1), m) : m), {})).sort((a, b) => b[1] - a[1])[0];
  const studio = (sid: string) => s.salons.find((x) => x.id === sid)?.area ?? "";

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Guest"
        title={g.name}
        description={`+${g.phone}${g.email ? ` · ${g.email}` : ""} · guest since ${formatInTimeZone(new Date(g.created_at), tz, "MMM yyyy")}${member ? ` · ${member.tier_name} member until ${formatInTimeZone(new Date(member.ends_at!), tz, "d MMM yyyy")}` : ""}`}
        actions={
          s.role !== "stylist" ? (
            <ButtonLink href={`/dashboard/bookings/new?phone=${g.phone}&name=${encodeURIComponent(g.name)}` as Route}>
              <CalendarPlus aria-hidden /> Book again
            </ButtonLink>
          ) : null
        }
      />
      <section aria-label="Guest at a glance" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={CalendarCheck} label="Visits" value={past.length} />
        <StatCard icon={IndianRupee} label="Spend" value={money(spend, s.salon.currency)} />
        <StatCard icon={Heart} label="Favourite therapist" value={fav ? fav[0] : "—"} hint={fav ? `${fav[1]} visit${fav[1] === 1 ? "" : "s"}` : undefined} />
        <StatCard icon={CalendarClock} label="Next visit" value={upcoming[0] ? formatInTimeZone(new Date(upcoming[0].starts_at), tz, "d MMM") : "—"} hint={upcoming[0]?.service?.name} />
      </section>

      <div className="grid gap-6 xl:grid-cols-5">
        <Section className="xl:col-span-3" title="Visits">
          {bookings?.length ? (
            <ul className="-my-3 divide-y">
              {bookings.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {b.service?.name}
                      {b.guest_name && <span className="font-normal text-muted-foreground"> · for {b.guest_name}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatInTimeZone(new Date(b.starts_at), tz, "EEE d MMM yyyy, h:mm a")}
                      {b.staff?.name ? ` · ${b.staff.name}` : ""}
                      {s.salons.length > 1 ? ` · ${studio(b.salon_id)}` : ""}
                      {` · ref ${b.reference}`}
                    </p>
                    {b.notes && <p className="mt-1 text-xs text-muted-foreground">“{b.notes}”</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular text-muted-foreground">{money(b.price, s.salon.currency)}</span>
                    <StatusBadge status={b.status} />
                    {b.source !== "staff" && <StatusBadge status={b.source} />}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={CalendarCheck} title="No bookings yet" />
          )}
        </Section>

        <div className="grid content-start gap-6 xl:col-span-2">
          <Section title="Profile">
            <GuestForm g={{ id: g.id, name: g.name, email: g.email, tags: g.tags, preferences: g.preferences, notes: g.notes }} readOnly={s.role === "stylist"} />
          </Section>
          <Section title="What Shanaya remembers" description="Learned from her calls. Shanaya uses these to greet her like a regular.">
            <MemoryPanel customerId={g.id} notes={memoryNotes} optedOut={!!memory?.opted_out} readOnly={s.role === "stylist"} />
          </Section>
          <Section title="Conversations">
            {calls?.length ? (
              <ul className="-my-2.5 divide-y text-sm">
                {calls.map((c) => (
                  <li key={c.id} className="py-2.5">
                    <Link href={`/dashboard/inbox?id=${c.id}` as Route} className="flex items-center justify-between gap-3 hover:underline">
                      <span>
                        {/* website voice calls come from Vapi (they have an external id); typed chats don't */}
                        {c.channel === "phone" ? "Phone call" : c.external_id ? "Website call" : "Website chat"} · {formatInTimeZone(new Date(c.created_at), tz, "d MMM, h:mm a")}
                      </span>
                      {c.outcome && <StatusBadge status={c.outcome} />}
                    </Link>
                    {c.summary && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.summary}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No calls or chats linked to this guest.</p>
            )}
          </Section>
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

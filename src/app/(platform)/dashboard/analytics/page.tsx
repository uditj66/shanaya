import { Suspense } from "react";
import type { Route } from "next";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarCheck, MessageSquare, MousePointerClick, Users } from "lucide-react";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import { requireArea } from "@/lib/session";
import { addDays, todayIn, zonedToDate } from "@/lib/time";
import { SOURCES, type Source } from "@/lib/dashboard/overview";
import { Meter, PageHeader, Section, StatCard, money, SegmentedNav } from "@/components/admin/kit";
import { BookingsByChannel, CHANNEL_COLORS, CHANNEL_LABELS } from "../overview-charts";
import { VisitorsChart } from "./visitors-chart";

const RANGES = { "7": "7 days", "30": "30 days", "90": "90 days" } as const;
const FUNNEL = ["Opened booking", "Chose a treatment", "Chose a studio", "Chose a time", "Booked"];
type Stats = {
  visitors: number; views: number; chat_sessions: number; chat_booked: number; booked_sessions: number;
  daily: { day: string; visitors: number; views: number }[]; pages: { path: string; views: number }[]; funnel: number[];
};
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

async function Analytics({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const s = await requireArea("analytics");
  const { d: raw } = await searchParams;
  const range = (raw && raw in RANGES ? raw : "30") as keyof typeof RANGES;
  const n = Number(range);
  const tz = s.salon.timezone;
  const today = todayIn(tz);
  const sinceDay = addDays(today, -(n - 1));
  const since = zonedToDate(sinceDay, "00:00", tz).toISOString();

  const [statsRes, { data: bookings }, { data: chats }] = await Promise.all([
    s.salon.brand_id ? s.supabase.rpc("site_stats", { p_brand: s.salon.brand_id, p_since: since, p_tz: tz }) : Promise.resolve({ data: null }),
    s.supabase.from("bookings").select("created_at, source, price, status").in("salon_id", s.scopeIds).gte("created_at", since).limit(20000),
    s.supabase.from("calls").select("outcome").in("salon_id", s.scopeIds).eq("channel", "web").gte("created_at", since).limit(20000),
  ]);
  const st = (statsRes.data ?? null) as Stats | null;

  // Bookings made per day, by channel, across the range.
  const days = Array.from({ length: n }, (_, i) => addDays(sinceDay, i));
  const label = (d: string) => formatInTimeZone(new Date(`${d}T12:00:00Z`), "UTC", "d MMM");
  const series = days.map((d) => ({ date: d, label: label(d), phone: 0, web: 0, staff: 0 }));
  const byDay = new Map(series.map((r) => [r.date, r]));
  const totals = Object.fromEntries(SOURCES.map((k) => [k, { count: 0, value: 0 }])) as Record<Source, { count: number; value: number }>;
  for (const b of bookings ?? []) {
    const row = byDay.get(formatInTimeZone(new Date(b.created_at), tz, "yyyy-MM-dd"));
    if (row) row[b.source as Source] += 1;
    totals[b.source as Source].count += 1;
    if (b.status !== "cancelled") totals[b.source as Source].value += Number(b.price);
  }
  const allBookings = SOURCES.reduce((t, k) => t + totals[k].count, 0);
  const visitors = days.map((d) => {
    const r = st?.daily.find((x) => x.day === d);
    return { label: label(d), visitors: r?.visitors ?? 0, views: r?.views ?? 0 };
  });
  const chatTotal = chats?.length ?? 0;
  const chatBooked = (chats ?? []).filter((c) => c.outcome === "booked").length;
  const funnel = st?.funnel ?? [0, 0, 0, 0, 0];

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={s.isAll ? `All ${s.scopeIds.length} studios` : (s.salon.area ?? "")}
        title="Analytics"
        description="Website traffic and the booking funnel are brand-wide; bookings and chats follow the studio selector."
        actions={
          <SegmentedNav label="Date range" items={Object.entries(RANGES).map(([k, l]) => ({ href: `/dashboard/analytics?d=${k}` as Route, label: l, active: k === range }))} />
        }
      />

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Website visitors" value={st?.visitors ?? 0} hint={`${st?.views ?? 0} page views`} />
        <StatCard
          icon={MousePointerClick}
          label="Website booking rate"
          value={`${pct(st?.booked_sessions ?? 0, st?.visitors ?? 0)}%`}
          hint={`${st?.booked_sessions ?? 0} visits ended in a booking`}
        />
        <StatCard icon={MessageSquare} label="Chat to booking" value={`${pct(chatBooked, chatTotal)}%`} hint={`${chatBooked} of ${chatTotal} chats booked`} />
        <StatCard icon={CalendarCheck} label="Bookings made" value={allBookings} hint={`${RANGES[range]}, all channels`} />
      </section>

      <div className="grid gap-6 xl:grid-cols-5">
        <Section className="xl:col-span-3" title="Website visitors" description="Unique visits per day. No cookies; visitors who opt out of tracking aren't counted.">
          <VisitorsChart data={visitors} />
        </Section>
        <Section className="xl:col-span-2" title="Booking funnel" description="Website visits reaching each step of the booking page.">
          <ol className="grid gap-3">
            {FUNNEL.map((name, i) => (
              <li key={name} className="text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span>{name}</span>
                  <span className="tabular text-muted-foreground">
                    <span className="text-foreground">{funnel[i]}</span>
                    {i > 0 && ` · ${pct(funnel[i], funnel[0])}%`}
                  </span>
                </div>
                <Meter pct={Math.max(funnel[i] ? 2 : 0, pct(funnel[i], Math.max(1, funnel[0])))} color={CHANNEL_COLORS.web} />
              </li>
            ))}
          </ol>
          {st && st.chat_sessions > 0 && (
            <p className="mt-5 border-t pt-4 text-sm text-muted-foreground">
              <span className="tabular text-foreground">{st.chat_sessions}</span> visits used the concierge;{" "}
              <span className="tabular text-foreground">{st.chat_booked}</span> of them booked on the website ({pct(st.chat_booked, st.chat_sessions)}%).
            </p>
          )}
        </Section>
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Section className="xl:col-span-3" title="Bookings by channel" description="When each booking was made, and where it came from.">
          <BookingsByChannel data={series} />
        </Section>
        <Section className="xl:col-span-2" title="Channel mix">
          <ul className="grid gap-4">
            {SOURCES.map((k) => (
              <li key={k} className="text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: CHANNEL_COLORS[k] }} />
                    {CHANNEL_LABELS[k]}
                  </span>
                  <span className="tabular text-muted-foreground">
                    <span className="text-foreground">{totals[k].count}</span> · {pct(totals[k].count, allBookings)}%
                  </span>
                </div>
                <Meter pct={pct(totals[k].count, allBookings)} color={CHANNEL_COLORS[k]} />
                <p className="mt-1 text-xs text-muted-foreground">{money(totals[k].value, s.salon.currency)} booked value</p>
              </li>
            ))}
          </ul>
          <h3 className="mt-6 border-t pt-4 text-sm font-semibold">Most viewed pages</h3>
          {st?.pages.length ? (
            <ol className="mt-2 grid gap-1.5 text-sm">
              {st.pages.map((p) => (
                <li key={p.path} className="flex justify-between gap-3">
                  <span className="truncate text-muted-foreground">{p.path}</span>
                  <span className="tabular">{p.views}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No website visits recorded yet.</p>
          )}
        </Section>
      </div>
    </div>
  );
}

export default function Page(props: Parameters<typeof Analytics>[0]) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <Analytics {...props} />
    </Suspense>
  );
}

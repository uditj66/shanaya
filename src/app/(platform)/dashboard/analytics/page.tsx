import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import { formatInTimeZone } from "date-fns-tz";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import { requireArea } from "@/lib/session";
import { addDays, todayIn, zonedToDate } from "@/lib/time";
import { SOURCES, type Source } from "@/lib/dashboard/overview";
import { Card, PageHeader, Stat, money } from "@/components/dashboard-ui";
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
        subtitle="Website traffic and the booking funnel are brand-wide; bookings and chats follow the studio selector."
        action={
          <nav className="flex gap-1.5 text-sm" aria-label="Date range">
            {Object.entries(RANGES).map(([k, l]) => (
              <Link key={k} href={`/dashboard/analytics?d=${k}` as Route} aria-current={k === range ? "page" : undefined} className={`rounded-full px-3 py-1.5 ${k === range ? "bg-charcoal text-ivory" : "text-stone ring-1 ring-line hover:text-charcoal"}`}>
                {l}
              </Link>
            ))}
          </nav>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Website visitors" value={st?.visitors ?? 0} hint={`${st?.views ?? 0} page views`} />
        <Stat label="Website booking rate" value={`${pct(st?.booked_sessions ?? 0, st?.visitors ?? 0)}%`} hint={`${st?.booked_sessions ?? 0} visits ended in a booking`} />
        <Stat label="Chat to booking" value={`${pct(chatBooked, chatTotal)}%`} hint={`${chatBooked} of ${chatTotal} chats booked`} />
        <Stat label="Bookings made" value={allBookings} hint={`${RANGES[range]}, all channels`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <h2 className="display-cut text-[1.375rem]">Website visitors</h2>
          <p className="mb-4 text-xs text-stone">Unique visits per day. No cookies; visitors who opt out of tracking aren&apos;t counted.</p>
          <VisitorsChart data={visitors} />
        </Card>
        <Card className="xl:col-span-2">
          <h2 className="display-cut text-[1.375rem]">Booking funnel</h2>
          <p className="mb-4 text-xs text-stone">Website visits reaching each step of the booking page.</p>
          <ol className="grid gap-3">
            {FUNNEL.map((name, i) => (
              <li key={name} className="text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span>{name}</span>
                  <span className="tabular-nums text-stone">
                    <span className="text-charcoal">{funnel[i]}</span>
                    {i > 0 && ` · ${pct(funnel[i], funnel[0])}%`}
                  </span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-linen" aria-hidden="true">
                  <div className="h-2 rounded-full" style={{ width: `${Math.max(funnel[i] ? 2 : 0, pct(funnel[i], Math.max(1, funnel[0])))}%`, background: CHANNEL_COLORS.web }} />
                </div>
              </li>
            ))}
          </ol>
          {st && st.chat_sessions > 0 && (
            <p className="mt-5 border-t border-line pt-4 text-sm text-stone">
              <span className="text-charcoal tabular-nums">{st.chat_sessions}</span> visits used the concierge; <span className="text-charcoal tabular-nums">{st.chat_booked}</span> of them booked on the website ({pct(st.chat_booked, st.chat_sessions)}%).
            </p>
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <h2 className="display-cut text-[1.375rem]">Bookings by channel</h2>
          <p className="mb-4 text-xs text-stone">When each booking was made, and where it came from.</p>
          <BookingsByChannel data={series} />
        </Card>
        <Card className="xl:col-span-2">
          <h2 className="display-cut text-[1.375rem]">Channel mix</h2>
          <ul className="mt-4 grid gap-4">
            {SOURCES.map((k) => (
              <li key={k} className="text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex items-center gap-2"><span aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: CHANNEL_COLORS[k] }} />{CHANNEL_LABELS[k]}</span>
                  <span className="tabular-nums text-stone"><span className="text-charcoal">{totals[k].count}</span> · {pct(totals[k].count, allBookings)}%</span>
                </div>
                <p className="mt-0.5 pl-[1.125rem] text-xs text-stone">{money(totals[k].value, s.salon.currency)} booked value</p>
              </li>
            ))}
          </ul>
          <h3 className="mt-6 border-t border-line pt-4 text-sm font-medium">Most viewed pages</h3>
          {st?.pages.length ? (
            <ol className="mt-2 grid gap-1.5 text-sm">
              {st.pages.map((p) => (
                <li key={p.path} className="flex justify-between gap-3"><span className="truncate text-stone">{p.path}</span><span className="tabular-nums">{p.views}</span></li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-stone">No website visits recorded yet.</p>
          )}
        </Card>
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

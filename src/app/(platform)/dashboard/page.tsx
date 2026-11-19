import { Suspense } from "react";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import Link from "next/link";
import type { Route } from "next";
import { formatInTimeZone } from "date-fns-tz";
import { ArrowUpRight, CalendarPlus } from "lucide-react";
import { requireArea } from "@/lib/session";
import { loadOverview } from "@/lib/dashboard/overview";
import { Badge, ButtonLink, Card, Empty, Stat, money } from "@/components/dashboard-ui";
import { BookingsByChannel, CHANNEL_COLORS } from "./overview-charts";

// SSR inside the dashboard's Suspense boundary: live numbers for the signed-in person's studios.
async function OverviewPage() {
  const s = await requireArea("overview");
  const o = await loadOverview(s);
  const hour = Number(formatInTimeZone(new Date(), o.tz, "H"));
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = s.user.email?.split("@")[0] ?? "";
  const scopeLabel = s.isAll ? `All ${s.scopeIds.length} studios` : (s.salon.area ?? s.salon.name);
  const chatRate = o.chats.total ? Math.round((o.chats.booked / o.chats.total) * 100) : 0;

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{scopeLabel} · {formatInTimeZone(new Date(), o.tz, "EEEE d MMMM")}</p>
          <h1 className="display-cut mt-2 text-[2rem] leading-tight md:text-[2.5rem]">
            {hello}
            {name && <span className="capitalize">, {name}</span>}.
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink variant="outline" href="/dashboard/calendar">Open calendar</ButtonLink>
          {s.role !== "stylist" && (
            <ButtonLink href={`/dashboard/bookings/new?date=${o.today}`}>
              <CalendarPlus strokeWidth={1.5} /> New booking
            </ButtonLink>
          )}
        </div>
      </div>

      <section aria-label="Today at a glance" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label={s.role === "stylist" ? "Your appointments" : "Appointments today"} value={o.appointments} hint={o.appointments ? `${o.byAi} booked by Shanaya` : undefined} />
        <Stat label="Booked value today" value={money(o.bookedValue, s.salon.currency)} />
        <Stat label="Occupancy today" value={`${o.occupancyPct}%`} hint="treatment time ÷ rostered time" />
        <Link href={"/dashboard/leads" as Route} className="rounded-2xl focus-visible:outline-2">
          <Stat label="New leads" value={o.leads.filter((l) => l.status === "new").length} hint="from the website" />
        </Link>
        <Link href="/dashboard/callbacks" className="col-span-2 rounded-2xl lg:col-span-1">
          <Stat label="Call-backs waiting" value={o.openCallbacks} />
        </Link>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="display-cut text-[1.375rem]">Bookings made, last 14 days</h2>
            <p className="text-xs text-stone">by channel</p>
          </div>
          <div className="mt-4">
            <BookingsByChannel data={o.series} />
          </div>
        </Card>

        <Card>
          <div className="flex items-baseline justify-between">
            <h2 className="display-cut text-[1.375rem]">Next up</h2>
            <Link href="/dashboard/calendar" className="text-xs text-stone hover:text-charcoal">Calendar →</Link>
          </div>
          {o.upcoming.length ? (
            <ol className="mt-4 divide-y divide-line">
              {o.upcoming.map((b) => (
                <li key={b.id} className="flex items-start gap-3 py-3">
                  <span className="w-16 shrink-0 pt-0.5 text-sm font-medium tabular-nums">{b.time}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {b.guestId ? <Link href={`/dashboard/guests/${b.guestId}` as Route} className="hover:underline">{b.guest}</Link> : b.guest}
                    </p>
                    <p className="truncate text-xs text-stone">
                      {b.service}
                      {b.staff ? ` · ${b.staff}` : ""}
                      {s.isAll && b.studio ? ` · ${b.studio}` : ""}
                    </p>
                  </div>
                  {b.source !== "staff" && (
                    <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: CHANNEL_COLORS[b.source as "phone" | "web"] }} title={`Booked by Shanaya (${b.source})`} aria-label={`Booked by Shanaya by ${b.source}`} />
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <Empty>No more appointments today.</Empty>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <h2 className="display-cut text-[1.375rem]">Top treatments</h2>
          <p className="text-xs text-stone">appointments, last 30 days</p>
          {o.topTreatments.length ? (
            <ul className="mt-4 grid gap-3">
              {o.topTreatments.map((t) => (
                <li key={t.name}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="truncate">{t.name}</span>
                    <span className="tabular-nums text-stone">{t.count}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-linen" aria-hidden>
                    <div className="h-2 rounded-full bg-[#a96a24]" style={{ width: `${(t.count / o.topTreatments[0].count) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No appointments yet.</Empty>
          )}
        </Card>

        <Card>
          <h2 className="display-cut text-[1.375rem]">{s.isAll ? "Occupancy by studio" : "Occupancy today"}</h2>
          <p className="text-xs text-stone">booked treatment time ÷ rostered therapist time</p>
          <ul className="mt-4 grid max-h-72 gap-3 overflow-y-auto pr-1">
            {o.occupancy.map((st) => (
              <li key={st.id}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="truncate">{st.studio}</span>
                  <span className="tabular-nums text-stone">{st.rostered ? `${st.pct}%` : "closed"}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-linen" aria-hidden>
                  <div className="h-2 rounded-full bg-[#1a86ab]" style={{ width: `${st.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="flex items-baseline justify-between">
            <h2 className="display-cut text-[1.375rem]">Shanaya this month</h2>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs text-stone">Website chats</dt>
              <dd className="display-cut text-[1.75rem] tabular-nums">{o.chats.total}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone">Chats → bookings</dt>
              <dd className="display-cut text-[1.75rem] tabular-nums">{chatRate}%</dd>
            </div>
            <div>
              <dt className="text-xs text-stone">Phone calls</dt>
              <dd className="display-cut text-[1.75rem] tabular-nums">{o.chats.calls}</dd>
            </div>
          </dl>
          <h3 className="mt-6 text-xs font-medium text-stone">Latest leads</h3>
          {o.leads.length ? (
            <ul className="mt-2 divide-y divide-line">
              {o.leads.slice(0, 3).map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate">{l.name}</span>
                    <span className="block truncate text-xs text-stone">{l.message}</span>
                  </span>
                  <Badge tone={l.status}>{l.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-stone">No leads yet.</p>
          )}
          <Link href={"/dashboard/leads" as Route} className="mt-3 inline-flex items-center gap-1 text-xs text-stone hover:text-charcoal">
            All leads <ArrowUpRight className="size-3" />
          </Link>
        </Card>
      </div>
    </div>
  );
}

// The page's live data streams inside its own Suspense boundary (instant navigation; Cache Components best practice).
export default function Page() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <OverviewPage />
    </Suspense>
  );
}

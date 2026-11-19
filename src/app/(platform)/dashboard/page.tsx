import { Suspense } from "react";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import Link from "next/link";
import type { Route } from "next";
import { formatInTimeZone } from "date-fns-tz";
import { ArrowUpRight, CalendarCheck, CalendarPlus, Gauge, IndianRupee, PhoneCall, Sparkles } from "lucide-react";
import { requireArea } from "@/lib/session";
import { loadOverview } from "@/lib/dashboard/overview";
import { ButtonLink, EmptyState, Meter, PageHeader, Section, StatCard, StatusBadge, money } from "@/components/admin/kit";
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
    <div className="grid gap-6">
      <PageHeader
        eyebrow={`${scopeLabel} · ${formatInTimeZone(new Date(), o.tz, "EEEE d MMMM")}`}
        title={
          <>
            {hello}
            {name && <span className="capitalize">, {name}</span>}
          </>
        }
        actions={
          <>
            <ButtonLink variant="outline" href="/dashboard/calendar">
              Open calendar
            </ButtonLink>
            {s.role !== "stylist" && (
              <ButtonLink href={`/dashboard/bookings/new?date=${o.today}`}>
                <CalendarPlus aria-hidden /> New booking
              </ButtonLink>
            )}
          </>
        }
      />

      <section aria-label="Today at a glance" className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          icon={CalendarCheck}
          label={s.role === "stylist" ? "Your appointments" : "Appointments today"}
          value={o.appointments}
          hint={o.appointments ? `${o.byAi} booked by Shanaya` : undefined}
        />
        <StatCard icon={IndianRupee} label="Booked value today" value={money(o.bookedValue, s.salon.currency)} />
        <StatCard icon={Gauge} label="Occupancy today" value={`${o.occupancyPct}%`} hint="treatment time ÷ rostered time" />
        <Link href={"/dashboard/leads" as Route} className="rounded-xl transition-shadow hover:shadow-md">
          <StatCard icon={Sparkles} label="New leads" value={o.leads.filter((l) => l.status === "new").length} hint="from the website" />
        </Link>
        <Link href="/dashboard/callbacks" className="col-span-2 rounded-xl transition-shadow hover:shadow-md lg:col-span-1">
          <StatCard icon={PhoneCall} label="Call-backs waiting" value={o.openCallbacks} />
        </Link>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <Section className="xl:col-span-2" title="Bookings made, last 14 days" description="By channel">
          <BookingsByChannel data={o.series} />
        </Section>

        <Section
          title="Next up"
          action={
            <Link href="/dashboard/calendar" className="text-xs text-muted-foreground hover:text-foreground">
              Calendar →
            </Link>
          }
        >
          {o.upcoming.length ? (
            <ol className="-my-2 divide-y">
              {o.upcoming.map((b) => (
                <li key={b.id} className="flex items-start gap-3 py-3">
                  <span className="tabular w-16 shrink-0 pt-0.5 text-sm font-medium">{b.time}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {b.guestId ? (
                        <Link href={`/dashboard/guests/${b.guestId}` as Route} className="hover:underline">
                          {b.guest}
                        </Link>
                      ) : (
                        b.guest
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {b.service}
                      {b.staff ? ` · ${b.staff}` : ""}
                      {s.isAll && b.studio ? ` · ${b.studio}` : ""}
                    </p>
                  </div>
                  {b.source !== "staff" && (
                    <span
                      className="mt-1.5 size-2 shrink-0 rounded-full"
                      style={{ background: CHANNEL_COLORS[b.source as "phone" | "web"] }}
                      title={`Booked by Shanaya (${b.source})`}
                      aria-label={`Booked by Shanaya by ${b.source}`}
                    />
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState icon={CalendarCheck} title="All clear" description="No more appointments today." />
          )}
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Top treatments" description="Appointments, last 30 days">
          {o.topTreatments.length ? (
            <ul className="grid gap-3">
              {o.topTreatments.map((t) => (
                <li key={t.name}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="truncate">{t.name}</span>
                    <span className="tabular text-muted-foreground">{t.count}</span>
                  </div>
                  <Meter pct={(t.count / o.topTreatments[0].count) * 100} color="var(--chart-1)" />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No appointments yet" />
          )}
        </Section>

        <Section title={s.isAll ? "Occupancy by studio" : "Occupancy today"} description="Booked treatment time ÷ rostered therapist time">
          <ul className="grid max-h-72 gap-3 overflow-y-auto pr-1">
            {o.occupancy.map((st) => (
              <li key={st.id}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="truncate">{st.studio}</span>
                  <span className="tabular text-muted-foreground">{st.rostered ? `${st.pct}%` : "closed"}</span>
                </div>
                <Meter pct={st.pct} color="var(--chart-2)" />
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Shanaya this month">
          <dl className="grid grid-cols-3 gap-4">
            <Metric label="Website chats" value={o.chats.total} />
            <Metric label="Chats → bookings" value={`${chatRate}%`} />
            <Metric label="Phone calls" value={o.chats.calls} />
          </dl>
          <h3 className="mt-6 text-xs font-medium text-muted-foreground">Latest leads</h3>
          {o.leads.length ? (
            <ul className="mt-1 divide-y">
              {o.leads.slice(0, 3).map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate">{l.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{l.message}</span>
                  </span>
                  <StatusBadge status={l.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No leads yet.</p>
          )}
          <Link href={"/dashboard/leads" as Route} className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            All leads <ArrowUpRight className="size-3" aria-hidden />
          </Link>
        </Section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular mt-1 text-xl font-semibold">{value}</dd>
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

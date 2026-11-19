import { Suspense } from "react";
import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import { requireArea } from "@/lib/session";
import { Badge, Card, Empty, PageHeader, Stat, money } from "@/components/dashboard-ui";
import { UsageDots } from "@/components/usage-dots";
import type { Route } from "next";
import { benefitBookings, isPast, periodKey, periodUsage, savings, upcomingIncluded, type Tier } from "@/lib/dashboard/member-benefits";

const PERIOD_NOUN = { month: "month", quarter: "quarter", year: "year" } as const;

async function Members({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const s = await requireArea("members");
  const { q: raw } = await searchParams;
  const q = (raw ?? "").trim().slice(0, 60);
  const brandId = s.salon.brand_id ?? "00000000-0000-0000-0000-000000000000";
  const tz = s.salon.timezone;

  let query = s.supabase
    .from("membership_purchases")
    .select("id, tier_name, price, period, name, phone, email, status, starts_at, ends_at, created_at, salon:salon_id (area), tier:membership_id (included_per_period, included_period, included_categories, discount_pct)")
    .eq("brand_id", brandId)
    .in("status", ["active", "expired", "cancelled"])
    .order("created_at", { ascending: false })
    .limit(200);
  if (q) {
    const digits = q.replace(/\D/g, "");
    query = digits.length >= 4 ? query.ilike("phone", `%${digits}%`) : query.ilike("name", `%${q.replace(/[%_,()]/g, "")}%`);
  }
  const { data } = await query;
  const purchases = data ?? [];
  const bookings = await benefitBookings(purchases.map((m) => m.id));

  const rows = purchases.map((m) => {
    const mine = bookings.filter((b) => b.membership_purchase_id === m.id);
    const tier = m.tier as Tier;
    const usage = periodUsage(m, tier, mine, tz);
    return {
      ...m, tier,
      state: m.status === "active" && isPast(m.ends_at) ? "expired" : m.status,
      current: usage.find((u) => u.current) ?? null,
      saved: savings(mine),
    };
  });
  const active = rows.filter((m) => m.state === "active");
  const value = active.reduce((t, m) => t + Number(m.price), 0);

  // Brand-wide, this calendar month: included treatments redeemed and booked, and value given to members.
  const monthKey = periodKey(new Date(), "month", tz);
  const thisMonth = bookings.filter((b) => periodKey(b.starts_at, "month", tz) === monthKey);
  const redeemedThisMonth = thisMonth.filter((b) => b.member_benefit === "included" && (b.status === "completed" || b.status === "no_show")).length;
  const bookedAhead = upcomingIncluded(bookings);
  const givenThisMonth = thisMonth.filter((b) => b.status === "completed").reduce((t, b) => t + Number(b.member_discount ?? 0), 0);

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Brand-wide" title="Members" subtitle="Guests with a membership bought online, and what each has used of their benefits. Open a member for the full record." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <Stat label="Active members" value={active.length} />
        <Stat label="Active membership value" value={money(value, s.salon.currency)} />
        <Stat label="Included treatments used" value={redeemedThisMonth} hint="This month, all studios" />
        <Stat label="Included treatments booked" value={bookedAhead} hint="Upcoming" />
        <Stat label="Member benefits given" value={money(givenThisMonth, s.salon.currency)} hint="This month, redeemed visits" />
      </div>
      <form role="search" className="flex flex-wrap gap-3">
        <label htmlFor="q" className="sr-only">Search members</label>
        <input id="q" name="q" defaultValue={q} placeholder="Search by name or mobile number" className="field max-w-sm" />
        <button className="min-h-10 rounded-full bg-charcoal px-4 text-sm text-ivory">Search</button>
      </form>
      <Card className="overflow-x-auto p-0">
        {rows.length ? (
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[0.75rem] text-stone">
                <th className="px-5 py-3 font-medium">Member</th>
                <th className="px-3 py-3 font-medium">Membership</th>
                <th className="px-3 py-3 font-medium">Included this period</th>
                <th className="px-3 py-3 font-medium">Benefits given</th>
                <th className="px-3 py-3 font-medium">Valid</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((m) => (
                <tr key={m.id} className="align-top hover:bg-cream/50">
                  <td className="px-5 py-3">
                    <Link href={`/dashboard/members/${m.id}` as Route} className="font-medium underline-offset-4 hover:underline">{m.name}</Link>
                    <p className="text-xs text-stone tabular-nums">+{m.phone}{m.email ? ` · ${m.email}` : ""}</p>
                  </td>
                  <td className="px-3 py-3">{m.tier_name}<p className="text-xs text-stone">{money(m.price, s.salon.currency)} a {m.period}{m.salon?.area ? ` · home: ${m.salon.area}` : ""}</p></td>
                  <td className="px-3 py-3">
                    {m.state !== "active" || !m.tier || m.tier.included_per_period <= 0 ? <span className="text-stone">—</span> : m.current ? (
                      <>
                        <UsageDots total={m.current.allowance} used={m.current.redeemed + m.current.noShow} booked={m.current.booked} />
                        <p className="mt-1 text-xs text-stone">
                          {m.current.left > 0 ? `${m.current.left} of ${m.current.allowance} left this ${PERIOD_NOUN[m.tier.included_period]}` : `All used this ${PERIOD_NOUN[m.tier.included_period]}`}
                          {m.current.booked > 0 ? ` · ${m.current.booked} booked` : ""}
                        </p>
                      </>
                    ) : <span className="text-stone">—</span>}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {money(m.saved.includedValue + m.saved.discountValue, s.salon.currency)}
                    <p className="text-xs text-stone">{m.saved.visits} redeemed visit{m.saved.visits === 1 ? "" : "s"}</p>
                  </td>
                  <td className="px-3 py-3 text-stone">
                    {m.starts_at && m.ends_at ? `${formatInTimeZone(new Date(m.starts_at), tz, "d MMM yyyy")} – ${formatInTimeZone(new Date(m.ends_at), tz, "d MMM yyyy")}` : "—"}
                  </td>
                  <td className="px-5 py-3"><Badge tone={m.state === "active" ? "confirmed" : m.state === "cancelled" ? "cancelled" : "done"}>{m.state}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>{q ? "No members match that search." : "No members yet. Memberships bought on the website appear here."}</Empty>
        )}
      </Card>
    </div>
  );
}

export default function Page(props: Parameters<typeof Members>[0]) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <Members {...props} />
    </Suspense>
  );
}

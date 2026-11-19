import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import { requireArea } from "@/lib/session";
import { fmtHuman } from "@/lib/time";
import { Badge, Card, Empty, PageHeader, Stat, money } from "@/components/dashboard-ui";
import { UsageDots } from "@/components/usage-dots";
import { USE_LABEL, benefitBookings, benefitState, isPast, periodUsage, savings, type Tier, type UseState } from "@/lib/dashboard/member-benefits";

const USE_TONE: Record<UseState, string> = { redeemed: "converted", booked: "confirmed", unchecked: "contacted", no_show: "no_show", late_cancel: "no_show", cancelled: "closed" };
const PERIOD_NOUN = { month: "Month", quarter: "Quarter", year: "Year" } as const;

async function Member({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireArea("members");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const tz = s.salon.timezone;
  const cur = s.salon.currency;

  // RLS limits this to memberships of the caller's brand.
  const { data: m } = await s.supabase
    .from("membership_purchases")
    .select("id, tier_name, price, period, name, phone, email, status, starts_at, ends_at, salon:salon_id (area), tier:membership_id (included_per_period, included_period, included_categories, discount_pct)")
    .eq("id", id)
    .maybeSingle();
  if (!m) notFound();

  const tier = m.tier as Tier;
  const bookings = await benefitBookings([m.id]);
  const usage = periodUsage(m, tier, bookings, tz);
  const saved = savings(bookings);
  const current = usage.find((u) => u.current);
  const refOf = new Map(bookings.map((b) => [b.id, b.reference]));
  const state = m.status === "active" && isPast(m.ends_at) ? "expired" : m.status;

  return (
    <div className="grid gap-6">
      <Link href="/dashboard/members" className="text-sm text-stone hover:text-charcoal">← All members</Link>
      <PageHeader
        eyebrow={`${m.tier_name} member`}
        title={m.name}
        subtitle={`+${m.phone}${m.email ? ` · ${m.email}` : ""}${m.salon?.area ? ` · home studio ${m.salon.area}` : ""}`}
        action={<Badge tone={state === "active" ? "confirmed" : state === "cancelled" ? "cancelled" : "done"}>{state}</Badge>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={tier?.included_per_period ? `Included this ${PERIOD_NOUN[tier.included_period].toLowerCase()}` : "Included treatments"}
          value={current && tier ? `${current.left} left` : "—"}
          hint={current && tier ? `${current.redeemed + current.noShow} used · ${current.booked} booked · of ${current.allowance}` : "Not part of this tier"}
        />
        <Stat label="Included treatments value" value={money(saved.includedValue, cur)} hint="Redeemed visits" />
        <Stat label="Member discounts given" value={money(saved.discountValue, cur)} hint={tier?.discount_pct ? `${tier.discount_pct}% off other treatments` : undefined} />
        <Stat
          label="Valid"
          value={m.ends_at ? formatInTimeZone(new Date(m.ends_at), tz, "d MMM yyyy") : "—"}
          hint={m.starts_at ? `Since ${formatInTimeZone(new Date(m.starts_at), tz, "d MMM yyyy")} · ${money(m.price, cur)} a ${m.period}` : undefined}
        />
      </div>

      {tier && tier.included_per_period > 0 && (
        <section className="grid gap-3">
          <h2 className="display-cut text-[1.375rem]">Included treatments by {PERIOD_NOUN[tier.included_period].toLowerCase()}</h2>
          <p className="text-sm text-stone">
            {tier.included_per_period} included per {tier.included_period} ({tier.included_categories.join(", ") || "any category"}). Unused treatments don&apos;t carry over.
          </p>
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[0.75rem] text-stone">
                  <th className="px-5 py-3 font-medium">{PERIOD_NOUN[tier.included_period]}</th>
                  <th className="px-3 py-3 font-medium">Usage</th>
                  <th className="px-3 py-3 font-medium">Redeemed</th>
                  <th className="px-3 py-3 font-medium">Booked</th>
                  <th className="px-5 py-3 font-medium">Left</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {usage.map((u) => (
                  <tr key={u.key} className={u.current ? "bg-cream/60" : undefined}>
                    <td className="px-5 py-3 font-medium">{u.label}{u.current && <span className="ml-2 text-xs font-normal text-stone">current</span>}</td>
                    <td className="px-3 py-3"><UsageDots total={u.allowance} used={u.redeemed + u.noShow} booked={u.booked} /></td>
                    <td className="px-3 py-3 tabular-nums">{u.redeemed}{u.noShow ? <span className="text-xs text-danger"> + {u.noShow} missed</span> : null}</td>
                    <td className="px-3 py-3 tabular-nums">{u.booked}</td>
                    <td className="px-5 py-3 tabular-nums">
                      {u.left === 0 ? <span className="text-stone">0</span> : u.past ? <span className="text-stone">{u.left} unused (expired)</span> : <span className="font-medium text-success">{u.left} available</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      )}

      <section className="grid gap-3">
        <h2 className="display-cut text-[1.375rem]">Benefit history</h2>
        <Card className="overflow-x-auto p-0">
          {bookings.length ? (
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[0.75rem] text-stone">
                  <th className="px-5 py-3 font-medium">When</th>
                  <th className="px-3 py-3 font-medium">Treatment</th>
                  <th className="px-3 py-3 font-medium">Benefit</th>
                  <th className="px-3 py-3 font-medium">Value</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {bookings.map((b) => {
                  const st = benefitState(b);
                  return (
                    <tr key={b.id} className="align-top">
                      <td className="px-5 py-3 whitespace-nowrap">
                        {fmtHuman(b.starts_at, tz)}
                        <p className="text-xs text-stone">#{b.reference}{b.salon ? ` · ${b.salon.area ?? b.salon.name}` : ""}</p>
                      </td>
                      <td className="px-3 py-3">{b.service?.name ?? "—"}</td>
                      <td className="px-3 py-3">
                        {b.member_benefit === "included" ? "Included treatment" : "Member discount"}
                        {b.member_included_from && (
                          <p className="text-xs text-stone">Passed on from {refOf.has(b.member_included_from) ? `#${refOf.get(b.member_included_from)}` : "a cancelled booking"}</p>
                        )}
                      </td>
                      <td className="px-3 py-3 tabular-nums">
                        {money(Number(b.member_discount ?? 0), cur)}
                        <p className="text-xs text-stone">of {money(b.price, cur)}</p>
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={USE_TONE[st]}>{USE_LABEL[st]}</Badge>
                        {st === "cancelled" && b.cancel_reason && <p className="mt-1 max-w-48 text-xs text-stone">{b.cancel_reason}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <Empty>No benefits used yet. Bookings made with this member&apos;s mobile number appear here.</Empty>
          )}
        </Card>
      </section>
    </div>
  );
}

export default function Page(props: Parameters<typeof Member>[0]) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <Member {...props} />
    </Suspense>
  );
}

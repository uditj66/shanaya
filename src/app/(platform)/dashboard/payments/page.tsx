import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import { formatInTimeZone } from "date-fns-tz";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import { requireArea } from "@/lib/session";
import { Badge, Card, Empty, PageHeader, Stat, money } from "@/components/dashboard-ui";
import { RefundButton } from "./refund-button";

const KIND = { gift_card: "Gift card", membership: "Membership", deposit: "Booking deposit" } as const;
const FILTERS = [["paid", "Paid"], ["refunded", "Refunded"], ["failed", "Failed or abandoned"], ["all", "All"]] as const;

async function Payments({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const s = await requireArea("payments");
  const { status: raw } = await searchParams;
  const status = FILTERS.some(([k]) => k === raw) ? raw! : "paid";
  const brandId = s.salon.brand_id;
  const tz = s.salon.timezone;
  const test = (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "").startsWith("rzp_test_");

  let q = s.supabase
    .from("payments")
    .select("id, kind, amount, status, method, payer_name, payer_phone, razorpay_payment_id, created_at, paid_at, refunded_at, refund_amount, error")
    .eq("brand_id", brandId ?? "00000000-0000-0000-0000-000000000000")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status === "failed") q = q.in("status", ["failed", "created"]);
  else if (status !== "all") q = q.eq("status", status as "paid" | "refunded");
  const [{ data: rows }, { data: month }] = await Promise.all([
    q,
    s.supabase
      .from("payments")
      .select("amount, kind")
      .eq("brand_id", brandId ?? "00000000-0000-0000-0000-000000000000")
      .eq("status", "paid")
      .gte("paid_at", formatInTimeZone(new Date(), tz, "yyyy-MM-01'T'00:00:00XXX")),
  ]);
  const monthTotal = (month ?? []).reduce((t, r) => t + r.amount, 0) / 100;
  const byKind = (k: keyof typeof KIND) => (month ?? []).filter((r) => r.kind === k).reduce((t, r) => t + r.amount, 0) / 100;

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow={test ? "Brand-wide · test mode" : "Brand-wide"} title="Payments" subtitle="Online payments through Razorpay. Payouts and settlement reports are in your Razorpay dashboard." />
      {test && <p className="rounded-xl bg-linen px-4 py-3 text-sm text-stone">Razorpay is in <strong className="font-medium text-charcoal">test mode</strong>: these are practice payments and no real money moves. Switch to live keys when you&apos;re ready to take payments.</p>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Taken this month" value={money(monthTotal, s.salon.currency)} />
        <Stat label="Gift cards" value={money(byKind("gift_card"), s.salon.currency)} hint="This month" />
        <Stat label="Memberships" value={money(byKind("membership"), s.salon.currency)} hint="This month" />
        <Stat label="Booking deposits" value={money(byKind("deposit"), s.salon.currency)} hint="This month" />
      </div>
      <nav className="flex flex-wrap gap-1.5 text-sm" aria-label="Filter">
        {FILTERS.map(([k, l]) => (
          <Link key={k} href={`/dashboard/payments?status=${k}` as Route} aria-current={k === status ? "page" : undefined} className={`rounded-full px-3 py-1.5 ${k === status ? "bg-charcoal text-ivory" : "text-stone ring-1 ring-line hover:text-charcoal"}`}>{l}</Link>
        ))}
      </nav>
      <Card className="overflow-x-auto p-0">
        {rows?.length ? (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[0.75rem] text-stone">
                <th className="px-5 py-3 font-medium">When</th>
                <th className="px-3 py-3 font-medium">For</th>
                <th className="px-3 py-3 font-medium">Guest</th>
                <th className="px-3 py-3 text-right font-medium">Amount</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-3 text-stone">{formatInTimeZone(new Date(p.paid_at ?? p.created_at), tz, "d MMM, h:mm a")}</td>
                  <td className="px-3 py-3">{KIND[p.kind]}{p.method && <p className="text-xs capitalize text-stone">{p.method}</p>}</td>
                  <td className="px-3 py-3">{p.payer_name}<p className="text-xs text-stone">+{p.payer_phone}</p></td>
                  <td className="px-3 py-3 text-right tabular-nums">{money(p.amount / 100, s.salon.currency)}</td>
                  <td className="px-3 py-3">
                    <Badge tone={p.status === "paid" ? "confirmed" : p.status === "refunded" ? "done" : "cancelled"}>{p.status === "created" ? "abandoned" : p.status}</Badge>
                    {p.status === "refunded" && p.refund_amount && p.refund_amount < p.amount && (
                      <p className="mt-1 text-xs text-stone">{money(p.refund_amount / 100, s.salon.currency)} refunded (benefits used kept)</p>
                    )}
                    {p.razorpay_payment_id && <p className="mt-1 font-mono text-[0.6875rem] text-stone">{p.razorpay_payment_id}</p>}
                  </td>
                  <td className="px-5 py-3 text-right">{p.status === "paid" && <RefundButton paymentId={p.id} label={money(p.amount / 100, s.salon.currency)} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>No payments here yet.</Empty>
        )}
      </Card>
    </div>
  );
}

export default function Page(props: Parameters<typeof Payments>[0]) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <Payments {...props} />
    </Suspense>
  );
}

import { Suspense } from "react";
import type { Route } from "next";
import { formatInTimeZone } from "date-fns-tz";
import { BadgeCheck, CalendarCheck, FlaskConical, Gift, IndianRupee, ReceiptText } from "lucide-react";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import { requireArea } from "@/lib/session";
import {
  EmptyState,
  PageHeader,
  StatCard,
  StatusBadge,
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  money,
  SegmentedNav,
} from "@/components/admin/kit";
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
      <PageHeader eyebrow={test ? "Brand-wide · test mode" : "Brand-wide"} title="Payments" description="Online payments through Razorpay. Payouts and settlement reports are in your Razorpay dashboard." />
      {test && (
        <p className="flex items-start gap-3 rounded-xl border bg-muted px-4 py-3 text-sm text-muted-foreground">
          <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Razorpay is in <strong className="font-medium text-foreground">test mode</strong>: these are practice payments and no real money moves. Switch to live keys when you&apos;re ready to take payments.
          </span>
        </p>
      )}
      <section aria-label="This month" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={IndianRupee} label="Taken this month" value={money(monthTotal, s.salon.currency)} />
        <StatCard icon={Gift} label="Gift cards" value={money(byKind("gift_card"), s.salon.currency)} hint="This month" />
        <StatCard icon={BadgeCheck} label="Memberships" value={money(byKind("membership"), s.salon.currency)} hint="This month" />
        <StatCard icon={CalendarCheck} label="Booking deposits" value={money(byKind("deposit"), s.salon.currency)} hint="This month" />
      </section>
      <div>
        <SegmentedNav label="Filter" className="mb-4" items={FILTERS.map(([k, l]) => ({ href: `/dashboard/payments?status=${k}` as Route, label: l, active: k === status }))} />
        <TableCard>
          {rows?.length ? (
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">When</TableHead>
                  <TableHead>For</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-4">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="pl-4 align-top text-muted-foreground">{formatInTimeZone(new Date(p.paid_at ?? p.created_at), tz, "d MMM, h:mm a")}</TableCell>
                    <TableCell className="align-top">
                      {KIND[p.kind]}
                      {p.method && <p className="text-xs capitalize text-muted-foreground">{p.method}</p>}
                    </TableCell>
                    <TableCell className="align-top">
                      {p.payer_name}
                      <p className="tabular text-xs text-muted-foreground">+{p.payer_phone}</p>
                    </TableCell>
                    <TableCell className="tabular text-right align-top">{money(p.amount / 100, s.salon.currency)}</TableCell>
                    <TableCell className="align-top">
                      <StatusBadge status={p.status}>{p.status === "created" ? "abandoned" : p.status}</StatusBadge>
                      {p.status === "refunded" && p.refund_amount && p.refund_amount < p.amount && (
                        <p className="mt-1 text-xs text-muted-foreground">{money(p.refund_amount / 100, s.salon.currency)} refunded (benefits used kept)</p>
                      )}
                      {p.razorpay_payment_id && <p className="mt-1 font-mono text-[0.6875rem] text-muted-foreground">{p.razorpay_payment_id}</p>}
                    </TableCell>
                    <TableCell className="pr-4 text-right align-top">{p.status === "paid" && <RefundButton paymentId={p.id} label={money(p.amount / 100, s.salon.currency)} />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState icon={ReceiptText} title="No payments here yet" />
          )}
        </TableCard>
      </div>
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

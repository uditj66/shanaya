import { Suspense } from "react";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { ArrowLeft, CalendarRange, Gift, Percent, Sparkles } from "lucide-react";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import { requireArea } from "@/lib/session";
import { fmtHuman } from "@/lib/time";
import {
  ButtonLink,
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
  cn,
  money,
  type Tone,
} from "@/components/admin/kit";
import { UsageDots } from "@/components/usage-dots";
import { USE_LABEL, benefitBookings, benefitState, isPast, periodUsage, savings, type Tier, type UseState } from "@/lib/dashboard/member-benefits";

const USE_TONE: Record<UseState, Tone> = { redeemed: "success", booked: "success", unchecked: "warning", no_show: "danger", late_cancel: "danger", cancelled: "neutral" };
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
      <div>
        <ButtonLink href="/dashboard/members" variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <ArrowLeft aria-hidden /> All members
        </ButtonLink>
      </div>
      <PageHeader
        eyebrow={`${m.tier_name} member`}
        title={m.name}
        description={`+${m.phone}${m.email ? ` · ${m.email}` : ""}${m.salon?.area ? ` · home studio ${m.salon.area}` : ""}`}
        actions={<StatusBadge status={state} />}
      />

      <section aria-label="Membership at a glance" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Sparkles}
          label={tier?.included_per_period ? `Included this ${PERIOD_NOUN[tier.included_period].toLowerCase()}` : "Included treatments"}
          value={current && tier ? `${current.left} left` : "—"}
          hint={current && tier ? `${current.redeemed + current.noShow} used · ${current.booked} booked · of ${current.allowance}` : "Not part of this tier"}
        />
        <StatCard icon={Gift} label="Included treatments value" value={money(saved.includedValue, cur)} hint="Redeemed visits" />
        <StatCard icon={Percent} label="Member discounts given" value={money(saved.discountValue, cur)} hint={tier?.discount_pct ? `${tier.discount_pct}% off other treatments` : undefined} />
        <StatCard
          icon={CalendarRange}
          label="Valid"
          value={m.ends_at ? formatInTimeZone(new Date(m.ends_at), tz, "d MMM yyyy") : "—"}
          hint={m.starts_at ? `Since ${formatInTimeZone(new Date(m.starts_at), tz, "d MMM yyyy")} · ${money(m.price, cur)} a ${m.period}` : undefined}
        />
      </section>

      {tier && tier.included_per_period > 0 && (
        <section className="grid gap-3">
          <div>
            <h2 className="text-base font-semibold">Included treatments by {PERIOD_NOUN[tier.included_period].toLowerCase()}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {tier.included_per_period} included per {tier.included_period} ({tier.included_categories.join(", ") || "any category"}). Unused treatments don&apos;t carry over.
            </p>
          </div>
          <TableCard>
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{PERIOD_NOUN[tier.included_period]}</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead className="text-right">Redeemed</TableHead>
                  <TableHead className="text-right">Booked</TableHead>
                  <TableHead className="pr-4">Left</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.map((u) => (
                  <TableRow key={u.key} className={cn(u.current && "bg-muted/60")}>
                    <TableCell className="pl-4 font-medium">
                      {u.label}
                      {u.current && <span className="ml-2 text-xs font-normal text-muted-foreground">current</span>}
                    </TableCell>
                    <TableCell><UsageDots total={u.allowance} used={u.redeemed + u.noShow} booked={u.booked} /></TableCell>
                    <TableCell className="tabular text-right">
                      {u.redeemed}
                      {u.noShow ? <span className="text-xs text-destructive"> + {u.noShow} missed</span> : null}
                    </TableCell>
                    <TableCell className="tabular text-right">{u.booked}</TableCell>
                    <TableCell className="tabular pr-4">
                      {u.left === 0 ? <span className="text-muted-foreground">0</span> : u.past ? <span className="text-muted-foreground">{u.left} unused (expired)</span> : <span className="font-medium text-success">{u.left} available</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        </section>
      )}

      <section className="grid gap-3">
        <h2 className="text-base font-semibold">Benefit history</h2>
        <TableCard>
          {bookings.length ? (
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">When</TableHead>
                  <TableHead>Treatment</TableHead>
                  <TableHead>Benefit</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="pr-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b) => {
                  const st = benefitState(b);
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="pl-4 align-top">
                        {fmtHuman(b.starts_at, tz)}
                        <p className="text-xs text-muted-foreground">#{b.reference}{b.salon ? ` · ${b.salon.area ?? b.salon.name}` : ""}</p>
                      </TableCell>
                      <TableCell className="align-top">{b.service?.name ?? "—"}</TableCell>
                      <TableCell className="align-top">
                        {b.member_benefit === "included" ? "Included treatment" : "Member discount"}
                        {b.member_included_from && (
                          <p className="text-xs text-muted-foreground">Passed on from {refOf.has(b.member_included_from) ? `#${refOf.get(b.member_included_from)}` : "a cancelled booking"}</p>
                        )}
                      </TableCell>
                      <TableCell className="tabular text-right align-top">
                        {money(Number(b.member_discount ?? 0), cur)}
                        <p className="text-xs text-muted-foreground">of {money(b.price, cur)}</p>
                      </TableCell>
                      <TableCell className="pr-4 align-top">
                        <StatusBadge tone={USE_TONE[st]} className="normal-case">{USE_LABEL[st]}</StatusBadge>
                        {st === "cancelled" && b.cancel_reason && <p className="mt-1 max-w-48 whitespace-normal text-xs text-muted-foreground">{b.cancel_reason}</p>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <EmptyState icon={Gift} title="No benefits used yet" description="Bookings made with this member's mobile number appear here." />
          )}
        </TableCard>
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

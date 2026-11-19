import { Suspense } from "react";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import { requireSalon } from "@/lib/session";
import { fmtHuman } from "@/lib/time";
import { setBookingStatus } from "../actions";
import { Badge, ButtonLink, Card, Empty, Input, PageHeader, Select, money } from "@/components/dashboard-ui";

/** Online bookings carry a deposit; the desk takes a paid one off the bill. */
const DEPOSIT_LABEL: Record<string, string> = { pending: "Awaiting deposit", paid: "Deposit paid, take off bill:", applied: "Deposit used", refunded: "Deposit refunded", forfeited: "Deposit kept" };

async function Bookings({ searchParams }: { searchParams: Promise<{ ref?: string; status?: string; q?: string; when?: string }> }) {
  const { salon, supabase } = await requireSalon();
  const sp = await searchParams;
  const when = sp.when ?? "upcoming";

  let query = supabase
    .from("bookings")
    .select("id, reference, starts_at, status, source, price, notes, deposit_amount, deposit_status, gift_card_amount, gift_card_state, member_benefit, member_discount, customer:customer_id (name, phone), service:service_id (name), staff:staff_id (name), gift_card:gift_card_id (code), membership:membership_purchase_id (tier_name)")
    .eq("salon_id", salon.id)
    .limit(200);
  if (sp.ref) query = query.eq("reference", sp.ref.toUpperCase());
  else if (when === "upcoming") query = query.gte("starts_at", new Date().toISOString()).order("starts_at");
  else query = query.lt("starts_at", new Date().toISOString()).order("starts_at", { ascending: false });
  if (sp.status) query = query.eq("status", sp.status as "confirmed");
  const { data } = await query;

  const q = (sp.q ?? "").toLowerCase();
  const rows = (data ?? []).filter((b) => !q || b.customer?.name.toLowerCase().includes(q) || b.customer?.phone.includes(q.replace(/\D/g, "") || "§"));

  return (
    <div>
      <PageHeader title="Bookings" subtitle="Every appointment, whoever booked it: phone AI, website AI or your team." action={<ButtonLink href="/dashboard/bookings/new">+ New booking</ButtonLink>} />
      <form className="mb-4 flex flex-wrap gap-2">
        <Select name="when" defaultValue={when} className="w-auto"><option value="upcoming">Upcoming</option><option value="past">Past</option></Select>
        <Select name="status" defaultValue={sp.status ?? ""} className="w-auto">
          <option value="">All statuses</option>
          {["confirmed", "completed", "cancelled", "no_show"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </Select>
        <Input name="q" defaultValue={sp.q} placeholder="Search guest name or phone" className="w-64" />
        <button className="rounded-lg border border-line bg-white px-4 text-sm">Filter</button>
      </form>
      <Card className="overflow-x-auto p-0">
        {!rows.length ? <Empty>No bookings found.</Empty> : (
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <tr>{["When", "Guest", "Service", "Therapist", "Value", "Source", "Status", ""].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="border-b border-line last:border-0 align-top">
                  <td className="px-4 py-3 whitespace-nowrap">{fmtHuman(b.starts_at, salon.timezone)}<div className="text-xs text-muted">#{b.reference}</div></td>
                  <td className="px-4 py-3">{b.customer?.name}<div className="text-xs text-muted">+{b.customer?.phone}</div></td>
                  <td className="px-4 py-3">{b.service?.name}{b.notes && <div className="max-w-56 text-xs text-gold-dark">Note: {b.notes}</div>}</td>
                  <td className="px-4 py-3">{b.staff?.name}</td>
                  <td className="px-4 py-3">
                    {money(b.price, salon.currency)}
                    <PaidOnline b={b} currency={salon.currency} />
                  </td>
                  <td className="px-4 py-3"><Badge tone={b.source}>{b.source === "staff" ? "staff" : `AI ${b.source}`}</Badge></td>
                  <td className="px-4 py-3">
                    <Badge>{b.status}</Badge>
                    {b.deposit_status && b.deposit_status !== "expired" && (
                      <p className="mt-1 text-xs text-stone">{DEPOSIT_LABEL[b.deposit_status]} ₹{Number(b.deposit_amount ?? 0).toLocaleString("en-IN")}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {b.status === "confirmed" && (
                      <form action={setBookingStatus} className="flex gap-1">
                        <input type="hidden" name="reference" value={b.reference} />
                        <button name="status" value="completed" className="rounded px-2 py-1 text-xs hover:bg-cream">Done</button>
                        <button name="status" value="no_show" className="rounded px-2 py-1 text-xs hover:bg-cream">No-show</button>
                        <button name="status" value="cancelled" className="rounded px-2 py-1 text-xs text-danger hover:bg-danger/10">Cancel</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

const GIFT_LABEL: Record<string, string> = { used: "Paid by gift card", returned: "Returned to gift card", kept: "Gift card amount kept" };

/** Member benefit and gift card used when booking online, and what the desk still collects. */
function PaidOnline({ b, currency }: {
  b: { price: number; status: string; deposit_amount: number | null; deposit_status: string | null; gift_card_amount: number | null; gift_card_state: string | null; member_benefit: string | null; member_discount: number | null; gift_card: { code: string } | null; membership: { tier_name: string } | null };
  currency: string;
}) {
  if (!b.member_benefit && !b.gift_card_state) return null;
  const memberOff = Number(b.member_discount ?? 0);
  const gift = b.gift_card_state === "used" ? Number(b.gift_card_amount ?? 0) : 0;
  const deposit = b.deposit_status === "paid" ? Number(b.deposit_amount ?? 0) : 0;
  const collect = Math.max(0, Number(b.price) - memberOff - gift - deposit);
  return (
    <div className="mt-1 grid gap-0.5 text-xs text-stone">
      {b.member_benefit && (
        <span>
          {b.membership?.tier_name ?? "Member"}: {b.member_benefit === "included" ? "included treatment" : `−${money(memberOff, currency)}`} · check membership
        </span>
      )}
      {b.gift_card_state && (
        <span>
          {GIFT_LABEL[b.gift_card_state]} {money(Number(b.gift_card_amount ?? 0), currency)}
          {b.gift_card?.code ? ` (${b.gift_card.code})` : ""}
        </span>
      )}
      {b.status === "confirmed" && <span className="font-medium text-charcoal">Collect {collect > 0 ? money(collect, currency) : "nothing"}</span>}
    </div>
  );
}

// The page's live data streams inside its own Suspense boundary (instant navigation; Cache Components best practice).
export default function Page(props: Parameters<typeof Bookings>[0]) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <Bookings {...props} />
    </Suspense>
  );
}

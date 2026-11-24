import { Suspense } from "react";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import { requireSalon } from "@/lib/session";
import { fmtHuman } from "@/lib/time";
import { setBookingStatus } from "../actions";
import { CalendarPlus, CalendarSearch } from "lucide-react";
import {
  Button,
  ButtonLink,
  EmptyState,
  FilterBar,
  Input,
  PageHeader,
  Select,
  StatusBadge,
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  money,
} from "@/components/admin/kit";

/** Online bookings carry a deposit; the desk takes a paid one off the bill. */
const DEPOSIT_LABEL: Record<string, string> = { pending: "Awaiting deposit", paid: "Deposit paid, take off bill:", applied: "Deposit used", refunded: "Deposit refunded", forfeited: "Deposit kept" };

async function Bookings({ searchParams }: { searchParams: Promise<{ ref?: string; status?: string; q?: string; when?: string }> }) {
  const { salon, supabase } = await requireSalon();
  const sp = await searchParams;
  const when = sp.when ?? "upcoming";

  let query = supabase
    .from("bookings")
    .select("id, reference, starts_at, status, source, price, notes, guest_name, deposit_amount, deposit_status, gift_card_amount, gift_card_state, member_benefit, member_discount, customer:customer_id (name, phone), service:service_id (name), staff:staff_id (name), gift_card:gift_card_id (code), membership:membership_purchase_id (tier_name)")
    .eq("salon_id", salon.id)
    .limit(200);
  if (sp.ref) query = query.eq("reference", sp.ref.toUpperCase());
  else if (when === "upcoming") query = query.gte("starts_at", new Date().toISOString()).order("starts_at");
  else query = query.lt("starts_at", new Date().toISOString()).order("starts_at", { ascending: false });
  if (sp.status) query = query.eq("status", sp.status as "confirmed");
  const { data } = await query;

  const q = (sp.q ?? "").toLowerCase();
  const rows = (data ?? []).filter((b) => !q || b.customer?.name.toLowerCase().includes(q) || !!b.guest_name?.toLowerCase().includes(q) || b.customer?.phone.includes(q.replace(/\D/g, "") || "§"));

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Bookings"
        description="Every appointment, whoever booked it: phone AI, website AI or your team."
        actions={
          <ButtonLink href="/dashboard/bookings/new">
            <CalendarPlus aria-hidden /> New booking
          </ButtonLink>
        }
      />
      <div>
        <FilterBar>
          <Select name="when" defaultValue={when} aria-label="When">
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
          </Select>
          <Select name="status" defaultValue={sp.status ?? ""} aria-label="Status">
            <option value="">All statuses</option>
            {["confirmed", "completed", "cancelled", "no_show"].map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </Select>
          <Input name="q" defaultValue={sp.q} placeholder="Search guest name or phone" aria-label="Search guest name or phone" className="w-64" />
          <Button variant="outline">Filter</Button>
        </FilterBar>
        <TableCard>
          {!rows.length ? (
            <EmptyState icon={CalendarSearch} title="No bookings found" description="Try another filter or search." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Therapist</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((b) => (
                  <TableRow key={b.id} className="align-top">
                    <TableCell>
                      {fmtHuman(b.starts_at, salon.timezone)}
                      <div className="text-xs text-muted-foreground">#{b.reference}</div>
                    </TableCell>
                    <TableCell>
                      {b.guest_name ?? b.customer?.name}
                      <div className="tabular text-xs text-muted-foreground">
                        {b.guest_name ? `${b.customer?.name}'s number · ` : ""}+{b.customer?.phone}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {b.service?.name}
                      {b.notes && <div className="max-w-56 text-xs text-primary">Note: {b.notes}</div>}
                    </TableCell>
                    <TableCell>{b.staff?.name}</TableCell>
                    <TableCell className="tabular text-right">
                      {money(b.price, salon.currency)}
                      <PaidOnline b={b} currency={salon.currency} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={b.source}>{b.source === "staff" ? "staff" : `AI ${b.source}`}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={b.status} />
                      {b.deposit_status && b.deposit_status !== "expired" && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {DEPOSIT_LABEL[b.deposit_status]} ₹{Number(b.deposit_amount ?? 0).toLocaleString("en-IN")}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {b.status === "confirmed" && (
                        <form action={setBookingStatus} className="flex gap-1">
                          <input type="hidden" name="reference" value={b.reference} />
                          <Button name="status" value="completed" variant="ghost" size="xs">
                            Done
                          </Button>
                          <Button name="status" value="no_show" variant="ghost" size="xs">
                            No-show
                          </Button>
                          <Button name="status" value="cancelled" variant="ghost" size="xs" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                            Cancel
                          </Button>
                        </form>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableCard>
      </div>
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
    <div className="mt-1 grid gap-0.5 text-xs font-normal text-muted-foreground">
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
      {b.status === "confirmed" && <span className="font-medium text-foreground">Collect {collect > 0 ? money(collect, currency) : "nothing"}</span>}
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

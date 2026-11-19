// Membership benefit tracking for the dashboard: what each member has used, booked and still has left.
// Bookings are read brand-wide with the admin client (a member may redeem at any studio, while bookings RLS is
// per studio), but only for membership ids the caller's own RLS-checked query returned.
import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { adminClient } from "@/lib/supabase/admin";

export type Period = "month" | "quarter" | "year";
export type Tier = { included_per_period: number; included_period: Period; included_categories: string[]; discount_pct: number } | null;

/** Same keys as private.member_period_key in the database: '2026-11', '2026-Q4' or '2026'. */
export const periodKey = (at: Date | string, period: Period, tz: string) =>
  formatInTimeZone(new Date(at), tz, period === "year" ? "yyyy" : period === "quarter" ? "yyyy-'Q'Q" : "yyyy-MM");

export const periodLabel = (key: string, period: Period) => {
  if (period !== "month") return key.replace(/^(\d{4})-(Q\d)$/, "$2 $1");
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
};

export type BenefitBooking = {
  id: string; reference: string; starts_at: string; status: "confirmed" | "cancelled" | "completed" | "no_show";
  price: number; member_benefit: "included" | "discount"; member_discount: number | null; member_included_from: string | null;
  membership_purchase_id: string; cancel_reason: string | null; late_cancel: boolean;
  service: { name: string } | null; salon: { area: string | null; name: string } | null;
};

/**
 * Where a benefit stands, for the desk. Redeemed, booked, no-shows and late cancels count against the allowance;
 * a cancel with notice is returned.
 */
export type UseState = "redeemed" | "booked" | "unchecked" | "no_show" | "late_cancel" | "cancelled";
export function benefitState(b: Pick<BenefitBooking, "status" | "starts_at" | "late_cancel">): UseState {
  if (b.status === "completed") return "redeemed";
  if (b.status === "no_show") return "no_show";
  if (b.status === "cancelled") return b.late_cancel ? "late_cancel" : "cancelled";
  return Date.parse(b.starts_at) < Date.now() ? "unchecked" : "booked";
}
/** Request-time clock checks, kept out of components (render purity). */
export const isPast = (iso: string | null) => !!iso && Date.parse(iso) < Date.now();
export const upcomingIncluded = (bookings: BenefitBooking[]) =>
  bookings.filter((b) => b.member_benefit === "included" && b.status === "confirmed" && !isPast(b.starts_at)).length;

export const USE_LABEL: Record<UseState, string> = {
  redeemed: "Redeemed", booked: "Booked", unchecked: "Not checked out", no_show: "No-show (counted)", late_cancel: "Late cancel (counted)", cancelled: "Cancelled (returned)",
};

export async function benefitBookings(purchaseIds: string[]): Promise<BenefitBooking[]> {
  if (!purchaseIds.length) return [];
  const { data } = await adminClient()
    .from("bookings")
    .select("id, reference, starts_at, status, price, member_benefit, member_discount, member_included_from, membership_purchase_id, cancel_reason, late_cancel, service:service_id (name), salon:salon_id (area, name)")
    .in("membership_purchase_id", purchaseIds)
    .not("member_benefit", "is", null)
    .order("starts_at", { ascending: false })
    .limit(2000);
  return (data ?? []) as BenefitBooking[];
}

export type PeriodUse = { key: string; label: string; allowance: number; redeemed: number; booked: number; noShow: number; left: number; current: boolean; past: boolean };

/**
 * The included-treatment allowance per period, from the membership's start to its end (or now), plus any later
 * period that already has a booking. `left` is what can still be booked; in a past period it was unused.
 */
export function periodUsage(
  m: { starts_at: string | null; ends_at: string | null },
  tier: Tier,
  bookings: BenefitBooking[],
  tz: string,
): PeriodUse[] {
  if (!tier || tier.included_per_period <= 0 || !m.starts_at) return [];
  const p = tier.included_period;
  const step = p === "year" ? 12 : p === "quarter" ? 3 : 1;
  const nowKey = periodKey(new Date(), p, tz);
  const end = Math.min(Date.now(), m.ends_at ? Date.parse(m.ends_at) : Date.now());
  const keys = new Set<string>([periodKey(m.starts_at, p, tz)]);
  const d = new Date(m.starts_at);
  d.setUTCDate(15); // mid-month steps never skip a short month
  for (let i = 0; i < 120 && d.getTime() <= end; i++) {
    keys.add(periodKey(d, p, tz));
    d.setUTCMonth(d.getUTCMonth() + step);
  }
  keys.add(periodKey(new Date(end), p, tz));
  const included = bookings.filter((b) => b.member_benefit === "included");
  for (const b of included) if (b.status !== "cancelled") keys.add(periodKey(b.starts_at, p, tz));

  return [...keys].sort().reverse().map((key) => {
    const inPeriod = included.filter((b) => periodKey(b.starts_at, p, tz) === key);
    const count = (s: UseState[]) => inPeriod.filter((b) => s.includes(benefitState(b))).length;
    const redeemed = count(["redeemed"]);
    const noShow = count(["no_show", "late_cancel"]); // missed: used up without a visit
    const booked = count(["booked", "unchecked"]);
    return {
      key, label: periodLabel(key, p), allowance: tier.included_per_period, redeemed, booked, noShow,
      left: Math.max(0, tier.included_per_period - redeemed - noShow - booked),
      current: key === nowKey, past: key < nowKey,
    };
  });
}

/** Totals for one member: value given through included treatments and member discounts (redeemed visits only). */
export function savings(bookings: BenefitBooking[]) {
  const redeemed = bookings.filter((b) => b.status === "completed");
  const sum = (k: "included" | "discount") => redeemed.filter((b) => b.member_benefit === k).reduce((t, b) => t + Number(b.member_discount ?? 0), 0);
  return { includedValue: sum("included"), discountValue: sum("discount"), visits: redeemed.length };
}

/**
 * What a member has had from the membership, for a refund (owner's rule: refund the price minus this): discounts
 * and included treatments on completed visits, plus included treatments used up by a no-show or late cancel.
 */
export function benefitsUsedValue(bookings: BenefitBooking[]) {
  return bookings
    .filter((b) => {
      const s = benefitState(b);
      return s === "redeemed" || (b.member_benefit === "included" && (s === "no_show" || s === "late_cancel"));
    })
    .reduce((t, b) => t + Number(b.member_discount ?? 0), 0);
}

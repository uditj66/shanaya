// Gift cards and memberships used when booking online (see migration 20261121030000_online_redemption.sql).
//   Gift card: the code pays the treatment price at booking, up to its balance; the studio collects any difference.
//   Membership: found by the booking's mobile number. Members skip the deposit, and either the included treatment
//   books at no charge (while this period's allowance lasts) or the member discount comes off the price.
// The desk still checks the member at the visit: anyone can type a member's number.
import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import type { MemberBenefit } from "@/lib/database.types";

export const GIFT_CODE = /^[A-Z0-9-]{8,24}$/;
export const cleanGiftCode = (raw: string) => raw.replace(/\s+/g, "").toUpperCase();

export type GiftCardCheck = { ok: true; balance: number; expiresAt: string | null } | { ok: false; error: string };

/** Is this an active, unexpired gift card of the brand with money on it? */
export async function checkGiftCard(brandId: string, rawCode: string): Promise<GiftCardCheck> {
  const code = cleanGiftCode(rawCode);
  if (!GIFT_CODE.test(code)) return { ok: false, error: "That doesn't look like a gift card code." };
  const { data: g } = await adminClient().from("gift_cards").select("status, balance, expires_at").eq("brand_id", brandId).eq("code", code).maybeSingle();
  if (!g || g.status === "pending" || g.status === "cancelled") return { ok: false, error: "We couldn't find an active gift card with that code." };
  if (g.status === "expired" || (g.expires_at && Date.parse(g.expires_at) < Date.now())) return { ok: false, error: "This gift card has expired." };
  if (g.status === "redeemed" || Number(g.balance) <= 0) return { ok: false, error: "This gift card has already been fully used." };
  return { ok: true, balance: Number(g.balance), expiresAt: g.expires_at };
}

const REDEEM_ERRORS: Record<string, string> = {
  not_found: "We couldn't find an active gift card with that code.",
  expired: "This gift card has expired.",
  redeemed: "This gift card has already been fully used.",
  pending: "This gift card hasn't been paid for yet.",
  cancelled: "This gift card was cancelled.",
};

/** Take up to `max` off the card for this booking. Atomic in the database, so a balance can't be spent twice. */
export async function redeemForBooking(rawCode: string, bookingId: string, max: number) {
  const { data, error } = await adminClient().rpc("redeem_gift_card_for_booking", { p_code: cleanGiftCode(rawCode), p_booking: bookingId, p_max: max });
  const r = (data ?? {}) as { ok?: boolean; reason?: string; amount?: number; balance?: number };
  if (error || !r.ok) return { ok: false as const, error: REDEEM_ERRORS[r.reason ?? ""] ?? "We couldn't use this gift card. Please try again." };
  return { ok: true as const, amount: Number(r.amount), balance: Number(r.balance) };
}

/** Put a cancelled booking's gift card amount back on the card. Returns the amount returned (0 if none). */
export async function returnForBooking(bookingId: string) {
  const { data } = await adminClient().rpc("return_gift_card_for_booking", { p_booking: bookingId });
  return Number(data ?? 0);
}

export type Member = {
  purchaseId: string; tier: string; endsAt: string | null;
  discountPct: number; skipDeposit: boolean; includedPerPeriod: number; includedPeriod: "month" | "quarter" | "year"; includedCategories: string[];
};

/** The guest's active membership with this brand, by mobile number (normalised, e.g. 919876543210). */
export async function memberFor(brandId: string, phone: string): Promise<Member | null> {
  const now = new Date().toISOString();
  const { data } = await adminClient()
    .from("membership_purchases")
    .select("id, tier_name, starts_at, ends_at, tier:membership_id (discount_pct, skip_deposit, included_per_period, included_period, included_categories)")
    .eq("brand_id", brandId)
    .eq("phone", phone)
    .eq("status", "active")
    .lte("starts_at", now)
    .gt("ends_at", now)
    .order("ends_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const t = data.tier;
  return {
    purchaseId: data.id, tier: data.tier_name, endsAt: data.ends_at,
    discountPct: t?.discount_pct ?? 0, skipDeposit: t?.skip_deposit ?? true,
    includedPerPeriod: t?.included_per_period ?? 0, includedPeriod: t?.included_period ?? "month", includedCategories: t?.included_categories ?? [],
  };
}

/** "2026-11" / "2026-Q4" / "2026": which allowance period a start time falls in, in the studio's time zone. */
export function periodKey(iso: string, period: Member["includedPeriod"], timezone: string) {
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit" }).format(new Date(iso)).split("-");
  return period === "year" ? y : period === "quarter" ? `${y}-Q${Math.ceil(Number(m) / 3)}` : `${y}-${m}`;
}

export type MemberPrice = { benefit: MemberBenefit; discount: number; tier: string; includedLeft?: number } | null;

/** What the membership gives this booking: the included treatment if any allowance is left, else the discount. */
export async function memberPrice(member: Member, service: { category: string; price: number }, startsAt: string, timezone: string, excludeBookingId?: string): Promise<MemberPrice> {
  const price = Number(service.price);
  if (member.includedPerPeriod > 0 && member.includedCategories.includes(service.category)) {
    let q = adminClient()
      .from("bookings")
      .select("id, starts_at")
      .eq("membership_purchase_id", member.purchaseId)
      .eq("member_benefit", "included")
      .neq("status", "cancelled");
    if (excludeBookingId) q = q.neq("id", excludeBookingId);
    const { data } = await q;
    const key = periodKey(startsAt, member.includedPeriod, timezone);
    const used = (data ?? []).filter((b) => periodKey(b.starts_at, member.includedPeriod, timezone) === key).length;
    if (used < member.includedPerPeriod) return { benefit: "included", discount: price, tier: member.tier, includedLeft: member.includedPerPeriod - used - 1 };
  }
  if (member.discountPct > 0) return { benefit: "discount", discount: Math.round((price * member.discountPct) / 100), tier: member.tier };
  return null;
}

export const PERIOD_WORD: Record<Member["includedPeriod"], string> = { month: "this month", quarter: "this quarter", year: "this year" };

/** How a booking is paid for once member benefits and a gift card are applied (website, chat and phone alike). */
export type BookingPayment = {
  price: number;
  member?: { tier: string; benefit: MemberBenefit; discount: number; includedNote?: string };
  giftCard?: { amount: number; balance: number };
  payAtStudio: number;
  refundHours: number;
};

/**
 * Apply membership benefits (by the booking's mobile number) and an optional gift card to a just-created booking.
 * On a gift card failure the caller should cancel the booking and pass the error on. `noDeposit` is true when a
 * membership or a gift card secures the booking, so no deposit is taken.
 */
export async function applyBookingPerks(
  bookingId: string,
  o: { brandId: string | null; phone: string; service: { category: string; price: number }; startsAt: string; timezone: string; giftCode?: string; refundHours: number },
): Promise<{ ok: true; payment?: BookingPayment; noDeposit: boolean } | { ok: false; error: string }> {
  const price = Number(o.service.price);
  const member = o.brandId ? await memberFor(o.brandId, o.phone) : null;
  const mp = member ? await memberPrice(member, o.service, o.startsAt, o.timezone, bookingId) : null;
  if (mp && member) {
    await adminClient().from("bookings").update({ membership_purchase_id: member.purchaseId, member_benefit: mp.benefit, member_discount: mp.discount }).eq("id", bookingId);
  }
  let due = Math.max(0, price - (mp?.discount ?? 0));

  let giftCard: BookingPayment["giftCard"];
  if (o.giftCode && due > 0) {
    const g = await redeemForBooking(o.giftCode, bookingId, due);
    if (!g.ok) return g;
    giftCard = { amount: g.amount, balance: g.balance };
    due -= g.amount;
  }

  const payment: BookingPayment | undefined =
    mp || giftCard
      ? {
          price,
          ...(mp && {
            member: {
              tier: mp.tier, benefit: mp.benefit, discount: mp.discount,
              ...(mp.benefit === "included" && member && {
                includedNote: mp.includedLeft ? `${mp.includedLeft} more included ${PERIOD_WORD[member.includedPeriod]}` : `Your last included treatment ${PERIOD_WORD[member.includedPeriod]}`,
              }),
            },
          }),
          ...(giftCard && { giftCard }),
          payAtStudio: due,
          refundHours: o.refundHours,
        }
      : undefined;
  return { ok: true, payment, noDeposit: !!giftCard || !!member?.skipDeposit };
}

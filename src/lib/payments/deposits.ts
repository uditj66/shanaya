// Booking deposits (online bookings only): hold the slot, take the deposit, and settle it fairly on cancellation.
//   Rule (per brand, editable in Website → Brand): ₹deposit_amount up front; full refund when cancelled at least
//   deposit_refund_hours before the start; kept for later cancellations and no-shows; taken off the bill at the studio.
import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/events";
import { fmtHuman } from "../time";
import { createOrder, razorpayConfigured, razorpayKeyId, refundPayment } from "./razorpay";
import { viewToken } from "./codes";
import { returnForBooking } from "./redemption";

export type DepositRules = { amount: number; refundHours: number; holdMinutes: number };

/** The brand's deposit rules, or null when deposits are off (amount 0) or payments aren't configured. */
export async function depositRules(brandId: string | null): Promise<DepositRules | null> {
  if (!brandId || !razorpayConfigured()) return null;
  const { data } = await adminClient().from("brands").select("deposit_amount, deposit_refund_hours, deposit_hold_minutes").eq("id", brandId).maybeSingle();
  if (!data || data.deposit_amount <= 0) return null;
  return { amount: data.deposit_amount, refundHours: data.deposit_refund_hours, holdMinutes: data.deposit_hold_minutes };
}

export type DepositCheckout = {
  ok: true; keyId: string; orderId: string; amount: number; brandName: string; description: string;
  prefill: { name: string; contact: string; email?: string };
};

/**
 * Put a just-created booking on hold for its deposit and open a Razorpay order for it.
 * Returns what the browser needs to pay, plus a private pay link (for the chat).
 */
export async function holdForDeposit(bookingId: string, rules: DepositRules, payer: { name: string; phone: string; email?: string | null }) {
  const db = adminClient();
  const { data: b } = await db
    .from("bookings")
    .select("id, reference, salon_id, starts_at, price, salon:salon_id (brand_id, timezone, area), service:service_id (name)")
    .eq("id", bookingId)
    .single();
  if (!b?.salon?.brand_id) throw new Error("Booking not found");
  const { data: brand } = await db.from("brands").select("full_name").eq("id", b.salon.brand_id).single();

  // Never more than the treatment itself costs.
  const amount = Math.max(1, Math.min(rules.amount, Math.round(Number(b.price))));
  const token = viewToken();
  const holdUntil = new Date(Date.now() + rules.holdMinutes * 60_000);
  await db.from("bookings").update({ deposit_amount: amount, deposit_status: "pending", hold_expires_at: holdUntil.toISOString(), pay_token: token }).eq("id", b.id);

  const order = await createOrder({ amount: amount * 100, receipt: `dp_${b.reference}`, notes: { kind: "deposit", ref: b.id, booking: b.reference } });
  await db.from("payments").insert({
    brand_id: b.salon.brand_id, salon_id: b.salon_id, kind: "deposit", amount: order.amount, razorpay_order_id: order.id,
    payer_name: payer.name, payer_phone: payer.phone, payer_email: payer.email ?? null, ref_id: b.id,
  });
  const checkout: DepositCheckout = {
    ok: true, keyId: razorpayKeyId(), orderId: order.id, amount: order.amount, brandName: brand?.full_name ?? "",
    description: `Deposit · ${b.service?.name ?? "booking"} · ${fmtHuman(b.starts_at, b.salon.timezone)}`,
    prefill: { name: payer.name, contact: `+${payer.phone}`, ...(payer.email ? { email: payer.email } : {}) },
  };
  return { checkout, token, amount, holdUntil: holdUntil.toISOString(), reference: b.reference };
}

/** The open checkout for a held booking, by its private pay token (used by the chat card and the pay page). */
export async function depositCheckoutByToken(token: string) {
  const db = adminClient();
  const { data: b } = await db
    .from("bookings")
    .select("id, reference, status, starts_at, deposit_amount, deposit_status, hold_expires_at, salon:salon_id (brand_id, timezone, area, city), service:service_id (name), customer:customer_id (name, phone, email)")
    .eq("pay_token", token)
    .maybeSingle();
  if (!b) return null;
  const summary = {
    reference: b.reference, treatment: b.service?.name ?? "", studio: `${b.salon?.area ?? ""}, ${b.salon?.city ?? ""}`,
    when: fmtHuman(b.starts_at, b.salon?.timezone ?? "Asia/Kolkata"), amount: Number(b.deposit_amount ?? 0), holdUntil: b.hold_expires_at,
  };
  if (b.deposit_status !== "pending" || b.status !== "confirmed") return { state: (b.deposit_status ?? "none") as string, summary, checkout: null };
  const { data: p } = await db.from("payments").select("razorpay_order_id, amount, status").eq("ref_id", b.id).eq("kind", "deposit").neq("status", "paid").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data: brand } = await db.from("brands").select("full_name").eq("id", b.salon!.brand_id!).single();
  if (!p) return { state: "pending", summary, checkout: null };
  const checkout: DepositCheckout = {
    ok: true, keyId: razorpayKeyId(), orderId: p.razorpay_order_id, amount: p.amount, brandName: brand?.full_name ?? "",
    description: `Deposit · ${summary.treatment} · ${summary.when}`,
    prefill: { name: b.customer?.name ?? "", contact: `+${b.customer?.phone ?? ""}`, ...(b.customer?.email ? { email: b.customer.email } : {}) },
  };
  return { state: "pending", summary, checkout };
}

/**
 * One deposit can cover a whole chat visit: the other treatments she booked in the same chat, at the same studio,
 * on the same day carry no deposit of their own. When the visit's hold is released they are released with it
 * (here, and in the database's release_expired_holds), using this reason so a late payment can find them again.
 */
export const VISIT_RELEASED = "Deposit for this visit not paid in time";
const istDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(iso));

type VisitKey = { id: string; call_id: string | null; salon_id: string; customer_id: string; starts_at: string };

/** The other treatments of the same visit in a given state (deposit-free ones only). */
async function visitSiblings(b: VisitKey, state: { status: "confirmed" } | { status: "cancelled"; reason: string }) {
  if (!b.call_id) return [];
  let q = adminClient()
    .from("bookings")
    .select("id, starts_at")
    .eq("call_id", b.call_id)
    .eq("salon_id", b.salon_id)
    .eq("customer_id", b.customer_id)
    .eq("status", state.status)
    .is("deposit_status", null)
    .neq("id", b.id);
  if (state.status === "cancelled") q = q.eq("cancel_reason", state.reason);
  const { data } = await q;
  return (data ?? []).filter((s) => istDay(s.starts_at) === istDay(b.starts_at));
}

/**
 * Called once the deposit payment is confirmed. If the hold had already lapsed, take the whole visit back:
 * the held treatment and any treatments released with it. If any slot has been taken since (the database refuses a
 * clash), nothing is kept and the deposit is refunded in full.
 */
export async function deliverDeposit(bookingId: string) {
  const db = adminClient();
  const { data: b } = await db.from("bookings").select("id, status, deposit_status, call_id, salon_id, customer_id, starts_at").eq("id", bookingId).single();
  if (!b) return;
  if (b.status === "confirmed") {
    await db.from("bookings").update({ deposit_status: "paid", hold_expires_at: null }).eq("id", b.id).in("deposit_status", ["pending", "expired"]);
    return;
  }
  if (b.deposit_status !== "expired") return;

  // Paid after the hold was released.
  const siblings = await visitSiblings(b, { status: "cancelled", reason: VISIT_RELEASED });
  const restored: string[] = [];
  const { error } = await db.from("bookings").update({ status: "confirmed", cancel_reason: null, deposit_status: "paid", hold_expires_at: null }).eq("id", b.id).eq("deposit_status", "expired");
  let clash = !!error;
  if (!clash) {
    for (const s of siblings) {
      const { error: e } = await db.from("bookings").update({ status: "confirmed", cancel_reason: null }).eq("id", s.id).eq("status", "cancelled");
      if (e) {
        clash = true;
        break;
      }
      restored.push(s.id);
    }
  }
  if (!clash) return;

  // Part of the visit is no longer free: release what was taken back and refund the deposit in full.
  await logEvent(null, "payment_issue", { problem: "deposit paid after the visit's slots were taken; refunding", bookingId });
  if (restored.length) await db.from("bookings").update({ status: "cancelled", cancel_reason: "Slot no longer available" }).in("id", restored);
  if (!error) await db.from("bookings").update({ status: "cancelled", cancel_reason: "Slot no longer available" }).eq("id", b.id);
  await refundDeposit(b.id, "Slot no longer available");
}

async function refundDeposit(bookingId: string, reason: string) {
  const db = adminClient();
  const { data: p } = await db.from("payments").select("id, razorpay_payment_id").eq("ref_id", bookingId).eq("kind", "deposit").eq("status", "paid").maybeSingle();
  if (!p?.razorpay_payment_id) return false;
  await refundPayment(p.razorpay_payment_id, undefined, { reason });
  await db.from("payments").update({ status: "refunded", refunded_at: new Date().toISOString() }).eq("id", p.id);
  await db.from("bookings").update({ deposit_status: "refunded" }).eq("id", bookingId);
  return true;
}

export type DepositOutcome = "refunded" | "kept" | "card_returned" | "card_kept" | "none";

/**
 * After a booking is cancelled: refund the deposit (or put a gift card payment back on the card) when there was
 * enough notice, otherwise keep it. `force` refunds regardless (for example when the studio cancels).
 */
export async function settleDepositOnCancel(salonId: string, reference: string, opts: { force?: boolean } = {}): Promise<DepositOutcome> {
  const db = adminClient();
  const { data: b } = await db
    .from("bookings")
    .select("id, starts_at, deposit_status, gift_card_state, salon:salon_id (brand_id)")
    .eq("salon_id", salonId)
    .eq("reference", reference)
    .maybeSingle();
  if (!b) return "none";
  // Paid with a gift card when booking online (no deposit is taken then): same notice rule as the deposit.
  if (b.gift_card_state === "used") {
    const { data: brand } = await db.from("brands").select("deposit_refund_hours").eq("id", b.salon?.brand_id ?? "").maybeSingle();
    const enoughNotice = Date.parse(b.starts_at) - Date.now() >= (brand?.deposit_refund_hours ?? 24) * 3_600_000;
    if (opts.force || enoughNotice) return (await returnForBooking(b.id)) > 0 ? "card_returned" : "none";
    await db.from("bookings").update({ gift_card_state: "kept" }).eq("id", b.id);
    return "card_kept";
  }
  if (b.deposit_status === "pending") {
    await db.from("bookings").update({ deposit_status: "expired", hold_expires_at: null }).eq("id", b.id);
    return "none";
  }
  if (b.deposit_status !== "paid") return "none";
  const { data: brand } = await db.from("brands").select("deposit_refund_hours").eq("id", b.salon?.brand_id ?? "").maybeSingle();
  const hours = brand?.deposit_refund_hours ?? 24;
  const enoughNotice = Date.parse(b.starts_at) - Date.now() >= hours * 3_600_000;
  if (opts.force || enoughNotice) {
    try {
      if (await refundDeposit(b.id, opts.force ? "Cancelled by the studio" : "Cancelled with notice")) return "refunded";
    } catch (e) {
      await logEvent(salonId, "payment_issue", { problem: "deposit refund failed", reference, message: e instanceof Error ? e.message : String(e) });
      return "none";
    }
    return "none";
  }
  await db.from("bookings").update({ deposit_status: "forfeited" }).eq("id", b.id);
  return "kept";
}

/** Completed visits use the deposit against the bill; no-shows keep it. */
export async function settleDepositOnStatus(salonId: string, reference: string, status: "completed" | "no_show") {
  await adminClient()
    .from("bookings")
    .update({ deposit_status: status === "completed" ? "applied" : "forfeited" })
    .eq("salon_id", salonId)
    .eq("reference", reference)
    .eq("deposit_status", "paid");
}

/** Give up a hold straight away (the guest chose another time instead of paying), with the rest of that visit. */
export async function releaseHold(bookingId: string) {
  const db = adminClient();
  const { data: released } = await db
    .from("bookings")
    .update({ status: "cancelled", cancel_reason: "Deposit not paid", deposit_status: "expired", hold_expires_at: null })
    .eq("id", bookingId)
    .eq("deposit_status", "pending")
    .eq("status", "confirmed")
    .select("id, call_id, salon_id, customer_id, starts_at")
    .maybeSingle();
  if (!released) return;
  const siblings = await visitSiblings(released, { status: "confirmed" });
  if (siblings.length) await db.from("bookings").update({ status: "cancelled", cancel_reason: VISIT_RELEASED }).in("id", siblings.map((s) => s.id));
}

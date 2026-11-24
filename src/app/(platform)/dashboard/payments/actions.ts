"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireArea } from "@/lib/session";
import { adminClient } from "@/lib/supabase/admin";
import { refundPayment as razorpayRefund } from "@/lib/payments/razorpay";
import { benefitBookings, benefitsUsedValue } from "@/lib/dashboard/member-benefits";
import { depositRefundBlock } from "@/lib/payments/deposit-refund";

export type RefundResult = { ok: true } | { ok: false; error: string };
export type RefundPreview =
  | { ok: true; kind: string; paid: number; refund: number; used?: number; note?: string }
  | { ok: false; error: string };

const isId = (id: string) => z.string().uuid().safeParse(id).success;

/** The signed-in user's own client proves this payment belongs to their brand (row level security). */
async function ownPayment(paymentId: string) {
  const s = await requireArea("payments");
  const { data: p } = await s.supabase.from("payments").select("id, kind, status, amount, razorpay_payment_id, ref_id").eq("id", paymentId).maybeSingle();
  return { s, p };
}

/**
 * Membership refunds (owner's rule): the price paid minus the value of benefits already used. Amounts in paise.
 */
async function membershipRefund(purchaseId: string, paidPaise: number) {
  const used = benefitsUsedValue(await benefitBookings([purchaseId]));
  const usedPaise = Math.round(used * 100);
  return { usedPaise, refundPaise: Math.max(0, paidPaise - usedPaise) };
}

/** What a refund would give back, shown to the manager before they confirm. */
/** Why this deposit's booking can't be refunded right now (null when the deposit is still held). */
async function depositBlock(bookingId: string | null, tz: string) {
  if (!bookingId) return depositRefundBlock(null, tz);
  const { data: b } = await adminClient()
    .from("bookings")
    .select("reference, deposit_status, starts_at, refund_by, created_at, updated_at, status")
    .eq("id", bookingId)
    .maybeSingle();
  return depositRefundBlock(b, tz);
}

export async function previewRefund(paymentId: string): Promise<RefundPreview> {
  if (!isId(paymentId)) return { ok: false, error: "Payment not found." };
  const { s, p } = await ownPayment(paymentId);
  if (!p || p.status !== "paid") return { ok: false, error: "Only completed payments can be refunded." };
  if (p.kind === "membership" && p.ref_id) {
    const { usedPaise, refundPaise } = await membershipRefund(p.ref_id, p.amount);
    return {
      ok: true, kind: p.kind, paid: p.amount, refund: refundPaise, used: usedPaise,
      note: usedPaise > 0 ? "Benefits already used are taken off the refund. Member benefits on upcoming bookings are removed." : "No benefits used yet. Member benefits on upcoming bookings are removed.",
    };
  }
  // A deposit can only go back while it's still held: say why not before the manager presses anything.
  if (p.kind === "deposit") {
    const why = await depositBlock(p.ref_id, s.salon.timezone);
    if (why) return { ok: false, error: why };
  }
  return { ok: true, kind: p.kind, paid: p.amount, refund: p.amount };
}

/**
 * Refund an online payment (owners and managers).
 *   Gift card: in full, only while completely unused; the card is cancelled at the same moment.
 *   Membership: the price minus benefits already used; the membership is cancelled and member benefits on its
 *     upcoming bookings are removed (those visits are then charged normally).
 *   Deposit: in full, only while it is still held (not yet taken off a bill, kept, or refunded).
 */
export async function refundOnlinePayment(paymentId: string): Promise<RefundResult> {
  if (!isId(paymentId)) return { ok: false, error: "Payment not found." };
  const { s, p } = await ownPayment(paymentId);
  if (!p || p.status !== "paid" || !p.razorpay_payment_id) return { ok: false, error: "Only completed payments can be refunded." };

  const db = adminClient();
  let refundPaise = p.amount;
  if (p.kind === "gift_card" && p.ref_id) {
    // Cancel first, and only if untouched: the database check makes this safe against a redemption at the same moment.
    const { data: cancelled } = await db
      .from("gift_cards")
      .update({ status: "cancelled" })
      .eq("id", p.ref_id)
      .eq("status", "active")
      .filter("balance", "eq", p.amount / 100)
      .select("id")
      .maybeSingle();
    if (!cancelled) return { ok: false, error: "This gift card has already been used, so it can't be refunded online. Settle it at the studio." };
    try {
      await razorpayRefund(p.razorpay_payment_id, undefined, { reason: "gift card refund", by: s.user.email ?? "" });
    } catch (e) {
      await db.from("gift_cards").update({ status: "active" }).eq("id", p.ref_id).eq("status", "cancelled");
      return { ok: false, error: e instanceof Error ? `Razorpay: ${e.message}` : "Razorpay couldn't process the refund." };
    }
  } else if (p.kind === "membership" && p.ref_id) {
    // Cancel first so no new benefit can be claimed while the refund is worked out (claims need status 'active').
    const { data: cancelled } = await db
      .from("membership_purchases")
      .update({ status: "cancelled" })
      .eq("id", p.ref_id)
      .eq("status", "active")
      .select("id")
      .maybeSingle();
    if (!cancelled) return { ok: false, error: "This membership isn't active, so it can't be refunded here." };
    const r = await membershipRefund(p.ref_id, p.amount);
    refundPaise = r.refundPaise;
    if (refundPaise <= 0) {
      await db.from("membership_purchases").update({ status: "active" }).eq("id", p.ref_id).eq("status", "cancelled");
      return { ok: false, error: "Benefits already used are worth at least the price paid, so there is nothing to refund." };
    }
    try {
      await razorpayRefund(p.razorpay_payment_id, refundPaise < p.amount ? refundPaise : undefined, { reason: "membership refund", by: s.user.email ?? "" });
    } catch (e) {
      await db.from("membership_purchases").update({ status: "active" }).eq("id", p.ref_id).eq("status", "cancelled");
      return { ok: false, error: e instanceof Error ? `Razorpay: ${e.message}` : "Razorpay couldn't process the refund." };
    }
    // Upcoming visits lose their member price; the desk charges them normally.
    await db
      .from("bookings")
      .update({ member_benefit: null, member_discount: null })
      .eq("membership_purchase_id", p.ref_id)
      .eq("status", "confirmed")
      .gt("starts_at", new Date().toISOString());
  } else if (p.kind === "deposit" && p.ref_id) {
    // Claim the deposit first: only one that is still held can go back (never one already taken off a bill).
    const { data: held } = await db.from("bookings").update({ deposit_status: "refunded" }).eq("id", p.ref_id).eq("deposit_status", "paid").select("id").maybeSingle();
    if (!held) return { ok: false, error: (await depositBlock(p.ref_id, s.salon.timezone)) ?? "This deposit is no longer held, so it can't be refunded here." };
    try {
      await razorpayRefund(p.razorpay_payment_id, undefined, { reason: "deposit refund", by: s.user.email ?? "" });
    } catch (e) {
      await db.from("bookings").update({ deposit_status: "paid" }).eq("id", p.ref_id).eq("deposit_status", "refunded");
      return { ok: false, error: e instanceof Error ? `Razorpay: ${e.message}` : "Razorpay couldn't process the refund." };
    }
  } else {
    return { ok: false, error: "Refunds for this kind of payment aren't available here yet." };
  }

  await db
    .from("payments")
    .update({ status: "refunded", refunded_at: new Date().toISOString(), refund_amount: refundPaise })
    .eq("id", p.id);
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/gift-cards");
  revalidatePath("/dashboard/members");
  return { ok: true };
}

"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireArea } from "@/lib/session";
import { adminClient } from "@/lib/supabase/admin";
import { refundPayment as razorpayRefund } from "@/lib/payments/razorpay";

export type RefundResult = { ok: true } | { ok: false; error: string };

/**
 * Full refund of an online payment (owners and managers). A gift card can be refunded only while it's completely
 * unused; the card is cancelled at the same moment, so it can't be spent after the money goes back.
 */
export async function refundOnlinePayment(paymentId: string): Promise<RefundResult> {
  if (!z.string().uuid().safeParse(paymentId).success) return { ok: false, error: "Payment not found." };
  const s = await requireArea("payments");
  // The signed-in user's own client proves this payment belongs to their brand (row level security).
  const { data: p } = await s.supabase.from("payments").select("id, kind, status, amount, razorpay_payment_id, ref_id").eq("id", paymentId).maybeSingle();
  if (!p || p.status !== "paid" || !p.razorpay_payment_id) return { ok: false, error: "Only completed payments can be refunded." };

  const db = adminClient();
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
    const { data: cancelled } = await db
      .from("membership_purchases")
      .update({ status: "cancelled" })
      .eq("id", p.ref_id)
      .eq("status", "active")
      .select("id")
      .maybeSingle();
    if (!cancelled) return { ok: false, error: "This membership isn't active, so it can't be refunded here." };
    try {
      await razorpayRefund(p.razorpay_payment_id, undefined, { reason: "membership refund", by: s.user.email ?? "" });
    } catch (e) {
      await db.from("membership_purchases").update({ status: "active" }).eq("id", p.ref_id).eq("status", "cancelled");
      return { ok: false, error: e instanceof Error ? `Razorpay: ${e.message}` : "Razorpay couldn't process the refund." };
    }
  } else if (p.kind === "deposit" && p.ref_id) {
    // A deposit can be returned at the manager's discretion (for example when the studio cancels).
    try {
      await razorpayRefund(p.razorpay_payment_id, undefined, { reason: "deposit refund", by: s.user.email ?? "" });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? `Razorpay: ${e.message}` : "Razorpay couldn't process the refund." };
    }
    await db.from("bookings").update({ deposit_status: "refunded" }).eq("id", p.ref_id);
  } else {
    return { ok: false, error: "Refunds for this kind of payment aren't available here yet." };
  }

  await db.from("payments").update({ status: "refunded", refunded_at: new Date().toISOString() }).eq("id", p.id);
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/gift-cards");
  return { ok: true };
}

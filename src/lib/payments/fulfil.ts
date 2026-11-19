// Turning a Razorpay payment into what the guest bought. Called from the checkout callback and from the webhook,
// whichever arrives first; it's idempotent, so the second call changes nothing.
import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/events";
import { capturePayment, fetchPayment } from "./razorpay";
import { deliverDeposit } from "./deposits";

export const GIFT_CARD_VALIDITY_MONTHS = 12;

export { giftCardCode, viewToken } from "./codes";

export type Fulfilled = { status: "paid" | "pending" | "failed"; kind?: string; refId?: string | null };

/**
 * Confirms a payment against Razorpay itself (never trusting the browser for amounts), captures it if needed,
 * marks it paid and delivers the purchase.
 */
export async function fulfilPayment(orderId: string, paymentId: string): Promise<Fulfilled> {
  const db = adminClient();
  const { data: row } = await db.from("payments").select("*").eq("razorpay_order_id", orderId).maybeSingle();
  if (!row) return { status: "failed" };
  if (row.status === "paid") return { status: "paid", kind: row.kind, refId: row.ref_id };

  let p = await fetchPayment(paymentId);
  if (p.order_id !== orderId || p.amount !== row.amount || p.currency !== row.currency) {
    await logEvent(row.salon_id, "payment_issue", { problem: "amount or order mismatch", orderId, paymentId });
    return { status: "failed" };
  }
  if (p.status === "authorized") p = await capturePayment(paymentId, row.amount);
  if (p.status === "failed") {
    await db.from("payments").update({ status: "failed", razorpay_payment_id: paymentId, error: p.error_description ?? "failed" }).eq("id", row.id).neq("status", "paid");
    return { status: "failed" };
  }
  if (p.status !== "captured") return { status: "pending" };

  // Only the call that flips the row to paid delivers the purchase.
  const { data: won } = await db
    .from("payments")
    .update({ status: "paid", razorpay_payment_id: paymentId, method: p.method, paid_at: new Date().toISOString(), error: null })
    .eq("id", row.id)
    .neq("status", "paid")
    .select("id")
    .maybeSingle();
  if (won) await deliver(row.kind, row.ref_id);
  return { status: "paid", kind: row.kind, refId: row.ref_id };
}

async function deliver(kind: string, refId: string | null) {
  if (!refId) return;
  const db = adminClient();
  if (kind === "gift_card") {
    const { data: card } = await db.from("gift_cards").select("amount").eq("id", refId).single();
    const now = new Date();
    const expires = new Date(now);
    expires.setMonth(expires.getMonth() + GIFT_CARD_VALIDITY_MONTHS);
    await db
      .from("gift_cards")
      .update({ status: "active", balance: card?.amount ?? 0, activated_at: now.toISOString(), expires_at: expires.toISOString() })
      .eq("id", refId)
      .eq("status", "pending");
  } else if (kind === "deposit") {
    await deliverDeposit(refId);
  } else if (kind === "membership") {
    const { data: mp } = await db.from("membership_purchases").select("brand_id, phone, period").eq("id", refId).single();
    if (!mp) return;
    // A renewal bought before the current membership ends starts when that one ends, so no paid days are lost.
    const { data: current } = await db
      .from("membership_purchases")
      .select("ends_at")
      .eq("brand_id", mp.brand_id)
      .eq("phone", mp.phone)
      .eq("status", "active")
      .gt("ends_at", new Date().toISOString())
      .order("ends_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const start = current?.ends_at ? new Date(current.ends_at) : new Date();
    const end = new Date(start);
    end.setMonth(end.getMonth() + periodMonths(mp.period));
    await db
      .from("membership_purchases")
      .update({ status: "active", starts_at: start.toISOString(), ends_at: end.toISOString() })
      .eq("id", refId)
      .eq("status", "pending");
  }
}

/** "year" → 12, "6 months" → 6, "month" → 1. */
export function periodMonths(period: string) {
  const p = period.trim().toLowerCase();
  if (p === "year" || p === "annual" || p === "yearly") return 12;
  const n = Number(p.match(/^(\d+)/)?.[1] ?? 1);
  return p.includes("year") ? n * 12 : n;
}

/** A payment the guest abandoned or that Razorpay reported as failed. */
export async function markFailed(orderId: string, reason: string) {
  await adminClient().from("payments").update({ status: "failed", error: reason.slice(0, 300) }).eq("razorpay_order_id", orderId).eq("status", "created");
}

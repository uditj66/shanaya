// Razorpay webhook: the reliable confirmation path. If a guest closes the tab right after paying, this still activates
// what they bought. Signed with RAZORPAY_WEBHOOK_SECRET over the raw body; handling is idempotent (Razorpay retries).
import { NextResponse, type NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/events";
import { fulfilPayment, markFailed } from "@/lib/payments/fulfil";
import { verifyWebhookSignature } from "@/lib/payments/razorpay";

type Event = {
  event: string;
  payload: {
    payment?: { entity: { id: string; order_id: string | null; error_description?: string | null } };
    refund?: { entity: { payment_id: string; amount: number } };
  };
};

export async function POST(req: NextRequest) {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature"))) {
    await logEvent(null, "webhook_auth", { source: "razorpay" });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  const e = JSON.parse(raw) as Event;
  const pay = e.payload.payment?.entity;

  try {
    switch (e.event) {
      case "payment.captured":
      case "order.paid":
        if (pay?.order_id) await fulfilPayment(pay.order_id, pay.id);
        break;
      case "payment.failed":
        if (pay?.order_id) await markFailed(pay.order_id, pay.error_description ?? "failed");
        break;
      case "refund.processed": {
        const r = e.payload.refund?.entity;
        if (r) await adminClient().from("payments").update({ status: "refunded", refunded_at: new Date().toISOString() }).eq("razorpay_payment_id", r.payment_id);
        break;
      }
    }
  } catch (err) {
    // A 5xx makes Razorpay retry later, which is what we want if Razorpay or the database was briefly unreachable.
    console.error("[razorpay webhook]", err);
    await logEvent(null, "payment_issue", { problem: "webhook handling failed", event: e.event, message: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Temporary failure" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

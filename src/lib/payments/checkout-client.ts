// Razorpay Checkout in the browser. The script loads only when a guest actually pays, never on page load.
import type { CheckoutStart } from "@/app/(site)/payment-actions";

type Success = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type Failure = { error?: { description?: string; reason?: string } };
type RazorpayInstance = { open: () => void; on: (event: "payment.failed", cb: (r: Failure) => void) => void };
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let loading: Promise<void> | null = null;
function loadScript() {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load the payment window. Check your connection and try again."));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export type CheckoutOutcome = { kind: "paid"; result: Success } | { kind: "failed"; reason: string } | { kind: "closed" };

/** Opens Razorpay Checkout for an order created on the server and resolves when the guest pays, fails or closes it. */
export async function openCheckout(order: Extract<CheckoutStart, { ok: true }>): Promise<CheckoutOutcome> {
  await loadScript();
  return new Promise((resolve) => {
    let settled = false;
    // A failed attempt isn't the end: Razorpay keeps the window open so the guest can retry with another method.
    // Settle only on success, or when the window is closed (reporting the last failure, if any).
    let lastFailure: string | null = null;
    const done = (o: CheckoutOutcome) => {
      if (!settled) {
        settled = true;
        resolve(o);
      }
    };
    const rzp = new window.Razorpay!({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: "INR",
      name: order.brandName,
      description: order.description,
      prefill: order.prefill,
      theme: { color: "#2B2523" },
      handler: (r: Success) => done({ kind: "paid", result: r }),
      modal: { ondismiss: () => done(lastFailure ? { kind: "failed", reason: lastFailure } : { kind: "closed" }), confirm_close: true },
    });
    rzp.on("payment.failed", (r) => {
      lastFailure = r.error?.description ?? "The payment failed.";
    });
    rzp.open();
  });
}

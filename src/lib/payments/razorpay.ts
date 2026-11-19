// Razorpay over its REST API (https://razorpay.com/docs/api/). Server only: the key secret never reaches the browser.
// Amounts are in paise (₹1 = 100).
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.razorpay.com/v1";

export const razorpayKeyId = () => process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "";
export const razorpayConfigured = () => Boolean(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
export const isTestMode = () => razorpayKeyId().startsWith("rzp_test_");

export class RazorpayError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

async function call<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
  if (!razorpayConfigured()) throw new RazorpayError("Razorpay keys are not configured", 500);
  const auth = Buffer.from(`${process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { description?: string; code?: string } };
  if (!res.ok) throw new RazorpayError(data.error?.description ?? `Razorpay error ${res.status}`, res.status, data.error?.code);
  return data;
}

export type RazorpayOrder = { id: string; amount: number; currency: string; receipt: string; status: "created" | "attempted" | "paid" };
export type RazorpayPayment = {
  id: string; order_id: string; amount: number; currency: string; method: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed"; captured: boolean;
  error_description?: string | null;
};
export type RazorpayRefund = { id: string; payment_id: string; amount: number; status: "pending" | "processed" | "failed" };

export const createOrder = (o: { amount: number; receipt: string; notes?: Record<string, string> }) =>
  call<RazorpayOrder>("/orders", { method: "POST", body: { amount: o.amount, currency: "INR", receipt: o.receipt.slice(0, 40), notes: o.notes } });

export const fetchPayment = (id: string) => call<RazorpayPayment>(`/payments/${encodeURIComponent(id)}`);

export const capturePayment = (id: string, amount: number) =>
  call<RazorpayPayment>(`/payments/${encodeURIComponent(id)}/capture`, { method: "POST", body: { amount, currency: "INR" } });

export const refundPayment = (id: string, amount?: number, notes?: Record<string, string>) =>
  call<RazorpayRefund>(`/payments/${encodeURIComponent(id)}/refund`, { method: "POST", body: { ...(amount ? { amount } : {}), notes } });

function safeEqualHex(a: string, b: string) {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

/** The signature Razorpay Checkout returns after a successful payment: HMAC-SHA256(order_id|payment_id, key secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET ?? "").update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Webhooks are signed with the separate webhook secret over the raw request body. */
export function verifyWebhookSignature(rawBody: string, signature: string | null) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  return safeEqualHex(createHmac("sha256", secret).update(rawBody).digest("hex"), signature);
}

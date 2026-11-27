"use server";
// Online payments from the brand website (Razorpay Checkout). The browser only ever sees an order id and the public
// key; amounts are fixed on the server, and every payment is confirmed with Razorpay before anything is delivered.
import { headers } from "next/headers";
import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { rateLimited } from "@/lib/rate-limit";
import { normalizePhone } from "@/lib/time";
import { createOrder, razorpayConfigured, razorpayKeyId, verifyCheckoutSignature } from "@/lib/payments/razorpay";
import { fulfilPayment, giftCardCode, markFailed, viewToken } from "@/lib/payments/fulfil";
import { depositCheckoutByToken, releaseHold } from "@/lib/payments/deposits";
import { fmtHuman } from "@/lib/time";

export type CheckoutStart =
  | { ok: true; keyId: string; orderId: string; amount: number; brandName: string; description: string; prefill: { name: string; contact: string; email?: string } }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const phone = z.string().trim().regex(/^(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/, "Enter a 10-digit Indian mobile number");
const GiftCard = z.object({
  brand: z.string().regex(/^[a-z0-9-]{2,40}$/),
  amount: z.coerce.number().int("Choose a whole amount").min(1000, "Gift cards start at ₹1,000").max(100000, "Gift cards go up to ₹1,00,000"),
  recipient_name: z.string().trim().min(2, "Who is it for?").max(80),
  message: z.string().trim().max(300).optional().default(""),
  sender_name: z.string().trim().min(2, "Please tell us your name").max(80),
  sender_phone: phone,
  sender_email: z.string().trim().email("Check your email address").max(120).optional().or(z.literal("")),
  studio: z.string().optional(),
  consent: z.boolean().refine((v) => v, "Please agree to the gift card terms"),
});
export type GiftCardInput = z.input<typeof GiftCard>;

const ip = async () => (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

/** Step 1: create the (pending) gift card and a Razorpay order for it. */
export async function startGiftCardPurchase(input: GiftCardInput): Promise<CheckoutStart> {
  const v = GiftCard.safeParse(input);
  if (!v.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of v.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Please check the highlighted details.", fieldErrors };
  }
  if (!razorpayConfigured()) return { ok: false, error: "Online payment isn't available right now. Please call the studio." };
  if (await rateLimited(`pay:gift:${await ip()}`, 6, 600)) return { ok: false, error: "Too many attempts. Please try again in a few minutes." };

  const d = v.data;
  const db = adminClient();
  const { data: brand } = await db.from("brands").select("id, name, full_name").eq("slug", d.brand).maybeSingle();
  if (!brand) return { ok: false, error: "Something went wrong. Please try again." };
  const salonId = d.studio
    ? ((await db.from("salons").select("id").eq("brand_id", brand.id).eq("studio_slug", d.studio).maybeSingle()).data?.id ?? null)
    : null;
  const contact = normalizePhone(d.sender_phone);

  const { data: card, error } = await db
    .from("gift_cards")
    .insert({
      brand_id: brand.id, salon_id: salonId, code: giftCardCode(brand.name), view_token: viewToken(), amount: d.amount, balance: 0,
      sender_name: d.sender_name, sender_phone: contact, sender_email: d.sender_email || null, recipient_name: d.recipient_name,
      message: d.message, consent_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !card) return { ok: false, error: "Couldn't start the payment. Please try again." };

  try {
    const order = await createOrder({ amount: d.amount * 100, receipt: `gc_${card.id.slice(0, 18)}`, notes: { kind: "gift_card", ref: card.id, brand: d.brand } });
    await db.from("payments").insert({
      brand_id: brand.id, salon_id: salonId, kind: "gift_card", amount: order.amount, razorpay_order_id: order.id,
      payer_name: d.sender_name, payer_phone: contact, payer_email: d.sender_email || null, ref_id: card.id,
    });
    return {
      ok: true, keyId: razorpayKeyId(), orderId: order.id, amount: order.amount, brandName: brand.full_name,
      description: `Gift card for ${d.recipient_name}`,
      prefill: { name: d.sender_name, contact: `+${contact}`, ...(d.sender_email ? { email: d.sender_email } : {}) },
    };
  } catch (e) {
    console.error("[payments] create order", e);
    await db.from("gift_cards").update({ status: "cancelled" }).eq("id", card.id);
    return { ok: false, error: "Couldn't reach the payment provider. Please try again in a moment." };
  }
}

const Membership = z.object({
  brand: z.string().regex(/^[a-z0-9-]{2,40}$/),
  membershipId: z.string().uuid(),
  name: z.string().trim().min(2, "Please tell us your name").max(80),
  phone,
  email: z.string().trim().email("Check your email address").max(120).optional().or(z.literal("")),
  studio: z.string().optional(),
  consent: z.boolean().refine((v) => v, "Please agree to the membership terms"),
});
export type MembershipInput = z.input<typeof Membership>;

/** Join a membership tier: the price and period always come from the tier in the database, never the browser. */
export async function startMembershipPurchase(input: MembershipInput): Promise<CheckoutStart> {
  const v = Membership.safeParse(input);
  if (!v.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of v.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Please check the highlighted details.", fieldErrors };
  }
  if (!razorpayConfigured()) return { ok: false, error: "Online payment isn't available right now. Please call the studio." };
  if (await rateLimited(`pay:membership:${await ip()}`, 6, 600)) return { ok: false, error: "Too many attempts. Please try again in a few minutes." };

  const d = v.data;
  const db = adminClient();
  const { data: brand } = await db.from("brands").select("id, full_name").eq("slug", d.brand).maybeSingle();
  if (!brand) return { ok: false, error: "Something went wrong. Please try again." };
  const { data: tier } = await db.from("memberships").select("id, name, price, period, published").eq("id", d.membershipId).eq("brand_id", brand.id).maybeSingle();
  if (!tier || !tier.published || Number(tier.price) <= 0) return { ok: false, error: "This membership isn't available online. Please contact the studio." };
  const salonId = d.studio
    ? ((await db.from("salons").select("id").eq("brand_id", brand.id).eq("studio_slug", d.studio).maybeSingle()).data?.id ?? null)
    : null;
  const contact = normalizePhone(d.phone);

  const { data: mp, error } = await db
    .from("membership_purchases")
    .insert({
      brand_id: brand.id, membership_id: tier.id, salon_id: salonId, tier_name: tier.name, price: Number(tier.price), period: tier.period,
      name: d.name, phone: contact, email: d.email || null, consent_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !mp) return { ok: false, error: "Couldn't start the payment. Please try again." };

  try {
    const amount = Math.round(Number(tier.price) * 100);
    const order = await createOrder({ amount, receipt: `mb_${mp.id.slice(0, 18)}`, notes: { kind: "membership", ref: mp.id, brand: d.brand, tier: tier.name } });
    await db.from("payments").insert({
      brand_id: brand.id, salon_id: salonId, kind: "membership", amount: order.amount, razorpay_order_id: order.id,
      payer_name: d.name, payer_phone: contact, payer_email: d.email || null, ref_id: mp.id,
    });
    return {
      ok: true, keyId: razorpayKeyId(), orderId: order.id, amount: order.amount, brandName: brand.full_name,
      description: `${tier.name} membership (${tier.period})`,
      prefill: { name: d.name, contact: `+${contact}`, ...(d.email ? { email: d.email } : {}) },
    };
  } catch (e) {
    console.error("[payments] create order", e);
    await db.from("membership_purchases").update({ status: "cancelled" }).eq("id", mp.id);
    return { ok: false, error: "Couldn't reach the payment provider. Please try again in a moment." };
  }
}

const Confirm = z.object({
  razorpay_order_id: z.string().regex(/^order_[A-Za-z0-9]{6,40}$/),
  razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]{6,40}$/),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i),
});
export type ConfirmResult =
  | {
      ok: true;
      giftCard?: { code: string; link: string; recipient: string; amount: number; expiresAt: string | null };
      membership?: { tier: string; name: string; startsAt: string | null; endsAt: string | null };
      deposit?: { reference: string; when: string; startsAt: string; minutes: number; treatment: string; studio: string; specialist: string | null; amount: number };
    }
  | { ok: false; pending?: boolean; error: string };

/** Step 2: Razorpay Checkout hands back a signed result; check it, confirm with Razorpay, and deliver. */
export async function confirmPayment(input: z.input<typeof Confirm>): Promise<ConfirmResult> {
  const v = Confirm.safeParse(input);
  if (!v.success || !verifyCheckoutSignature(v.data.razorpay_order_id, v.data.razorpay_payment_id, v.data.razorpay_signature)) {
    return { ok: false, error: "We couldn't verify this payment. If money was taken, it will be refunded automatically; please call the studio." };
  }
  try {
    const r = await fulfilPayment(v.data.razorpay_order_id, v.data.razorpay_payment_id);
    if (r.status === "pending") return { ok: false, pending: true, error: "Your bank is still confirming the payment. We'll activate it as soon as it clears." };
    if (r.status !== "paid") return { ok: false, error: "The payment didn't go through. You haven't been charged." };
    if (r.kind === "gift_card" && r.refId) {
      const { data: g } = await adminClient().from("gift_cards").select("code, view_token, recipient_name, amount, expires_at").eq("id", r.refId).single();
      if (g) return { ok: true, giftCard: { code: g.code, link: `/gift-cards/card/${g.view_token}`, recipient: g.recipient_name, amount: Number(g.amount), expiresAt: g.expires_at } };
    }
    if (r.kind === "deposit" && r.refId) {
      const { data: b } = await adminClient()
        .from("bookings")
        .select("reference, starts_at, ends_at, status, deposit_amount, deposit_status, salon:salon_id (area, timezone), service:service_id (name), staff:staff_id (name)")
        .eq("id", r.refId)
        .single();
      if (b && b.deposit_status === "refunded") return { ok: false, error: "Sorry, that time was taken while you were paying. Your deposit has been refunded in full; please choose another time." };
      if (b) {
        return {
          ok: true,
          deposit: {
            reference: b.reference, when: fmtHuman(b.starts_at, b.salon?.timezone ?? "Asia/Kolkata"), startsAt: b.starts_at,
            minutes: Math.round((Date.parse(b.ends_at) - Date.parse(b.starts_at)) / 60000), treatment: b.service?.name ?? "",
            studio: `Lumière ${b.salon?.area ?? ""}`, specialist: b.staff?.name ?? null, amount: Number(b.deposit_amount ?? 0),
          },
        };
      }
    }
    if (r.kind === "membership" && r.refId) {
      const { data: mp } = await adminClient().from("membership_purchases").select("tier_name, name, starts_at, ends_at").eq("id", r.refId).single();
      if (mp) return { ok: true, membership: { tier: mp.tier_name, name: mp.name, startsAt: mp.starts_at, endsAt: mp.ends_at } };
    }
    return { ok: true };
  } catch (e) {
    console.error("[payments] confirm", e);
    return { ok: false, pending: true, error: "We're confirming your payment with the bank. Please don't pay again; the studio will contact you." };
  }
}

/** The guest closed the payment window or the payment failed in Checkout. */
export async function abandonPayment(orderId: string, reason: string) {
  if (!/^order_[A-Za-z0-9]{6,40}$/.test(orderId)) return;
  await markFailed(orderId, reason || "closed");
}

const Token = z.string().regex(/^[A-Za-z0-9_-]{24,64}$/);

/** The Razorpay checkout for a held booking (the chat's "Pay deposit" card and the pay page). */
export async function depositCheckout(token: string) {
  if (!Token.safeParse(token).success) return null;
  if (await rateLimited(`pay:deposit:${await ip()}`, 20, 600)) return null;
  return depositCheckoutByToken(token);
}

/** The guest would rather choose another time than pay: free the held slot straight away. */
export async function cancelDepositHold(token: string) {
  if (!Token.safeParse(token).success) return;
  const { data: b } = await adminClient().from("bookings").select("id").eq("pay_token", token).maybeSingle();
  if (b) await releaseHold(b.id);
}

"use client";
import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import * as m from "motion/react-m";
import { Check, Copy, Lock, MessageCircle } from "lucide-react";
import { abandonPayment, confirmPayment, startGiftCardPurchase, type ConfirmResult } from "@/app/(brand)/b/[brand]/payment-actions";
import { openCheckout } from "@/lib/payments/checkout-client";
import { brandHref } from "@/lib/brand/href";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Textarea } from "@/components/ui/form-controls";
import { EASE_OUT_SOFT } from "@/components/motion/motion-provider";

const AMOUNTS = [2500, 5000, 10000, 15000];
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
type Phase = { s: "idle" } | { s: "starting" } | { s: "paying" } | { s: "confirming" } | { s: "done"; card: NonNullable<Extract<ConfirmResult, { ok: true }>["giftCard"]> };

/** Buy a gift card online: details → Razorpay Checkout (UPI, cards, netbanking, wallets) → the card and its code. */
export function GiftCardCheckout({ brand, brandName, studios, validityMonths, testMode }: {
  brand: string;
  brandName: string;
  studios: { value: string; label: string }[];
  validityMonths: number;
  testMode: boolean;
}) {
  const [amount, setAmount] = useState<number | "custom">(5000);
  const [custom, setCustom] = useState("");
  const [phase, setPhase] = useState<Phase>({ s: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});
  const busy = phase.s !== "idle" && phase.s !== "done";
  const value = amount === "custom" ? Number(custom.replace(/\D/g, "")) : amount;

  if (phase.s === "done") return <GiftCardDone card={phase.card} brandName={brandName} />;

  const submit = async (form: FormData) => {
    setError(null);
    setFe({});
    setPhase({ s: "starting" });
    const get = (k: string) => String(form.get(k) ?? "");
    const start = await startGiftCardPurchase({
      brand, amount: value, recipient_name: get("recipient_name"), message: get("message"), sender_name: get("sender_name"),
      sender_phone: get("sender_phone"), sender_email: get("sender_email"), studio: get("studio") || undefined, consent: form.get("consent") === "on",
    });
    if (!start.ok) {
      setFe(start.fieldErrors ?? {});
      setError(start.error);
      return setPhase({ s: "idle" });
    }
    setPhase({ s: "paying" });
    let outcome;
    try {
      outcome = await openCheckout(start);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open the payment window.");
      return setPhase({ s: "idle" });
    }
    if (outcome.kind !== "paid") {
      void abandonPayment(start.orderId, outcome.kind === "failed" ? outcome.reason : "closed");
      setError(outcome.kind === "failed" ? `${outcome.reason} You haven't been charged; please try again.` : "Payment cancelled. Your details are still here when you're ready.");
      return setPhase({ s: "idle" });
    }
    setPhase({ s: "confirming" });
    const r = await confirmPayment(outcome.result);
    if (r.ok && r.giftCard) return setPhase({ s: "done", card: r.giftCard });
    setError(r.ok ? "Paid. The studio will send your gift card shortly." : r.error);
    setPhase({ s: "idle" });
  };

  const describe = (n: string) => (fe[n] ? { "aria-invalid": true as const, "aria-describedby": `gc-e-${n}` } : {});
  const err = (n: string) => (fe[n] ? <p id={`gc-e-${n}`} className="text-[0.8125rem] text-danger">{fe[n]}</p> : null);
  const field = (name: string, label: string, el: React.ReactNode, wide = false, optional = false) => (
    <div className={cn("grid content-start gap-2", wide && "md:col-span-2")}>
      <Label htmlFor={`gc-${name}`}>{label} {optional && <span className="font-normal text-stone">(optional)</span>}</Label>
      {el}
      {err(name)}
    </div>
  );

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) void submit(new FormData(e.currentTarget));
      }}
      className="grid gap-6 md:grid-cols-2"
    >
      {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger md:col-span-2">{error}</p>}

      <fieldset className="md:col-span-2">
        <legend className="text-[0.8125rem] font-medium tracking-[0.02em]">Amount</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {[...AMOUNTS, "custom" as const].map((a) => (
            <label key={a} className="cursor-pointer">
              <input type="radio" name="amount_choice" checked={amount === a} onChange={() => setAmount(a)} className="peer sr-only" />
              <span className="inline-flex min-h-11 items-center rounded-full border border-line px-5 text-sm transition-colors peer-checked:border-charcoal peer-checked:bg-charcoal peer-checked:text-ivory peer-focus-visible:ring-4 peer-focus-visible:ring-brass/20 hover:border-champagne">
                {a === "custom" ? "Other amount" : inr(a)}
              </span>
            </label>
          ))}
        </div>
        {amount === "custom" && (
          <div className="mt-4 grid max-w-xs gap-2">
            <Label htmlFor="gc-amount">Amount in rupees</Label>
            <Input id="gc-amount" inputMode="numeric" placeholder="e.g. 7500" value={custom} onChange={(e) => setCustom(e.target.value)} {...describe("amount")} />
          </div>
        )}
        {err("amount")}
      </fieldset>

      {field("recipient_name", "Who is it for?", <Input id="gc-recipient_name" name="recipient_name" {...describe("recipient_name")} />, true)}
      {field("message", "Your message", <Textarea id="gc-message" name="message" maxLength={300} placeholder="A few words for the card" {...describe("message")} />, true, true)}
      {field("sender_name", "Your name", <Input id="gc-sender_name" name="sender_name" autoComplete="name" {...describe("sender_name")} />)}
      {field("sender_phone", "Your mobile", <Input id="gc-sender_phone" name="sender_phone" type="tel" inputMode="tel" autoComplete="tel" {...describe("sender_phone")} />)}
      {field("sender_email", "Your email", <Input id="gc-sender_email" name="sender_email" type="email" autoComplete="email" {...describe("sender_email")} />, false, true)}
      {field(
        "studio",
        "Preferred studio",
        <select id="gc-studio" name="studio" defaultValue="" className="h-12 w-full rounded-lg border border-line bg-white/80 px-4 text-[0.9375rem] focus-visible:border-brass focus-visible:ring-4 focus-visible:ring-brass/12 focus-visible:outline-none">
          <option value="">Any studio</option>
          {studios.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>,
        false,
        true,
      )}

      <div className="grid gap-2 md:col-span-2">
        <div className="flex items-start gap-3">
          <Checkbox id="gc-consent" name="consent" className="mt-0.5" {...describe("consent")} />
          <Label htmlFor="gc-consent" className="font-normal leading-relaxed text-stone">
            I agree to the gift card terms: valid for {validityMonths} months at every {brandName} studio, usable across visits until the balance is used, and not exchangeable for cash. See our{" "}
            <Link href={brandHref("/privacy")} className="underline underline-offset-4">privacy notice</Link>.
          </Label>
        </div>
        {err("consent")}
      </div>

      <div className="flex flex-wrap items-center gap-4 md:col-span-2">
        <Button type="submit" size="lg" disabled={busy || !value}>
          {phase.s === "starting" ? "Preparing…" : phase.s === "paying" ? "Complete payment in the window…" : phase.s === "confirming" ? "Confirming…" : `Pay ${value ? inr(value) : ""}`}
        </Button>
        <p className="flex items-center gap-2 text-[0.8125rem] text-stone">
          <Lock aria-hidden="true" className="size-3.5" strokeWidth={1.5} /> Secure payment by Razorpay · UPI, cards, netbanking, wallets
        </p>
      </div>
      {testMode && (
        <p className="rounded-xl bg-linen/70 p-3 text-xs text-stone md:col-span-2">
          Test mode: no real money is charged. Pay by UPI with success@razorpay (or failure@razorpay to try a failed payment).
        </p>
      )}
    </form>
  );
}

function GiftCardDone({ card, brandName }: { card: NonNullable<Extract<ConfirmResult, { ok: true }>["giftCard"]>; brandName: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? card.link : `${window.location.origin}${card.link}`;
  const valid = card.expiresAt ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(new Date(card.expiresAt)) : null;
  const share = `A ${brandName} gift card for you, ${card.recipient}: ${inr(card.amount)}. Open it here: ${url}`;
  return (
    <m.div role="status" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE_OUT_SOFT }} className="rounded-2xl border border-line bg-white/60 p-8 md:p-10">
      <p className="eyebrow flex items-center gap-2"><Check aria-hidden="true" className="size-4" strokeWidth={1.75} /> Paid</p>
      <p className="display-cut mt-4 text-h2">Your gift for {card.recipient} is ready.</p>
      <div className="mt-8 rounded-xl border border-champagne bg-ivory p-6">
        <p className="eyebrow">Gift card code</p>
        <p className="display-cut mt-2 whitespace-nowrap text-[clamp(1.5rem,3.2vw,2.25rem)] tracking-[0.1em] tabular-nums">{card.code}</p>
        <p className="mt-2 text-sm text-stone">{inr(card.amount)}{valid ? ` · valid until ${valid}` : ""}</p>
      </div>
      <p className="mt-6 text-stone">Share the card with {card.recipient}. They show the code at any studio, or quote it when booking.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild size="md">
          <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle /> Send on WhatsApp
          </a>
        </Button>
        <Button
          type="button"
          variant="quiet"
          onClick={() => {
            void navigator.clipboard?.writeText(url).then(() => setCopied(true));
          }}
        >
          {copied ? <Check /> : <Copy />} {copied ? "Link copied" : "Copy link"}
        </Button>
        <Button asChild variant="link">
          <Link href={card.link as Route}>View the card</Link>
        </Button>
      </div>
      <p className="mt-6 text-xs text-stone">Razorpay has sent your payment receipt. Keep this link safe: anyone with the code can use the balance.</p>
    </m.div>
  );
}

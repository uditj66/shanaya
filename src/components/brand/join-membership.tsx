"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { abandonPayment, confirmPayment, startMembershipPurchase, type ConfirmResult } from "@/app/(brand)/b/[brand]/payment-actions";
import { openCheckout } from "@/lib/payments/checkout-client";
import { brandHref } from "@/lib/brand/href";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label } from "@/components/ui/form-controls";
import { Dialog, DialogContent } from "@/components/ui/overlays";

type Tier = { id: string; name: string; price: number; period: string };
type Done = NonNullable<Extract<ConfirmResult, { ok: true }>["membership"]>;
const day = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso)) : "");

/**
 * "Join" for one membership tier: a short form in a dialog, then Razorpay Checkout. The dialog closes before Checkout
 * opens, because its focus trap would otherwise block the payment window.
 */
export function JoinMembership({ brand, brandName, tier, studios, primary, testMode }: {
  brand: string;
  brandName: string;
  tier: Tier;
  studios: { value: string; label: string }[];
  primary: boolean;
  testMode: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Done | null>(null);

  const submit = async (form: FormData) => {
    const get = (k: string) => String(form.get(k) ?? "");
    const v = { name: get("name"), phone: get("phone"), email: get("email"), studio: get("studio") };
    setValues(v);
    setError(null);
    setFe({});
    setBusy(true);
    const start = await startMembershipPurchase({ brand, membershipId: tier.id, ...v, studio: v.studio || undefined, consent: form.get("consent") === "on" });
    if (!start.ok) {
      setFe(start.fieldErrors ?? {});
      setError(start.error);
      return setBusy(false);
    }
    setOpen(false);
    let outcome;
    try {
      outcome = await openCheckout(start);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open the payment window.");
      setOpen(true);
      return setBusy(false);
    }
    if (outcome.kind !== "paid") {
      void abandonPayment(start.orderId, outcome.kind === "failed" ? outcome.reason : "closed");
      setError(outcome.kind === "failed" ? `${outcome.reason} You haven't been charged; please try again.` : "Payment cancelled. Your details are still here when you're ready.");
      setOpen(true);
      return setBusy(false);
    }
    const r = await confirmPayment(outcome.result);
    setBusy(false);
    if (r.ok && r.membership) return setDone(r.membership);
    setError(r.ok ? "Paid. The studio will confirm your membership shortly." : r.error);
    setOpen(true);
  };

  const describe = (n: string) => (fe[n] ? { "aria-invalid": true as const, "aria-describedby": `jm-${tier.id}-e-${n}` } : {});
  const err = (n: string) => (fe[n] ? <p id={`jm-${tier.id}-e-${n}`} className="text-[0.8125rem] text-danger">{fe[n]}</p> : null);
  const id = (n: string) => `jm-${tier.id}-${n}`;

  if (done) {
    return (
      <div role="status" className="mt-10 rounded-xl border border-champagne bg-ivory p-5">
        <p className="eyebrow flex items-center gap-2"><Check aria-hidden="true" className="size-4" strokeWidth={1.75} /> Welcome to the circle</p>
        <p className="mt-2">
          {done.name.split(" ")[0]}, your {done.tier} membership runs {day(done.startsAt)} to {day(done.endsAt)}. Mention your mobile number at any studio.
        </p>
        <Button asChild size="sm" className="mt-4"><Link href={brandHref("/book")}>Book your first ritual</Link></Button>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <Button variant={primary ? "primary" : "quiet"} className="mt-10 self-start" onClick={() => setOpen(true)} disabled={busy}>
        {busy ? "Completing payment…" : `Join ${tier.name}`}
      </Button>
      <DialogContent title={`Join ${tier.name}`} description={`${formatPrice(tier.price)} a ${tier.period}, paid securely online.`}>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) void submit(new FormData(e.currentTarget));
          }}
          className="grid gap-5"
        >
          {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</p>}
          <div className="grid gap-2">
            <Label htmlFor={id("name")}>Your name</Label>
            <Input id={id("name")} name="name" autoComplete="name" defaultValue={values.name} {...describe("name")} />
            {err("name")}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid content-start gap-2">
              <Label htmlFor={id("phone")}>Mobile</Label>
              <Input id={id("phone")} name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={values.phone} {...describe("phone")} />
              {err("phone")}
            </div>
            <div className="grid content-start gap-2">
              <Label htmlFor={id("email")}>Email <span className="font-normal text-stone">(optional)</span></Label>
              <Input id={id("email")} name="email" type="email" autoComplete="email" defaultValue={values.email} {...describe("email")} />
              {err("email")}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={id("studio")}>Home studio <span className="font-normal text-stone">(optional)</span></Label>
            <select id={id("studio")} name="studio" defaultValue={values.studio ?? ""} className="h-12 w-full rounded-lg border border-line bg-white/80 px-4 text-[0.9375rem] focus-visible:border-brass focus-visible:ring-4 focus-visible:ring-brass/12 focus-visible:outline-none">
              <option value="">Any studio</option>
              {studios.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="grid gap-2">
            <div className="flex items-start gap-3">
              <Checkbox id={id("consent")} name="consent" className="mt-0.5" {...describe("consent")} />
              <Label htmlFor={id("consent")} className="font-normal leading-relaxed text-stone">
                I agree to the membership terms: it lasts one {tier.period} from today (or from the end of my current membership), is personal to me, and benefits apply at every {brandName} studio. See our{" "}
                <Link href={brandHref("/privacy")} className="underline underline-offset-4">privacy notice</Link>.
              </Label>
            </div>
            {err("consent")}
          </div>
          <Button type="submit" size="lg" disabled={busy}>{busy ? "Preparing…" : `Pay ${formatPrice(tier.price)}`}</Button>
          <p className="flex items-center gap-2 text-[0.8125rem] text-stone">
            <Lock aria-hidden="true" className="size-3.5" strokeWidth={1.5} /> Secure payment by Razorpay · UPI, cards, netbanking, wallets
          </p>
          {testMode && <p className="rounded-xl bg-linen/70 p-3 text-xs text-stone">Test mode: no real money is charged. Pay by UPI with success@razorpay (or failure@razorpay to try a failed payment).</p>}
        </form>
      </DialogContent>
    </Dialog>
  );
}

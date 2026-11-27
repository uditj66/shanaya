"use client";
import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { abandonPayment, cancelDepositHold, confirmPayment, depositCheckout, type ConfirmResult } from "@/app/(site)/payment-actions";
import { openCheckout } from "@/lib/payments/checkout-client";
import type { DepositCheckout } from "@/lib/payments/deposits";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type DepositPaid = NonNullable<Extract<ConfirmResult, { ok: true }>["deposit"]>;
const time = (iso: string) => new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso)).toLowerCase();
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/**
 * Pay the deposit for a held booking. Works with an order handed over by the server (website booking) or fetches it by
 * the booking's private token (chat card, pay page). The guest can retry until the hold ends, or let the time go.
 */
export function DepositPay({ token, checkout, amount, holdUntil, refundHours, autoOpen, compact, onPaid, onRelease }: {
  token: string;
  checkout?: DepositCheckout;
  amount: number;
  holdUntil: string | null;
  refundHours: number;
  autoOpen?: boolean;
  compact?: boolean;
  onPaid: (d: DepositPaid) => void;
  onRelease?: () => void;
}) {
  const [phase, setPhase] = useState<"idle" | "paying" | "confirming">("idle");
  const [note, setNote] = useState<{ error: boolean; text: string } | null>(null);
  const opened = useRef(false);

  const pay = async () => {
    setNote(null);
    setPhase("paying");
    const co = checkout ?? (await depositCheckout(token))?.checkout ?? null;
    if (!co) {
      setPhase("idle");
      return setNote({ error: true, text: "This hold has ended, so the time may have gone. Please choose a time again." });
    }
    let outcome;
    try {
      outcome = await openCheckout(co);
    } catch (e) {
      setPhase("idle");
      return setNote({ error: true, text: e instanceof Error ? e.message : "Couldn't open the payment window." });
    }
    if (outcome.kind !== "paid") {
      void abandonPayment(co.orderId, outcome.kind === "failed" ? outcome.reason : "closed");
      setPhase("idle");
      return setNote({ error: outcome.kind === "failed", text: outcome.kind === "failed" ? `${outcome.reason} You haven't been charged; please try again.` : `No payment taken.${holdUntil ? ` Your time is held until ${time(holdUntil)}.` : ""}` });
    }
    setPhase("confirming");
    const r = await confirmPayment(outcome.result);
    setPhase("idle");
    if (r.ok && r.deposit) return onPaid(r.deposit);
    setNote({ error: true, text: r.ok ? "Paid. The studio will confirm your booking shortly." : r.error });
  };

  useEffect(() => {
    // The flag is set inside the timer, so a Strict Mode remount (which cancels the first timer) still opens it once.
    if (autoOpen && !opened.current) {
      const t = setTimeout(() => {
        opened.current = true;
        void pay();
      }, 350);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cn("grid gap-3", compact && "text-sm")}>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size={compact ? "sm" : "lg"} disabled={phase !== "idle"} onClick={() => void pay()}>
          {phase === "paying" ? "Complete payment in the window…" : phase === "confirming" ? "Confirming…" : `Pay ${inr(amount)} deposit`}
        </Button>
        {onRelease && phase === "idle" && (
          <Button
            type="button"
            variant="link"
            onClick={() => {
              void cancelDepositHold(token);
              onRelease();
            }}
          >
            Choose another time
          </Button>
        )}
      </div>
      {note && <p role={note.error ? "alert" : "status"} className={cn("text-[0.8125rem]", note.error ? "text-danger" : "text-stone")}>{note.text}</p>}
      <p className="flex items-start gap-2 text-[0.8125rem] leading-relaxed text-stone">
        <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.5} />
        <span>
          {holdUntil ? `Held for you until ${time(holdUntil)}. ` : ""}The deposit comes off your bill at the studio, and is refunded in full if you cancel at least {refundHours} hours before.
        </span>
      </p>
    </div>
  );
}

"use client";
import { useState, useTransition } from "react";
import { previewRefund, refundOnlinePayment } from "./actions";

const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function RefundButton({ paymentId }: { paymentId: string; label?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            // The server works out the amount (memberships: price minus benefits used) before anything is refunded.
            const pv = await previewRefund(paymentId);
            if (!pv.ok) return setError(pv.error);
            if (pv.refund <= 0) return setError("Benefits already used are worth at least the price paid, so there is nothing to refund.");
            const lines = [
              pv.refund < pv.paid
                ? `Refund ${inr(pv.refund)} of the ${inr(pv.paid)} paid (${inr(pv.used ?? pv.paid - pv.refund)} of benefits already used).`
                : `Refund ${inr(pv.refund)} in full?`,
              pv.note,
              "The money goes back to the guest's original payment method in 5–7 days. This can't be undone.",
            ].filter(Boolean);
            if (!confirm(lines.join("\n\n"))) return;
            const r = await refundOnlinePayment(paymentId);
            if (!r.ok) setError(r.error);
          })
        }
        className="min-h-8 rounded-full px-3 text-xs text-danger ring-1 ring-danger/30 hover:bg-danger/5 disabled:opacity-50"
      >
        {pending ? "Working…" : "Refund"}
      </button>
      {error && <span role="alert" className="max-w-56 text-right text-xs text-danger">{error}</span>}
    </span>
  );
}

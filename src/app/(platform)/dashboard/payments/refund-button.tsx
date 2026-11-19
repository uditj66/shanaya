"use client";
import { useState, useTransition } from "react";
import { refundOnlinePayment } from "./actions";

export function RefundButton({ paymentId, label }: { paymentId: string; label: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            if (!confirm(`Refund ${label} in full? The money goes back to the guest's original payment method in 5–7 days. This can't be undone.`)) return;
            setError(null);
            const r = await refundOnlinePayment(paymentId);
            if (!r.ok) setError(r.error);
          })
        }
        className="min-h-8 rounded-full px-3 text-xs text-danger ring-1 ring-danger/30 hover:bg-danger/5 disabled:opacity-50"
      >
        {pending ? "Refunding…" : "Refund"}
      </button>
      {error && <span role="alert" className="max-w-56 text-right text-xs text-danger">{error}</span>}
    </span>
  );
}

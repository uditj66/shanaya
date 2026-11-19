"use client";
import { useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/admin/kit";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { Spinner } from "@/components/admin/ui/spinner";
import { previewRefund, refundOnlinePayment, type RefundPreview } from "./actions";

const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const NOTHING_TO_REFUND = "Benefits already used are worth at least the price paid, so there is nothing to refund.";

export function RefundButton({ paymentId }: { paymentId: string; label?: string }) {
  // The server works out the amount (memberships: price minus benefits used) when the dialog opens, before anything is refunded.
  const [pv, setPv] = useState<RefundPreview | null>(null);
  const req = useRef(0);

  const loadPreview = () => {
    const id = ++req.current;
    setPv(null);
    previewRefund(paymentId)
      .catch((e: unknown): RefundPreview => ({ ok: false, error: e instanceof Error ? e.message : "Couldn't work out the refund amount." }))
      .then((r) => {
        if (id === req.current) setPv(r);
      });
  };

  const description = !pv ? (
    <span className="flex items-center gap-2">
      <Spinner /> Working out the refund amount…
    </span>
  ) : !pv.ok ? (
    <span className="text-destructive">{pv.error}</span>
  ) : pv.refund <= 0 ? (
    <span className="text-destructive">{NOTHING_TO_REFUND}</span>
  ) : (
    <span className="grid gap-2">
      <span className="block font-medium text-foreground">
        {pv.refund < pv.paid
          ? `Refund ${inr(pv.refund)} of the ${inr(pv.paid)} paid (${inr(pv.used ?? pv.paid - pv.refund)} of benefits already used).`
          : `Refund ${inr(pv.refund)} in full?`}
      </span>
      {pv.note && <span className="block">{pv.note}</span>}
      <span className="block">The money goes back to the guest&apos;s original payment method in 5–7 days. This can&apos;t be undone.</span>
    </span>
  );

  return (
    <ConfirmAction
      destructive
      title="Refund this payment?"
      confirmDisabled={!pv || !pv.ok || pv.refund <= 0}
      description={description}
      confirmLabel={!pv ? "Checking…" : pv.ok && pv.refund > 0 ? `Refund ${inr(pv.refund)}` : "Refund"}
      success="Refund started. The money reaches the guest in 5–7 days."
      onConfirm={async () => {
        // Only refund once the manager has seen a valid amount.
        if (!pv) return "Still working out the refund amount. Try again in a moment.";
        if (!pv.ok) return pv.error;
        if (pv.refund <= 0) return NOTHING_TO_REFUND;
        return refundOnlinePayment(paymentId);
      }}
      trigger={
        <Button type="button" variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={loadPreview}>
          <RotateCcw aria-hidden /> Refund
        </Button>
      }
    />
  );
}

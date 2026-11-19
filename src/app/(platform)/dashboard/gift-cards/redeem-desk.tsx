"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Button, Field, Input, StatusBadge } from "@/components/admin/kit";
import { Spinner } from "@/components/admin/ui/spinner";
import { lookupGiftCard, redeemGiftCard, type CardView } from "./actions";

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const day = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

/** Front desk: look up a gift card by its code and take today's bill off the balance. */
export function RedeemDesk({ canRedeem }: { canRedeem: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [card, setCard] = useState<CardView | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  const lookup = () =>
    start(async () => {
      const r = await lookupGiftCard(code);
      if (r.ok) setCard(r.card);
      else {
        setCard(null);
        toast.error(r.error);
      }
    });

  const redeem = () =>
    start(async () => {
      if (!card) return;
      const r = await redeemGiftCard({ code: card.code, amount: Number(amount), note });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`Redeemed ${inr(Number(amount))}. Remaining balance ${inr(r.balance)}.`);
      setAmount("");
      setNote("");
      const again = await lookupGiftCard(card.code);
      if (again.ok) setCard(again.card);
      router.refresh();
    });

  const usable = card && card.status === "active" && card.balance > 0 && !card.expired;
  const stateWord = card ? (card.expired || card.status === "expired" ? "expired" : card.status === "active" ? "active" : "redeemed") : "";

  return (
    <div className="grid gap-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          lookup();
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <Field label="Gift card code" className="min-w-0 flex-1">
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="LUM-XXXX-XXXX" autoComplete="off" spellCheck={false} className="font-mono tracking-[0.12em]" />
        </Field>
        <Button type="submit" disabled={pending || code.trim().length < 8}>
          {pending && !card ? <Spinner /> : <Search aria-hidden />}
          Look up
        </Button>
      </form>

      {card && (
        <div className="rounded-lg border bg-muted/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-sm tracking-[0.12em]">{card.code}</p>
              <p className="mt-1 text-sm">
                For {card.recipient} · from {card.sender}
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <StatusBadge status={stateWord}>{stateWord === "redeemed" ? "fully used" : stateWord}</StatusBadge>
                <span>
                  {card.expiresAt ? `valid until ${day(card.expiresAt)} · ` : ""}originally {inr(card.amount)}
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Balance</p>
              <p className="tabular text-2xl font-semibold tracking-tight">{inr(card.balance)}</p>
            </div>
          </div>

          {usable && canRedeem && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                redeem();
              }}
              className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-[10rem_1fr_auto] sm:items-end"
            >
              <Field label="Amount to use (₹)">
                <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} className="tabular" />
              </Field>
              <Field label="Note (optional)">
                <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. Hydra facial, ref LUM123" />
              </Field>
              <Button type="submit" disabled={pending || !(Number(amount) > 0) || Number(amount) > card.balance}>
                {pending && <Spinner />}
                {pending ? "Redeeming…" : "Redeem"}
              </Button>
              {Number(amount) > card.balance && <p className="text-xs text-destructive sm:col-span-3">That&apos;s more than the balance; collect the difference separately.</p>}
            </form>
          )}
          {usable && !canRedeem && <p className="mt-4 text-sm text-muted-foreground">Choose a single studio in the studio selector to redeem.</p>}

          {card.redemptions.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <p className="text-xs font-medium text-muted-foreground">History</p>
              <ul className="mt-2 grid gap-1.5 text-sm">
                {card.redemptions.map((r, i) => (
                  <li key={i} className="flex flex-wrap justify-between gap-2">
                    <span>
                      {day(r.at)} · {r.studio}
                      {r.note ? ` · ${r.note}` : ""}
                    </span>
                    <span className="tabular">{r.amount < 0 ? `+${inr(-r.amount)}` : `−${inr(r.amount)}`}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

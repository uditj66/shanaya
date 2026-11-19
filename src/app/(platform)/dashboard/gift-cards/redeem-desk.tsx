"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const lookup = () =>
    start(async () => {
      setMsg(null);
      const r = await lookupGiftCard(code);
      if (r.ok) setCard(r.card);
      else {
        setCard(null);
        setMsg({ ok: false, text: r.error });
      }
    });

  const redeem = () =>
    start(async () => {
      if (!card) return;
      setMsg(null);
      const r = await redeemGiftCard({ code: card.code, amount: Number(amount), note });
      if (!r.ok) return setMsg({ ok: false, text: r.error });
      setMsg({ ok: true, text: `Redeemed ${inr(Number(amount))}. Remaining balance ${inr(r.balance)}.` });
      setAmount("");
      setNote("");
      const again = await lookupGiftCard(card.code);
      if (again.ok) setCard(again.card);
      router.refresh();
    });

  const usable = card && card.status === "active" && card.balance > 0 && !card.expired;

  return (
    <div className="grid gap-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          lookup();
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <label className="block min-w-0 flex-1">
          <span className="label">Gift card code</span>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="LUM-XXXX-XXXX" autoComplete="off" spellCheck={false} className="field font-mono tracking-[0.12em]" />
        </label>
        <button disabled={pending || code.trim().length < 8} className="min-h-11 rounded-full bg-charcoal px-5 text-sm text-ivory disabled:opacity-40">Look up</button>
      </form>

      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}

      {card && (
        <div className="rounded-2xl border border-line bg-ivory/60 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-sm tracking-[0.12em]">{card.code}</p>
              <p className="mt-1 text-sm">For {card.recipient} · from {card.sender}</p>
              <p className="mt-1 text-xs text-stone">
                {card.expired || card.status === "expired" ? "Expired" : card.status === "active" ? "Active" : "Fully used"}
                {card.expiresAt ? ` · valid until ${day(card.expiresAt)}` : ""} · originally {inr(card.amount)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-stone">Balance</p>
              <p className="display-cut text-[2rem] leading-none tabular-nums">{inr(card.balance)}</p>
            </div>
          </div>

          {usable && canRedeem && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                redeem();
              }}
              className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-[10rem_1fr_auto] sm:items-end"
            >
              <label className="block">
                <span className="label">Amount to use (₹)</span>
                <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} className="field tabular-nums" />
              </label>
              <label className="block">
                <span className="label">Note (optional)</span>
                <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. Hydra facial, ref LUM123" className="field" />
              </label>
              <button disabled={pending || !(Number(amount) > 0) || Number(amount) > card.balance} className="min-h-11 rounded-full bg-charcoal px-5 text-sm text-ivory disabled:opacity-40">
                {pending ? "Redeeming…" : "Redeem"}
              </button>
              {Number(amount) > card.balance && <p className="text-xs text-danger sm:col-span-3">That&apos;s more than the balance; collect the difference separately.</p>}
            </form>
          )}
          {usable && !canRedeem && <p className="mt-4 text-sm text-stone">Choose a single studio in the studio selector to redeem.</p>}

          {card.redemptions.length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <p className="text-xs font-medium text-stone">History</p>
              <ul className="mt-2 grid gap-1.5 text-sm">
                {card.redemptions.map((r, i) => (
                  <li key={i} className="flex flex-wrap justify-between gap-2">
                    <span>{day(r.at)} · {r.studio}{r.note ? ` · ${r.note}` : ""}</span>
                    <span className="tabular-nums">{r.amount < 0 ? `+${inr(-r.amount)}` : `−${inr(r.amount)}`}</span>
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

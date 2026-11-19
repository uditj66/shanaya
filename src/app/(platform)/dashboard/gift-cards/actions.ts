"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireArea } from "@/lib/session";

export type CardView = {
  code: string; recipient: string; sender: string; amount: number; balance: number; status: string; expiresAt: string | null; expired: boolean;
  redemptions: { amount: number; at: string; studio: string; note: string }[];
};
export type LookupResult = { ok: true; card: CardView } | { ok: false; error: string };
export type RedeemResult = { ok: true; balance: number } | { ok: false; error: string };

const Code = z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{8,24}$/, "Check the code");

/** Find a gift card by the code the guest shows. Row level security limits it to the team's brand. */
export async function lookupGiftCard(raw: string): Promise<LookupResult> {
  const code = Code.safeParse(raw.replace(/\s+/g, ""));
  if (!code.success) return { ok: false, error: "That doesn't look like a gift card code." };
  const s = await requireArea("giftcards");
  const { data: g } = await s.supabase
    .from("gift_cards")
    .select("id, code, recipient_name, sender_name, amount, balance, status, expires_at, gift_card_redemptions (amount, created_at, note, salon:salon_id (area, name))")
    .eq("code", code.data)
    .maybeSingle();
  if (!g || g.status === "pending" || g.status === "cancelled") return { ok: false, error: "No active gift card with that code." };
  return {
    ok: true,
    card: {
      code: g.code, recipient: g.recipient_name, sender: g.sender_name, amount: Number(g.amount), balance: Number(g.balance), status: g.status,
      expiresAt: g.expires_at,
      expired: !!g.expires_at && Date.parse(g.expires_at) < Date.now(),
      redemptions: (g.gift_card_redemptions ?? [])
        .map((r) => ({ amount: Number(r.amount), at: r.created_at, studio: r.salon?.area ?? r.salon?.name ?? "", note: r.note }))
        .sort((a, b) => b.at.localeCompare(a.at)),
    },
  };
}

const Redeem = z.object({ code: Code, amount: z.coerce.number().positive().max(100000), note: z.string().trim().max(200).default("") });
const REASONS: Record<string, string> = {
  not_allowed: "You can only redeem at your own studio.",
  not_found: "No gift card with that code.",
  expired: "This gift card has expired.",
  redeemed: "This gift card has already been fully used.",
  insufficient: "The amount is more than the balance.",
  pending: "This gift card hasn't been paid for.",
  cancelled: "This gift card was cancelled.",
  bad_amount: "Enter an amount.",
};

/** Take an amount off a gift card at the current studio (atomic in the database, so it can't be spent twice). */
export async function redeemGiftCard(input: z.input<typeof Redeem>): Promise<RedeemResult> {
  const v = Redeem.safeParse(input);
  if (!v.success) return { ok: false, error: "Check the code and amount." };
  const s = await requireArea("giftcards");
  if (s.isAll) return { ok: false, error: "Choose your studio in the studio selector first." };
  const { data, error } = await s.supabase.rpc("redeem_gift_card", { p_code: v.data.code, p_amount: v.data.amount, p_salon: s.salon.id, p_note: v.data.note });
  const r = (data ?? {}) as { ok?: boolean; reason?: string; balance?: number };
  if (error || !r.ok) return { ok: false, error: REASONS[r.reason ?? ""] ?? "Couldn't redeem. Please try again." };
  revalidatePath("/dashboard/gift-cards");
  return { ok: true, balance: Number(r.balance) };
}

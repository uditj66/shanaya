// After a voice call ends, read the transcript and update what Shanaya remembers: about the caller, and about every
// person a booking was made for on the call (callers often book for a mother, a sister-in-law or a friend).
// Runs after Vapi has been answered (next/server `after`), so it never slows a call. Any failure is logged and skipped.
import "server-only";
import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { adminClient } from "../supabase/admin";
import { logEvent } from "../events";
import { countryCodeFor, normalizePhone, todayIn } from "../time";
import { chatModel } from "./chat-model";
import { guestsOnCall, MEMORY_INSTRUCTIONS, memoryPrompt, MemorySchema, parseNotes, tidyNotes, type MemoryNote } from "./guest-memory";
import type { Json } from "../database.types";

const MIN_TRANSCRIPT = 200; // shorter than this, nothing worth remembering was said

type CallInfo = { callId: string; salonId: string; channel: "phone" | "web"; callerRaw: string | null; transcript: string | null; endedAt: string };

/**
 * The caller's own number. Phone: the caller ID. Website: only a number she proved by being recognised
 * (guest_history). People booked on the call are handled separately, by their booking.
 */
async function callerPhone(info: CallInfo, currency: string) {
  if (info.channel === "phone") return info.callerRaw ? normalizePhone(info.callerRaw, countryCodeFor(currency)) : null;
  const { data: call } = await adminClient().from("calls").select("agent_state").eq("id", info.callId).maybeSingle();
  return (call?.agent_state as { verified_phone?: string } | null)?.verified_phone ?? null;
}

export async function rememberCall(info: CallInfo) {
  try {
    if (!info.transcript || info.transcript.length < MIN_TRANSCRIPT) return;
    const db = adminClient();
    const { data: salon } = await db.from("salons").select("id, brand_name, currency, timezone").eq("id", info.salonId).maybeSingle();
    if (!salon) return;
    const { data: sisters } = salon.brand_name ? await db.from("salons").select("id").eq("brand_name", salon.brand_name) : { data: [{ id: salon.id }] };
    const branchIds = (sisters ?? []).map((s) => s.id);

    // Who this call was about: the caller, and everyone booked on it.
    const phone = await callerPhone(info, salon.currency);
    const [{ data: booked }, { data: callerRows }] = await Promise.all([
      db.from("bookings").select("salon_id, customer:customer_id (name, phone)").eq("call_id", info.callId).neq("status", "cancelled"),
      phone ? db.from("customers").select("name").in("salon_id", branchIds).eq("phone", phone).order("created_at", { ascending: false }).limit(1) : Promise.resolve({ data: [] as { name: string }[] }),
    ]);
    const guests = guestsOnCall(
      phone && phone.length >= 10 ? { phone, name: callerRows?.[0]?.name ?? null, salonId: info.salonId } : null,
      (booked ?? []).flatMap((b) => (b.customer ? [{ phone: b.customer.phone, name: b.customer.name, salonId: b.salon_id }] : [])),
    );
    if (!guests.length) return;

    // What we already remember about each (one memory per guest across the brand); skip anyone who opted out.
    const { data: rows } = await db.from("guest_memory").select("salon_id, phone, notes, opted_out").in("salon_id", branchIds).in("phone", guests.map((g) => g.phone));
    const today = todayIn(salon.timezone, new Date(info.endedAt));
    const listed = guests
      .filter((g) => !(rows ?? []).some((r) => r.phone === g.phone && r.opted_out))
      .map((g) => ({ ...g, existing: tidyNotes((rows ?? []).filter((r) => r.phone === g.phone).flatMap((r) => parseNotes(r.notes)), today) }));
    if (!listed.length) return;

    const { output } = await generateText({
      model: openai(chatModel()),
      output: Output.object({ schema: MemorySchema }),
      system: MEMORY_INSTRUCTIONS,
      prompt: memoryPrompt(listed, today, info.transcript),
      abortSignal: AbortSignal.timeout(45_000),
    });

    for (const [i, g] of listed.entries()) {
      const out = output.guests.find((x) => x.guest.trim().toUpperCase() === `G${i + 1}`);
      if (!out) continue; // the model skipped her: keep what we had
      // Notes the model kept unchanged keep their original date; new or reworded ones are dated to this call.
      const before = new Map(g.existing.map((n) => [n.text.toLowerCase(), n.at]));
      const notes: MemoryNote[] = tidyNotes(
        out.notes.map((n) => ({ ...n, until: n.until && /^\d{4}-\d{2}-\d{2}$/.test(n.until) ? n.until : null, at: before.get(n.text.toLowerCase()) ?? info.endedAt })),
        today,
      );
      // One row per guest per brand: write it on her branch for this call and fold away rows at sister branches.
      const { error } = await db
        .from("guest_memory")
        .upsert({ salon_id: g.salonId, phone: g.phone, notes: notes as unknown as Json, source_call_id: info.callId, updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
      const others = branchIds.filter((id) => id !== g.salonId);
      if (others.length) await db.from("guest_memory").delete().in("salon_id", others).eq("phone", g.phone);
    }
  } catch (e) {
    await logEvent(info.salonId, "call_error", { reason: "could not update guest memory", message: e instanceof Error ? e.message : String(e), call: info.callId });
  }
}

/** Website calls/chats: remember which number she proved, so the memory after the call goes to the right guest. */
export async function markVerifiedPhone(callId: string | null, phone: string) {
  if (!callId) return;
  const db = adminClient();
  const { data } = await db.from("calls").select("agent_state").eq("id", callId).maybeSingle();
  const state = (data?.agent_state ?? {}) as Record<string, unknown>;
  if (state.verified_phone === phone) return;
  await db.from("calls").update({ agent_state: { ...state, verified_phone: phone } as unknown as Json }).eq("id", callId);
}

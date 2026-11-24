// After a voice call ends, read the transcript and update what Shanaya remembers about that guest.
// Runs after Vapi has been answered (next/server `after`), so it never slows a call. Any failure is logged and skipped.
import "server-only";
import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { adminClient } from "../supabase/admin";
import { logEvent } from "../events";
import { countryCodeFor, normalizePhone, todayIn } from "../time";
import { chatModel } from "./chat-model";
import { MEMORY_INSTRUCTIONS, MemorySchema, parseNotes, tidyNotes, type MemoryNote } from "./guest-memory";
import type { Json } from "../database.types";

const MIN_TRANSCRIPT = 200; // shorter than this, nothing worth remembering was said

type CallInfo = { callId: string; salonId: string; channel: "phone" | "web"; callerRaw: string | null; transcript: string | null; endedAt: string };

/** Which guest was this? Phone: the caller ID. Website: only a number she proved (recognised, or booked with). */
async function guestPhone(info: CallInfo, currency: string) {
  if (info.channel === "phone") return info.callerRaw ? normalizePhone(info.callerRaw, countryCodeFor(currency)) : null;
  const db = adminClient();
  const { data: call } = await db.from("calls").select("agent_state").eq("id", info.callId).maybeSingle();
  const verified = (call?.agent_state as { verified_phone?: string } | null)?.verified_phone;
  if (verified) return verified;
  const { data: booking } = await db.from("bookings").select("customer:customer_id (phone)").eq("call_id", info.callId).limit(1).maybeSingle();
  return booking?.customer?.phone ?? null;
}

export async function rememberCall(info: CallInfo) {
  try {
    if (!info.transcript || info.transcript.length < MIN_TRANSCRIPT) return;
    const db = adminClient();
    const { data: salon } = await db.from("salons").select("id, brand_name, currency, timezone").eq("id", info.salonId).maybeSingle();
    if (!salon) return;
    const phone = await guestPhone(info, salon.currency);
    if (!phone || phone.length < 10) return;

    // Every branch of the brand shares one memory per guest.
    const { data: sisters } = salon.brand_name ? await db.from("salons").select("id").eq("brand_name", salon.brand_name) : { data: [{ id: salon.id }] };
    const branchIds = (sisters ?? []).map((s) => s.id);
    const { data: rows } = await db.from("guest_memory").select("salon_id, notes, opted_out").in("salon_id", branchIds).eq("phone", phone);
    if ((rows ?? []).some((r) => r.opted_out)) return; // she asked us not to remember her
    const today = todayIn(salon.timezone, new Date(info.endedAt));
    const existing = tidyNotes((rows ?? []).flatMap((r) => parseNotes(r.notes)), today);

    const { output } = await generateText({
      model: openai(chatModel()),
      output: Output.object({ schema: MemorySchema }),
      system: MEMORY_INSTRUCTIONS,
      prompt: `Call date: ${today}\n\nNotes on file:\n${existing.length ? existing.map((n) => `- [${n.kind}${n.until ? `, ${n.until}` : ""}] ${n.text}`).join("\n") : "(none)"}\n\nTranscript:\n${info.transcript.slice(-12000)}`,
      abortSignal: AbortSignal.timeout(45_000),
    });

    // Notes the model kept unchanged keep their original date; new or reworded ones are dated to this call.
    const before = new Map(existing.map((n) => [n.text.toLowerCase(), n.at]));
    const notes: MemoryNote[] = tidyNotes(
      output.notes.map((n) => ({ ...n, until: n.until && /^\d{4}-\d{2}-\d{2}$/.test(n.until) ? n.until : null, at: before.get(n.text.toLowerCase()) ?? info.endedAt })),
      today,
    );

    // One row per guest per brand: write it on this call's branch and fold away rows at sister branches.
    const { error } = await db
      .from("guest_memory")
      .upsert({ salon_id: info.salonId, phone, notes: notes as unknown as Json, source_call_id: info.callId, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    const others = branchIds.filter((id) => id !== info.salonId);
    if (others.length) await db.from("guest_memory").delete().in("salon_id", others).eq("phone", phone);
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

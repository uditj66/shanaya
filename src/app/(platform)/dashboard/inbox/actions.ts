"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { UIMessage } from "ai";
import { requireArea, type Session } from "@/lib/session";
import { adminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

type State = { ui?: UIMessage[]; turns?: number; takeover?: { by: string; at: string } | null };
export type InboxResult = { ok: true } | { ok: false; error: string };

const Id = z.string().uuid();
const Reply = z.string().trim().min(1).max(1000);

/** The first name the guest sees beside a team reply. */
function teamName(s: Session) {
  const meta = s.user.user_metadata as { name?: string; full_name?: string } | undefined;
  const raw = meta?.name || meta?.full_name || (s.user.email ?? "Team").split("@")[0].replace(/[._-]+/g, " ");
  const first = raw.trim().split(/\s+/)[0] || "Team";
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/**
 * Loads a website chat the signed-in team member may act on. The membership check uses their own (row level secured)
 * client; the write then goes through the service client, because guests' chats are written by the server.
 */
async function loadChat(callId: string) {
  const s = await requireArea("inbox");
  if (!Id.safeParse(callId).success) return null;
  const { data: call } = await s.supabase.from("calls").select("id, salon_id, channel").eq("id", callId).maybeSingle();
  if (!call || call.channel !== "web" || !s.salons.some((x) => x.id === call.salon_id)) return null;
  const db = adminClient();
  const { data } = await db.from("calls").select("agent_state, transcript").eq("id", call.id).single();
  return { s, db, call, state: (data?.agent_state ?? {}) as State, transcript: data?.transcript ?? "" };
}

export async function setTakeover(callId: string, on: boolean): Promise<InboxResult> {
  const c = await loadChat(callId);
  if (!c) return { ok: false, error: "That conversation isn't available." };
  const takeover = on ? { by: teamName(c.s), at: new Date().toISOString() } : null;
  const { error } = await c.db
    .from("calls")
    .update({ agent_state: { ...c.state, takeover } as unknown as Json })
    .eq("id", c.call.id);
  if (error) return { ok: false, error: "Couldn't update the conversation." };
  revalidatePath("/dashboard/inbox");
  return { ok: true };
}

/** A team member's reply. Replying also takes the chat over, so the AI doesn't answer on top of them. */
export async function sendTeamReply(callId: string, text: string): Promise<InboxResult> {
  const v = Reply.safeParse(text);
  if (!v.success) return { ok: false, error: "Write a message first (up to 1,000 characters)." };
  const c = await loadChat(callId);
  if (!c) return { ok: false, error: "That conversation isn't available." };
  const by = c.state.takeover?.by ?? teamName(c.s);
  const msg: UIMessage = { id: `staff_${crypto.randomUUID()}`, role: "assistant", metadata: { staff: by }, parts: [{ type: "text", text: v.data }] };
  const { error } = await c.db
    .from("calls")
    .update({
      agent_state: { ...c.state, takeover: c.state.takeover ?? { by, at: new Date().toISOString() }, ui: [...(c.state.ui ?? []), msg].slice(-60) } as unknown as Json,
      transcript: `${c.transcript}\nTeam (${by}): ${v.data}`.trim(),
      ended_at: new Date().toISOString(),
    })
    .eq("id", c.call.id);
  if (error) return { ok: false, error: "Couldn't send. Please try again." };
  revalidatePath("/dashboard/inbox");
  return { ok: true };
}

// Records problems for the dashboard Health page. Never throws: logging must not break a live call.
import "server-only";
import { adminClient } from "./supabase/admin";

export type EventKind = "tool_error" | "webhook_auth" | "call_error" | "cap_reached";

export async function logEvent(salonId: string | null, kind: EventKind, detail: Record<string, unknown> = {}) {
  try {
    await adminClient().from("agent_events").insert({ salon_id: salonId, kind, detail: JSON.parse(JSON.stringify(detail)) });
  } catch (e) {
    console.error("[events]", e);
  }
}

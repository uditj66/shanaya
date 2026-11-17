// Health events for the dashboard. Branch events are readable via RLS; chain-wide events (no branch,
// e.g. a request Vapi sent without the secret) can't be matched by RLS, so owners read them server-side.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { adminClient } from "./supabase/admin";
import { hoursAgo } from "./time";

/** Kinds that mean something went wrong (daily caps are expected limits, not problems). */
export const PROBLEM_KINDS = ["tool_error", "call_error", "webhook_auth"];

export async function healthEvents(db: SupabaseClient<Database>, salonId: string, role: string) {
  const since = hoursAgo(24);
  const owner = role === "owner";
  const [{ data: branch }, { data: chain }] = await Promise.all([
    db.from("agent_events").select("id, kind, detail, created_at, salon_id").eq("salon_id", salonId).order("created_at", { ascending: false }).limit(50),
    owner
      ? adminClient().from("agent_events").select("id, kind, detail, created_at, salon_id").is("salon_id", null).order("created_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const events = [...(branch ?? []), ...(chain ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 50);
  const recentProblems = events.filter((e) => e.created_at >= since && PROBLEM_KINDS.includes(e.kind)).length;
  return { events, recentProblems };
}

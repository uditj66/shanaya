// Rate limits and daily caps stored in Postgres, so they hold across every serverless instance.
import "server-only";
import { adminClient } from "./supabase/admin";
import { todayIn } from "./time";

/** true when the caller has exceeded `limit` hits within `windowSeconds` (fails open if the DB is unreachable). */
export async function rateLimited(key: string, limit = 30, windowSeconds = 60): Promise<boolean> {
  const { data, error } = await adminClient().rpc("hit_rate_limit", { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
  if (error) {
    console.error("[rate-limit]", error.message);
    return false;
  }
  return data === false;
}

/** Daily per-branch budget, e.g. website voice calls or chat messages. Counts one use per call. */
export async function overDailyCap(salonId: string, kind: "web_voice" | "chat", cap: number, timezone = "Asia/Kolkata") {
  return rateLimited(`cap:${kind}:${salonId}:${todayIn(timezone)}`, cap, 60 * 60 * 26);
}

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

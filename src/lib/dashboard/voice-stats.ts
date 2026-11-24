// How Shanaya's voice calls are going, from the call records the app already keeps (no extra tracking).
// Phone calls and website voice calls are counted apart; typed website chats are not voice calls.

export type CallRow = { channel: string; external_id: string | null; outcome: string | null; duration_seconds: number | null; ended_reason: string | null };
export type VoiceStats = { calls: number; avgSeconds: number; booked: number; dropped: number };

/** Vapi failures ("…-error-…", "…-vapifault-…", "pipeline…") rather than someone hanging up or going quiet. */
const FAILED = /error|fault|failed|pipeline/i;
/** A call this short didn't really happen: it dropped, failed to connect, or the guest gave up at once. */
export const EARLY_DROP_SECONDS = 15;

/** Website voice calls come from Vapi (they carry its call id); typed chats don't. */
export const isVoice = (c: Pick<CallRow, "channel" | "external_id">) => c.channel === "phone" || !!c.external_id;
export const isChat = (c: Pick<CallRow, "channel" | "external_id">) => c.channel === "web" && !c.external_id;

export function voiceStats(rows: CallRow[], channel: "phone" | "web"): VoiceStats {
  const calls = rows.filter((c) => isVoice(c) && c.channel === channel);
  const timed = calls.filter((c) => typeof c.duration_seconds === "number");
  return {
    calls: calls.length,
    avgSeconds: timed.length ? Math.round(timed.reduce((t, c) => t + (c.duration_seconds ?? 0), 0) / timed.length) : 0,
    booked: calls.filter((c) => c.outcome === "booked").length,
    dropped: calls.filter((c) => FAILED.test(c.ended_reason ?? "") || (typeof c.duration_seconds === "number" && c.duration_seconds < EARLY_DROP_SECONDS)).length,
  };
}

/** "3m 20s" */
export const callLength = (secs: number) => (secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`);

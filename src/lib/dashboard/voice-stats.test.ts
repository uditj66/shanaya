import { describe, expect, it } from "vitest";
import { callLength, isChat, voiceStats, type CallRow } from "./voice-stats";

const row = (o: Partial<CallRow>): CallRow => ({ channel: "web", external_id: "vapi-1", outcome: "info", duration_seconds: 120, ended_reason: "assistant-ended-call", ...o });

describe("voice call stats", () => {
  const rows = [
    row({ outcome: "booked", duration_seconds: 360 }),
    row({ duration_seconds: 0, ended_reason: "call.in-progress.error-vapifault-deepgram-transcriber-failed" }),
    row({ duration_seconds: 8, ended_reason: "customer-ended-call" }), // gave up at once
    row({ duration_seconds: 411, ended_reason: "silence-timed-out" }), // a real call that went quiet: not a drop
    row({ channel: "web", external_id: null, outcome: "booked", duration_seconds: null }), // a typed chat
    row({ channel: "phone", external_id: "vapi-2", outcome: "booked", duration_seconds: 200 }),
  ];

  it("counts website voice calls apart from typed chats and phone calls", () => {
    expect(voiceStats(rows, "web")).toEqual({ calls: 4, avgSeconds: Math.round((360 + 0 + 8 + 411) / 4), booked: 1, dropped: 2 });
    expect(voiceStats(rows, "phone")).toEqual({ calls: 1, avgSeconds: 200, booked: 1, dropped: 0 });
    expect(rows.filter(isChat)).toHaveLength(1);
  });

  it("reads call length naturally", () => {
    expect(callLength(45)).toBe("45s");
    expect(callLength(200)).toBe("3m 20s");
  });
});

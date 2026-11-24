"use client";
// Live voice conversation with Shanaya in the browser, through Vapi: the same voice, brain and tools as phone calls.
import { useCallback, useEffect, useRef, useState } from "react";
import type Vapi from "@vapi-ai/web";
import { cardFromToolResult, readToolResultMessage, type CallCard } from "./concierge/call-cards";

export type VoiceStatus = "idle" | "connecting" | "live" | "ended" | "error";

/** Vapi errors can be strings, arrays or nested objects: always turn them into readable text. */
function errorText(e: unknown, depth = 0): string {
  if (e == null || depth > 4) return "Voice connection problem.";
  if (typeof e === "string") return e;
  if (Array.isArray(e)) return e.map((x) => errorText(x, depth + 1)).join("; ");
  if (typeof e === "object") {
    const o = e as Record<string, unknown>;
    for (const k of ["message", "error", "errorMsg", "msg"]) if (o[k] != null) return errorText(o[k], depth + 1);
  }
  return String(e);
}

/** Browser microphone problems, said the way a guest understands them. */
export function friendlyVoiceError(raw: string) {
  if (/notallowed|permission|denied/i.test(raw)) return "Your microphone is blocked. Allow it from the icon in your browser's address bar, then try again.";
  if (/notfound|no (audio|microphone|device)|requested device/i.test(raw)) return "We couldn't find a microphone. Connect one, or chat by typing instead.";
  if (/notreadable|in use|could not start/i.test(raw)) return "Your microphone is busy in another app. Close it there, then try again.";
  return raw;
}

/** The line being spoken right now (for optional captions): updates word by word, then clears after a pause. */
export type Caption = { role: "ai" | "you"; text: string } | null;
const CAPTION_LINGER_MS = 3500;

/**
 * What Shanaya is doing between turns, so silence never feels like a dropped call:
 * thinking = the guest has finished and Shanaya hasn't started speaking; working = a booking tool is running.
 */
export type Activity = { kind: "thinking" } | { kind: "working"; label: string } | null;
const ACTIVITY_TIMEOUT_MS = 12000; // never leave a stale "thinking" on screen
const DROP_WINDOW_MS = 15000; // a call that ends within this long of a network interruption counts as dropped

const TOOL_LABELS: Record<string, string> = {
  check_availability: "Checking availability…",
  book_appointment: "Booking your appointment…",
  reschedule_appointment: "Moving your appointment…",
  cancel_appointment: "Cancelling your appointment…",
  find_appointments: "Finding your appointments…",
  guest_history: "Looking up your visits…",
  check_gift_card: "Checking your gift card…",
  request_callback: "Arranging a call-back…",
};

/** Vapi's "Meeting has ended" (type "ejected"): the server closed the call, normally or not. */
export function isEjection(e: unknown) {
  const s = JSON.stringify(e ?? "");
  return /"type":"ejected"|Meeting has ended/i.test(s);
}

/** Live loudness, 0 to 1, read by the orb on every frame (kept out of React state on purpose: it changes ~10×/s). */
export type Levels = { ai: number; you: number };

/* eslint-disable @typescript-eslint/no-explicit-any */
export function useShanayaVoice(configUrl: string, onTranscript?: (role: "ai" | "you", text: string) => void) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const [caption, setCaption] = useState<Caption>(null);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivityState] = useState<Activity>(null);
  // What the call shows on screen (time slots, the booking she made), from tool results, newest last.
  const [cards, setCards] = useState<CallCard[]>([]);
  const toolNames = useRef(new Map<string, string>()); // tool call id → tool name
  // Connection: a weak network shows a gentle notice; a call that drops right after an interruption is "dropped".
  const [weakNetwork, setWeakNetwork] = useState(false);
  const [dropped, setDropped] = useState(false);
  const interruptedAt = useRef(0);
  const userStopped = useRef(false);
  const vapiRef = useRef<Vapi | null>(null);
  const levels = useRef<Levels>({ ai: 0, you: 0 });
  // Was anything said on this call? A call that ends before a single word was a failed connection, not a hang-up.
  const heard = useRef(false);
  const failed = useRef(false);
  const captionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const activityTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const setActivity = useCallback((a: Activity) => {
    clearTimeout(activityTimer.current);
    setActivityState(a);
    if (a) activityTimer.current = setTimeout(() => setActivityState(null), ACTIVITY_TIMEOUT_MS);
  }, []);
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const stop = useCallback(async () => {
    userStopped.current = true;
    await vapiRef.current?.stop();
    setStatus("ended");
    setSpeaking(false);
    setCaption(null);
    setActivity(null);
  }, [setActivity]);

  const setMuted = useCallback((on: boolean) => {
    vapiRef.current?.setMuted(on);
    setMutedState(on);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setMutedState(false);
    setStartedAt(null);
    setEndedAt(null);
    setCaption(null);
    setActivity(null);
    levels.current = { ai: 0, you: 0 };
    heard.current = false;
    failed.current = false;
    userStopped.current = false;
    interruptedAt.current = 0;
    toolNames.current.clear();
    setCards([]);
    setWeakNetwork(false);
    setDropped(false);
    setStatus("connecting");
    try {
      const key = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
      if (!key) throw new Error("Voice calls are not set up yet.");
      const res = await fetch(configUrl, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !(data.assistantId || data.assistant)) throw new Error(data.error ?? "Could not start the call.");

      if (!vapiRef.current) {
        const { default: VapiClient } = await import("@vapi-ai/web");
        const vapi = new VapiClient(key);
        vapi.on("call-start", () => {
          setStatus("live");
          setStartedAt(Date.now());
        });
        vapi.on("call-end", () => {
          setEndedAt(Date.now());
          // The network gave way and the call ended by itself shortly after: say so, and offer to call back.
          if (!failed.current && !userStopped.current && heard.current && Date.now() - interruptedAt.current < DROP_WINDOW_MS) {
            failed.current = true;
            setDropped(true);
            setError("The call dropped because of a weak connection. You can call back, and Shanaya will pick up where you left off as best she can.");
            setStatus("error");
          }
          // keep the "couldn't connect" message on screen if the call failed before it began
          if (!failed.current) setStatus("ended");
          setWeakNetwork(false);
          setSpeaking(false);
          setCaption(null);
          setActivity(null);
          levels.current = { ai: 0, you: 0 };
        });
        vapi.on("speech-start", () => {
          heard.current = true;
          setSpeaking(true);
          setActivity(null); // she's talking: no longer thinking or working
        });
        vapi.on("speech-end", () => setSpeaking(false));
        // Listening before the call starts makes the SDK run its microphone level observer for this call.
        vapi.on("volume-level", (v: number) => (levels.current.ai = v));
        vapi.on("local-volume-level", (v: number) => (levels.current.you = v));
        // Daily's network events: quality thresholds ("good" / "low" / "very-low") and connection interruptions.
        vapi.on("network-quality-change", (e: any) => {
          const q = String(e?.threshold ?? e?.quality ?? "good");
          setWeakNetwork(q === "low" || q === "very-low");
        });
        vapi.on("network-connection", (e: any) => {
          if (e?.event === "interrupted") {
            interruptedAt.current = Date.now();
            setWeakNetwork(true);
          } else if (e?.event === "connected") setWeakNetwork(false);
        });
        vapi.on("message", (m: any) => {
          if (m?.type === "tool-calls") {
            const list = m.toolCallList ?? m.toolCalls ?? [];
            for (const c of list) if (c?.id && c?.function?.name) toolNames.current.set(c.id, c.function.name);
            const name = list[0]?.function?.name ?? "";
            if (TOOL_LABELS[name]) setActivity({ kind: "working", label: TOOL_LABELS[name] });
            return;
          }
          if (m?.type === "tool-calls-result") {
            const r = readToolResultMessage(m, toolNames.current);
            const card = r && cardFromToolResult(r.tool, r.result);
            if (card) setCards((c) => [...c.filter((x) => !(card.kind === "slots" && x.kind === "slots")), card]); // one slots card at a time
            return;
          }
          if (m?.type === "user-interrupted") return setActivity(null);
          if (m?.type !== "transcript" || !m.transcript) return;
          heard.current = true;
          const role = m.role === "assistant" ? "ai" : "you";
          // The guest finished a sentence: Shanaya is thinking until she starts to speak (or a tool starts working).
          if (role === "you" && m.transcriptType === "final") setActivity({ kind: "thinking" });
          setCaption({ role, text: m.transcript });
          clearTimeout(captionTimer.current);
          captionTimer.current = setTimeout(() => setCaption(null), CAPTION_LINGER_MS);
          if (m.transcriptType === "final") onTranscriptRef.current?.(role, m.transcript);
        });
        vapi.on("error", (e: any) => {
          // Vapi closes every call by "ejecting" the browser from the room: that's how a normal goodbye arrives too.
          if (isEjection(e)) {
            if (heard.current) return; // a normal end: call-end follows and shows "Call ended"
            failed.current = true; // ended before a word was said: the call never really started
            console.warn("[voice] call closed before it started", e);
            setError("Sorry, the call couldn't connect. Please try again in a moment, or chat by typing.");
            setStatus("error");
            return;
          }
          console.error("[voice]", e);
          setError(friendlyVoiceError(errorText(e)));
          setStatus("error");
        });
        vapiRef.current = vapi;
      }
      // Saved "Shanaya" assistant from the Vapi dashboard + live knowledge overrides (or a full fallback assistant).
      if (data.assistantId) await vapiRef.current.start(data.assistantId, data.assistantOverrides as any);
      else await vapiRef.current.start(data.assistant as any);
    } catch (e) {
      setError(friendlyVoiceError(errorText(e)));
      setStatus("error");
    }
  }, [configUrl, setActivity]);

  useEffect(
    () => () => {
      clearTimeout(captionTimer.current);
      clearTimeout(activityTimer.current);
      void vapiRef.current?.stop();
    },
    [],
  );

  return {
    status, speaking, muted, setMuted, startedAt, endedAt, caption, activity, levels, cards, weakNetwork, dropped, error, start, stop,
    live: status === "live" || status === "connecting",
  };
}

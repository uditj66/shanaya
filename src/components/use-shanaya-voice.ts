"use client";
// Live voice conversation with Shanaya in the browser, through Vapi: the same voice, brain and tools as phone calls.
import { useCallback, useEffect, useRef, useState } from "react";
import type Vapi from "@vapi-ai/web";

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
  const [caption, setCaption] = useState<Caption>(null);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivityState] = useState<Activity>(null);
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
    setCaption(null);
    setActivity(null);
    levels.current = { ai: 0, you: 0 };
    heard.current = false;
    failed.current = false;
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
          // keep the "couldn't connect" message on screen if the call failed before it began
          if (!failed.current) setStatus("ended");
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
        vapi.on("message", (m: any) => {
          if (m?.type === "tool-calls") {
            const name = (m.toolCallList ?? m.toolCalls ?? [])[0]?.function?.name ?? "";
            if (TOOL_LABELS[name]) setActivity({ kind: "working", label: TOOL_LABELS[name] });
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

  return { status, speaking, muted, setMuted, startedAt, caption, activity, levels, error, start, stop, live: status === "live" || status === "connecting" };
}

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

/* eslint-disable @typescript-eslint/no-explicit-any */
export function useShanayaVoice(configUrl: string, onTranscript?: (role: "ai" | "you", text: string) => void) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const vapiRef = useRef<Vapi | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const stop = useCallback(async () => {
    await vapiRef.current?.stop();
    setStatus("ended");
    setSpeaking(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
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
        vapi.on("call-start", () => setStatus("live"));
        vapi.on("call-end", () => {
          setStatus("ended");
          setSpeaking(false);
        });
        vapi.on("speech-start", () => setSpeaking(true));
        vapi.on("speech-end", () => setSpeaking(false));
        vapi.on("message", (m: any) => {
          if (m?.type === "transcript" && m.transcriptType === "final" && m.transcript) {
            onTranscriptRef.current?.(m.role === "assistant" ? "ai" : "you", m.transcript);
          }
        });
        vapi.on("error", (e: any) => {
          console.error("[voice]", e);
          setError(errorText(e));
          setStatus("error");
        });
        vapiRef.current = vapi;
      }
      // Saved "Shanaya" assistant from the Vapi dashboard + live knowledge overrides (or a full fallback assistant).
      if (data.assistantId) await vapiRef.current.start(data.assistantId, data.assistantOverrides as any);
      else await vapiRef.current.start(data.assistant as any);
    } catch (e) {
      setError(errorText(e));
      setStatus("error");
    }
  }, [configUrl]);

  useEffect(() => () => void vapiRef.current?.stop(), []);

  return { status, speaking, error, start, stop, live: status === "live" || status === "connecting" };
}

"use client";
import { useShanayaVoice } from "@/components/use-shanaya-voice";
import { VoiceOrb } from "@/components/voice-orb";

/** Shown when Shanaya is a saved assistant in Vapi: her voice and personality are edited there. */
export function VapiManaged({ assistantId, agentName }: { assistantId: string; agentName: string }) {
  const voice = useShanayaVoice("/api/voice-preview");
  return (
    <div className="space-y-3 rounded-xl border border-line bg-ivory p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">{agentName}&apos;s voice and personality are managed in Vapi</p>
          <p className="text-xs text-muted">One assistant for every branch, on phone and website. Changes in Vapi apply to the next call.</p>
        </div>
        {voice.live ? (
          <button type="button" onClick={voice.stop} className="flex items-center gap-2 rounded-full bg-danger px-3 py-1.5 text-xs font-medium text-white">
            <VoiceOrb active={voice.speaking} connecting={voice.status === "connecting"} size={18} /> End test call
          </button>
        ) : (
          <button type="button" onClick={voice.start} className="rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-ivory">
            ▶ Talk to {agentName}
          </button>
        )}
      </div>
      {voice.error && <p className="text-xs text-danger">{voice.error}</p>}
      <a
        href={`https://dashboard.vapi.ai/assistants/${assistantId}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium hover:border-gold"
      >
        Edit {agentName} in Vapi →
      </a>
      <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted">
        <li>Voice: Vapi → Assistant → Voice → pick a voice and press play to preview.</li>
        <li>Personality and greeting: Model → System prompt / First message. Keep the {"{{knowledge}}"} line: it carries live branches, menu and calendar.</li>
        <li>Services, prices, branches and hours: edit them here in your dashboard, never in Vapi.</li>
      </ul>
    </div>
  );
}

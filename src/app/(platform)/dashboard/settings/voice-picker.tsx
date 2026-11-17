"use client";
import { useState } from "react";
import { VOICE_PRESETS } from "@/lib/agent/voices";
import { useShanayaVoice } from "@/components/use-shanaya-voice";
import { VoiceOrb } from "@/components/voice-orb";

type Props = { provider: string; voiceId: string | null; model: string | null; speed: number; agentName: string };

/** Choose Shanaya's voice and hear it live. The preview uses the saved settings, i.e. exactly what callers hear. */
export function VoicePicker({ provider, voiceId, model, speed, agentName }: Props) {
  const current = VOICE_PRESETS.find((p) => p.provider === provider && p.voiceId === voiceId);
  const [choice, setChoice] = useState(current?.key ?? "custom");
  const [rate, setRate] = useState(speed);
  const voice = useShanayaVoice("/api/voice-preview");
  const preset = VOICE_PRESETS.find((p) => p.key === choice);

  return (
    <div className="space-y-3 rounded-xl border border-line bg-ivory p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{agentName}&apos;s voice</p>
          <p className="text-xs text-muted">The same voice is used on phone calls and website voice calls.</p>
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

      <div className="grid gap-2">
        {VOICE_PRESETS.map((p) => (
          <label key={p.key} className={`flex cursor-pointer gap-3 rounded-lg border bg-white p-3 ${choice === p.key ? "border-gold ring-2 ring-gold/20" : "border-line"}`}>
            <input type="radio" name="voice_preset" value={p.key} checked={choice === p.key} onChange={() => setChoice(p.key)} className="mt-1" />
            <span>
              <span className="block text-sm font-medium">{p.label}</span>
              <span className="block text-xs text-muted">{p.description}</span>
            </span>
          </label>
        ))}
        <label className={`flex cursor-pointer gap-3 rounded-lg border bg-white p-3 ${choice === "custom" ? "border-gold ring-2 ring-gold/20" : "border-line"}`}>
          <input type="radio" name="voice_preset" value="custom" checked={choice === "custom"} onChange={() => setChoice("custom")} className="mt-1" />
          <span className="block text-sm font-medium">Custom voice from Vapi&apos;s voice library</span>
        </label>
      </div>

      {choice === "custom" && (
        <div className="grid gap-2 sm:grid-cols-3">
          <input name="custom_provider" defaultValue={preset ? "" : provider} placeholder="Provider (11labs, cartesia…)" className="field" />
          <input name="custom_voice_id" defaultValue={preset ? "" : (voiceId ?? "")} placeholder="Voice ID" className="field" />
          <input name="custom_model" defaultValue={preset ? "" : (model ?? "")} placeholder="Model (optional)" className="field" />
        </div>
      )}

      <label className="block">
        <span className="label">Speaking pace: {rate.toFixed(2)}×</span>
        <input type="range" name="voice_speed" min={0.85} max={1.15} step={0.05} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="w-full accent-[var(--color-gold)]" />
      </label>
      <p className="text-xs text-muted">Save settings first, then press &quot;Talk to {agentName}&quot; to hear the change.</p>
    </div>
  );
}

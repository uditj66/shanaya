// Shanaya's voice. ONE definition used by phone calls, website voice calls and the Settings preview,
// so she sounds identical everywhere. All presets are female with an Indian-English accent.
import type { Json } from "../database.types";

export type VoicePreset = {
  key: string;
  label: string;
  description: string;
  provider: string;
  voiceId: string;
  model?: string;
};

export const VOICE_PRESETS: VoicePreset[] = [
  {
    key: "naina",
    label: "Shanaya (recommended): warm Indian-English",
    description: "Vapi's natural, friendly Indian-accented female voice. Human-like, low latency.",
    provider: "vapi",
    voiceId: "Naina",
  },
  {
    key: "neerja",
    label: "Shanaya: clear Indian-English (Neerja)",
    description: "Microsoft Azure neural voice for Indian English. Very clear and polished.",
    provider: "azure",
    voiceId: "en-IN-NeerjaNeural",
  },
];

/** Used only if a non-Vapi voice provider is down (Vapi voices fall back automatically). Female, Indian accent. */
const FALLBACKS: Record<string, { provider: string; voiceId: string }> = {
  default: { provider: "vapi", voiceId: "Naina" },
};

export const DEFAULT_VOICE = VOICE_PRESETS[0];

type SalonVoice = { voice_provider: string; voice_id: string | null; voice_model: string | null; voice_settings: Json };

export function presetFor(provider: string, voiceId: string | null) {
  return VOICE_PRESETS.find((p) => p.provider === provider && p.voiceId === voiceId) ?? null;
}

/** The exact Vapi `voice` object for a salon, including a same-gender, same-accent fallback. */
export function buildVoice(s: SalonVoice) {
  const provider = s.voice_provider || DEFAULT_VOICE.provider;
  const voiceId = s.voice_id || DEFAULT_VOICE.voiceId;
  const settings = (s.voice_settings && typeof s.voice_settings === "object" && !Array.isArray(s.voice_settings) ? s.voice_settings : {}) as Record<string, unknown>;
  const speed = typeof settings.speed === "number" ? Math.min(1.2, Math.max(0.8, settings.speed)) : 1;

  const voice: Record<string, unknown> = { provider, voiceId, speed };
  if (s.voice_model) voice.model = s.voice_model;
  if (provider === "11labs") {
    // Natural, expressive but steady delivery for a luxury front desk.
    Object.assign(voice, { stability: 0.45, similarityBoost: 0.8, style: 0.2, useSpeakerBoost: true });
  }

  // Vapi's own voices have managed auto-fallback built in, and Vapi rejects a custom fallbackPlan for them.
  if (provider === "vapi") return voice;
  const fb = FALLBACKS[provider] ?? FALLBACKS.default;
  if (!(fb.provider === provider && fb.voiceId === voiceId)) {
    voice.fallbackPlan = { voices: [{ provider: fb.provider, voiceId: fb.voiceId }] };
  }
  return voice;
}

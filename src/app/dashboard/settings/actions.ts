"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSalon } from "@/lib/session";
import { appUrl } from "@/lib/agent/vapi";
import { DEFAULT_VOICE, VOICE_PRESETS } from "@/lib/agent/voices";

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/**
 * One voice for phone + website: a curated preset, or a custom voice from Vapi's library.
 * When the voice is managed in the Vapi dashboard the picker isn't shown, so nothing is submitted:
 * leave the stored voice untouched (instead of silently resetting it to the default).
 */
function voiceFields(form: FormData) {
  if (!form.has("voice_preset")) return {};
  const speed = Math.min(1.15, Math.max(0.85, Number(s(form, "voice_speed")) || 1));
  const preset = VOICE_PRESETS.find((p) => p.key === s(form, "voice_preset"));
  if (preset) return { voice_provider: preset.provider, voice_id: preset.voiceId, voice_model: preset.model ?? null, voice_settings: { speed } };
  const provider = s(form, "custom_provider");
  const voiceId = s(form, "custom_voice_id");
  if (provider && voiceId) return { voice_provider: provider, voice_id: voiceId, voice_model: s(form, "custom_model") || null, voice_settings: { speed } };
  return { voice_provider: DEFAULT_VOICE.provider, voice_id: DEFAULT_VOICE.voiceId, voice_model: null, voice_settings: { speed } };
}

export async function saveSettings(form: FormData) {
  const { supabase, salon, isAdmin } = await requireSalon();
  if (!isAdmin) redirect("/dashboard/settings?error=Only owners and managers can change settings");

  // The form edits the first opening window of each day; keep any extra window (e.g. a split day) as it was.
  const current = (salon.business_hours ?? {}) as Record<string, [string, string][]>;
  const hours: Record<string, [string, string][]> = {};
  for (let d = 0; d < 7; d++) {
    const o = s(form, `open_${d}`);
    const c = s(form, `close_${d}`);
    hours[String(d)] = o && c && c > o ? [[o, c], ...(current[String(d)] ?? []).slice(1)] : [];
  }
  const num = (k: string, fallback: number) => (s(form, k) === "" || Number.isNaN(Number(s(form, k))) ? fallback : Number(s(form, k)));
  const vapiManaged = !!process.env.VAPI_ASSISTANT_ID;

  // A placeholder branch becomes "verified" once the owner enters a real address and phone number.
  const phone = s(form, "phone");
  const address = s(form, "address");
  const verified = salon.is_placeholder && !!phone && !!address && (phone !== (salon.phone ?? "") || address !== (salon.address ?? ""));

  const { error } = await supabase
    .from("salons")
    .update({
      name: s(form, "name"),
      phone: phone || null,
      address: address || null,
      ...(verified ? { is_placeholder: false } : {}),
      website: s(form, "website") || null,
      business_hours: hours,
      slot_interval_minutes: num("slot_interval_minutes", salon.slot_interval_minutes),
      min_notice_minutes: num("min_notice_minutes", salon.min_notice_minutes),
      max_days_ahead: num("max_days_ahead", salon.max_days_ahead),
      agent_name: s(form, "agent_name") || "Shanaya",
      agent_instructions: s(form, "agent_instructions"),
      policies: s(form, "policies"),
      llm_model: s(form, "llm_model") || "gpt-5.4-mini",
      // In Vapi-managed mode the greeting and voice model live in the Vapi dashboard; don't overwrite them here.
      ...(vapiManaged ? {} : { agent_greeting: s(form, "agent_greeting") || null, phone_llm_model: s(form, "phone_llm_model") || "gpt-4o" }),
      ...voiceFields(form),
      transfer_phone: s(form, "transfer_phone") || null,
      widget_enabled: form.get("widget_enabled") === "on",
    })
    .eq("id", salon.id);
  if (error) redirect(`/dashboard/settings?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/settings?saved=1");
}

/** Points a Vapi phone number at our webhook so incoming calls reach this salon's AI. */
export async function connectPhoneNumber(form: FormData) {
  const { supabase, salon, isAdmin } = await requireSalon();
  if (!isAdmin) redirect("/dashboard/settings?error=Only owners and managers can connect numbers");
  const phoneNumberId = s(form, "vapi_phone_number_id");
  if (!process.env.VAPI_API_KEY) redirect("/dashboard/settings?error=VAPI_API_KEY is not configured on the server");
  if (!phoneNumberId) redirect("/dashboard/settings?error=Enter the Vapi phone number ID");

  const server: Record<string, unknown> = { url: `${appUrl()}/api/vapi`, timeoutSeconds: 20 };
  if (process.env.VAPI_CREDENTIAL_ID) server.credentialId = process.env.VAPI_CREDENTIAL_ID;

  const res = await fetch(`https://api.vapi.ai/phone-number/${encodeURIComponent(phoneNumberId)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${process.env.VAPI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ assistantId: null, squadId: null, server }),
  });
  if (!res.ok) {
    const detail = await res.text();
    redirect(`/dashboard/settings?error=${encodeURIComponent(`Vapi rejected the update (${res.status}): ${detail.slice(0, 200)}`)}`);
  }
  const { error } = await supabase.from("salons").update({ vapi_phone_number_id: phoneNumberId }).eq("id", salon.id);
  if (error) redirect(`/dashboard/settings?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/dashboard/settings");
  redirect("/dashboard/settings?saved=phone");
}

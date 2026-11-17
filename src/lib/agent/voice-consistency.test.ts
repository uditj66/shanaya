// Guarantees Shanaya sounds and behaves the same on a phone call and a website voice call.
import { describe, expect, it } from "vitest";
import { buildVapiAssistant } from "./vapi";
import { buildVoice, VOICE_PRESETS } from "./voices";
import type { SalonContext } from "./context";

const salon = {
  id: "s1", name: "Lumière Facial Studio", slug: "lumiere", timezone: "Asia/Kolkata", currency: "INR",
  phone: null, address: null, website: null,
  business_hours: { "0": [["11:00", "18:00"]], "1": [["10:00", "20:00"]], "2": [], "3": [["10:00", "20:00"]], "4": [["10:00", "20:00"]], "5": [["10:00", "20:00"]], "6": [["10:00", "20:00"]] },
  slot_interval_minutes: 15, min_notice_minutes: 60, max_days_ahead: 60,
  agent_name: "Shanaya", agent_greeting: null, agent_instructions: "", policies: "",
  llm_model: "gpt-5.4-mini", phone_llm_model: "gpt-4o",
  voice_provider: "vapi", voice_id: "Naina", voice_model: null, voice_settings: { speed: 1 },
  vapi_phone_number_id: null, transfer_phone: "+919800000000", widget_enabled: true, created_at: "",
  brand_name: "Lumière Facial Studio & Spa", city: "Mumbai", area: "Bandra West", branch_code: "MUM-BAN", is_placeholder: false, guest_profiles: [],
} as SalonContext["salon"];
const ctx: SalonContext = { salon, services: [], staff: [{ id: "a", name: "Ananya", title: null }], packages: [], branches: [] };

describe("voice consistency (phone = website)", () => {
  const phone = buildVapiAssistant(ctx, "+919000012345", "phone");
  const web = buildVapiAssistant(ctx, null, "web");

  it("uses the identical voice, transcriber, greeting and turn-taking", () => {
    for (const key of ["voice", "transcriber", "firstMessage", "startSpeakingPlan", "stopSpeakingPlan", "backgroundSound", "endCallMessage"] as const) {
      expect(web[key], key).toEqual(phone[key]);
    }
    expect(web.model.model).toBe(phone.model.model);
  });

  it("uses the same personality prompt (only the caller-number line differs)", () => {
    // Allowed difference: on a phone call the caller's number is already known, on the website she asks for it.
    const strip = (p: string) =>
      p
        .replace(/\n# This call[\s\S]*$/, "")
        .replace(/now \d{2}:\d{2}/, "")
        .replace(/ \(their phone number is already known[^)]*\)| and a mobile number/, "<phone>");
    expect(strip(web.model.messages[0].content)).toBe(strip(phone.model.messages[0].content));
  });

  it("offers the same booking tools (transfer is phone-only)", () => {
    const names = (a: typeof phone) => a.model.tools.filter((t) => t.type === "function").map((t) => (t.function as { name: string }).name);
    expect(names(web)).toEqual(names(phone));
  });

  it("is female Indian-English with a same-style fallback, never a provider default", () => {
    expect(phone.voice).toMatchObject({ provider: "vapi", voiceId: "Naina" });
    expect(phone.voice.fallbackPlan).toBeUndefined(); // Vapi voices: managed auto-fallback, custom plan not allowed
    const neerja = buildVoice({ voice_provider: "azure", voice_id: "en-IN-NeerjaNeural", voice_model: null, voice_settings: {} });
    expect(neerja.fallbackPlan).toEqual({ voices: [{ provider: "vapi", voiceId: "Naina" }] });
    expect(VOICE_PRESETS.every((p) => /Indian/i.test(p.label + p.description))).toBe(true);
  });

  it("clamps speaking speed to a natural range", () => {
    expect(buildVoice({ voice_provider: "vapi", voice_id: "Naina", voice_model: null, voice_settings: { speed: 3 } }).speed).toBe(1.2);
  });
});

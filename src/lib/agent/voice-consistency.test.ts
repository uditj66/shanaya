// Guarantees Shanaya sounds and behaves the same on a phone call and a website voice call.
import { afterEach, describe, expect, it } from "vitest";
import { buildVapiAssistant, savedAssistantDefinition, vapiCallConfig } from "./vapi";
import { buildKnowledge, personaPrompt } from "./prompt";
import { buildVoice, VOICE_PRESETS } from "./voices";
import type { SalonContext } from "./context";

const salon = {
  id: "s1", name: "Lumière Facial Studio & Spa · Bandra West", slug: "lumiere", timezone: "Asia/Kolkata", currency: "INR",
  phone: "+91 22 4000 0000", address: "Linking Road, Bandra West, Mumbai 400050", website: null,
  business_hours: { "0": [["10:00", "20:00"]], "1": [["10:00", "21:00"]], "2": [["10:00", "21:00"]], "3": [["10:00", "21:00"]], "4": [["10:00", "21:00"]], "5": [["10:00", "21:00"]], "6": [["10:00", "21:00"]] },
  slot_interval_minutes: 15, min_notice_minutes: 60, max_days_ahead: 90,
  agent_name: "Shanaya", agent_greeting: null, agent_instructions: "", policies: "",
  llm_model: "gpt-5.4-mini", phone_llm_model: "gpt-4o",
  voice_provider: "vapi", voice_id: "Naina", voice_model: null, voice_settings: { speed: 1 },
  vapi_phone_number_id: null, transfer_phone: "+919800000000", widget_enabled: true, created_at: "",
  brand_name: "Lumière Facial Studio & Spa", city: "Mumbai", area: "Bandra West", branch_code: "MUM-BAN", is_placeholder: true, guest_profiles: [],
} as SalonContext["salon"];
const ctx: SalonContext = {
  salon,
  services: [],
  staff: [{ id: "a", name: "Ananya", title: null }],
  packages: [],
  branches: [{ id: "s2", name: "Lumière · Juhu", slug: "lumiere-mumbai-juhu", city: "Mumbai", area: "Juhu", address: "Juhu Tara Road", phone: null }],
};
const NOW = new Date("2026-11-18T06:30:00Z");
const stripCaller = (k: string) => k.replace(/\n# This call[\s\S]*$/, "").replace(/now \d{2}:\d{2}/, "");

afterEach(() => {
  delete process.env.VAPI_ASSISTANT_ID;
});

describe("saved Vapi assistant (managed in the Vapi dashboard)", () => {
  it("phone and website use the SAME saved assistant with the same live knowledge", () => {
    process.env.VAPI_ASSISTANT_ID = "asst_123";
    const phone = vapiCallConfig(ctx, "+919000012345", "phone") as { assistantId: string; assistantOverrides: { variableValues: Record<string, string>; server: unknown } };
    const web = vapiCallConfig(ctx, null, "web") as typeof phone;
    expect(phone.assistantId).toBe("asst_123");
    expect(web.assistantId).toBe(phone.assistantId); // voice, model, personality all come from this one assistant
    expect(stripCaller(web.assistantOverrides.variableValues.knowledge)).toBe(stripCaller(phone.assistantOverrides.variableValues.knowledge));
    expect(web.assistantOverrides.server).toEqual(phone.assistantOverrides.server);
  });

  it("knowledge lists every branch with an id, so she can ask which branch", () => {
    const k = buildKnowledge(ctx, { now: NOW });
    expect(k).toContain("[branch_id: s1]");
    expect(k).toContain("Juhu [branch_id: s2]");
    expect(k).toContain("(the line she reached)");
  });

  it("the saved assistant's prompt is the voice persona plus the {{knowledge}} slot", () => {
    const def = savedAssistantDefinition();
    expect(def.model.messages[0].content).toContain(personaPrompt("voice"));
    expect(def.model.messages[0].content).toContain("{{knowledge}}");
    expect(def.firstMessage).toContain("{{brand_name}}");
    expect(def.voice).toEqual({ provider: "vapi", voiceId: "Naina" });
  });

  it("persona asks for city and branch before booking", () => {
    expect(personaPrompt("voice")).toMatch(/which city and which area/i);
    expect(personaPrompt("chat")).toMatch(/which city and which area/i);
  });
});

describe("fallback transient assistant (no saved assistant)", () => {
  const phone = buildVapiAssistant(ctx, "+919000012345", "phone");
  const web = buildVapiAssistant(ctx, null, "web");

  it("uses the identical voice, transcriber, greeting and turn-taking", () => {
    for (const key of ["voice", "transcriber", "firstMessage", "startSpeakingPlan", "stopSpeakingPlan", "backgroundSound", "endCallMessage"] as const) {
      expect(web[key], key).toEqual(phone[key]);
    }
  });

  it("offers the same booking tools (transfer is phone-only)", () => {
    const names = (a: typeof phone) => a.model.tools.filter((t) => t.type === "function").map((t) => (t.function as { name: string }).name);
    expect(names(web)).toEqual(names(phone));
  });

  it("voice is female Indian-English; Vapi voices use Vapi's managed fallback", () => {
    expect(phone.voice).toMatchObject({ provider: "vapi", voiceId: "Naina" });
    expect(phone.voice.fallbackPlan).toBeUndefined();
    const neerja = buildVoice({ voice_provider: "azure", voice_id: "en-IN-NeerjaNeural", voice_model: null, voice_settings: {} });
    expect(neerja.fallbackPlan).toEqual({ voices: [{ provider: "vapi", voiceId: "Naina" }] });
    expect(VOICE_PRESETS.every((p) => /Indian/i.test(p.label + p.description))).toBe(true);
  });
});

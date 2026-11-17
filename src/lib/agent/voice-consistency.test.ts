// Guarantees Shanaya sounds and behaves the same on a phone call and a website voice call.
import { afterEach, describe, expect, it } from "vitest";
import { buildVapiAssistant, escapeLiquid, savedAssistantDefinition, SERVER_MESSAGES, vapiCallConfig } from "./vapi";
import { signSalon, verifySalon } from "./call-signature";
import { buildKnowledge, greeting, personaPrompt } from "./prompt";
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
  brand_name: "Lumière Facial Studio & Spa", city: "Mumbai", area: "Bandra West", branch_code: "MUM-BAN", is_placeholder: true, guest_profiles: [], daily_web_voice_cap: 100, daily_chat_cap: 500,
  brand_id: null, studio_slug: "bandra-west", latitude: null, longitude: null, hero_image: null, gallery: [], is_flagship: true, published: true,
} as SalonContext["salon"];
const ctx: SalonContext = {
  salon,
  services: [],
  staff: [{ id: "a", name: "Ananya", title: null }],
  packages: [],
  branches: [{ id: "s2", name: "Lumière · Juhu", slug: "lumiere-mumbai-juhu", city: "Mumbai", area: "Juhu", address: "Juhu Tara Road", phone: "+91 22 2600 1111", is_placeholder: false }],
};
const NOW = new Date("2026-11-18T06:30:00Z");
// "This conversation" (phone vs website) is the only intended difference between channels
const stripCaller = (k: string) => k.replace(/\n# This conversation[\s\S]*$/, "").replace(/now \d{2}:\d{2}/, "");

afterEach(() => {
  delete process.env.VAPI_ASSISTANT_ID;
});

describe("saved Vapi assistant (managed in the Vapi dashboard)", () => {
  it("phone and website use the SAME saved assistant with the same live knowledge", () => {
    process.env.VAPI_ASSISTANT_ID = "asst_123";
    type Cfg = { assistantId: string; assistantOverrides: { variableValues: Record<string, string> } & Record<string, unknown> };
    const phone = vapiCallConfig(ctx, "+919000012345", "phone") as unknown as Cfg;
    const web = vapiCallConfig(ctx, null, "web") as unknown as Cfg;
    expect(phone.assistantId).toBe("asst_123");
    expect(web.assistantId).toBe(phone.assistantId); // voice, model, personality all come from this one assistant
    expect(stripCaller(web.assistantOverrides.variableValues.knowledge)).toBe(stripCaller(phone.assistantOverrides.variableValues.knowledge));
    expect(phone.assistantOverrides.variableValues.salon_id).toBe("s1"); // how the webhook finds the branch
  });

  it("never overrides the server per call (Vapi would drop the webhook secret → 'unauthorised' tools)", () => {
    process.env.VAPI_ASSISTANT_ID = "asst_123";
    for (const ch of ["phone", "web"] as const) {
      const cfg = vapiCallConfig(ctx, null, ch) as unknown as { assistantOverrides: Record<string, unknown> };
      expect(cfg.assistantOverrides).not.toHaveProperty("server");
    }
  });

  it("knowledge lists every branch with an id, so she can ask which branch", () => {
    const k = buildKnowledge(ctx, { now: NOW });
    expect(k).toContain("[branch_id: s1]");
    expect(k).toContain("Juhu [branch_id: s2]");
    expect(k).toContain("(the line she reached)");
  });

  it("the saved assistant's prompt is the voice persona plus the {{knowledge}} slot", () => {
    const def = savedAssistantDefinition();
    expect(def.model.messages[0].content).toContain(personaPrompt("voice", "{{agent_name}}", "{{brand_name}}"));
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

describe("favourite therapist", () => {
  it("persona always asks for a preferred therapist and uses guest_history for 'same as last time'", () => {
    for (const mode of ["voice", "chat"] as const) {
      const p = personaPrompt(mode);
      expect(p).toMatch(/favourite therapist, doctor or beautician/i);
      expect(p).toContain("guest_history");
    }
  });

  it("knowledge lists each branch's team so names can be matched exactly", () => {
    const k = buildKnowledge({ ...ctx, team: [{ salon_id: "s2", name: "Meera", title: "Skin Therapist" }] }, { now: NOW });
    expect(k).toContain("Team: Meera (Skin Therapist)");
  });
});

describe("go-live safety", () => {
  it("never reads out a placeholder branch's phone or address, but does for verified branches", () => {
    const k = buildKnowledge(ctx, { now: NOW }); // entry branch is a placeholder, Juhu is verified
    expect(k).not.toContain("4000 0000");
    expect(k).not.toContain("Linking Road");
    expect(k).toContain("exact address and phone are shared by the studio");
    expect(k).toContain("Juhu Tara Road, +91 22 2600 1111");
  });

  it("greets with the recording notice on phone and website", () => {
    process.env.VAPI_ASSISTANT_ID = "";
    expect(savedAssistantDefinition().firstMessage).toMatch(/may be recorded/i);
    expect(buildVapiAssistant(ctx, null, "web").firstMessage).toMatch(/may be recorded/i);
  });

  it("persona hands off to a person by transfer on the phone and respects recording objections", () => {
    const p = personaPrompt("voice");
    expect(p).toContain("transfer_to_team");
    expect(p).toMatch(/objects to the call being recorded/i);
  });
});

describe("audit fixes: silent failures", () => {
  it("Vapi sends every message type the webhook handles (incl. transfers)", () => {
    expect(SERVER_MESSAGES).toEqual(expect.arrayContaining(["tool-calls", "end-of-call-report", "transfer-destination-request"]));
    expect(savedAssistantDefinition().serverMessages).toEqual(SERVER_MESSAGES);
  });

  it("the saved assistant uses the salon's agent and brand names, passed on every call", () => {
    process.env.VAPI_ASSISTANT_ID = "asst_123";
    const def = savedAssistantDefinition();
    expect(def.firstMessage).toContain("{{agent_name}}");
    expect(def.model.messages[0].content).toContain("You are {{agent_name}}");
    const cfg = vapiCallConfig({ ...ctx, salon: { ...salon, agent_name: "Aanya" } }, null, "web") as unknown as { assistantOverrides: { variableValues: Record<string, string> } };
    expect(cfg.assistantOverrides.variableValues.agent_name).toBe("Aanya");
  });
});

describe("audit fixes: branch signature", () => {
  it("accepts our own signature and rejects forged, swapped or expired ones", () => {
    const now = Date.parse("2026-11-18T10:00:00Z");
    const { salon_sig, sig_exp } = signSalon("s1", 3600, now);
    expect(verifySalon("s1", salon_sig, sig_exp, now)).toBe(true);
    expect(verifySalon("s2", salon_sig, sig_exp, now)).toBe(false); // other branch
    expect(verifySalon("s1", "forged", sig_exp, now)).toBe(false);
    expect(verifySalon("s1", salon_sig, sig_exp, now + 2 * 3600 * 1000)).toBe(false); // expired
    expect(verifySalon("s1", undefined, undefined, now)).toBe(false);
  });

  it("every call config carries a valid signature for its branch", () => {
    process.env.VAPI_ASSISTANT_ID = "asst_123";
    const v = (vapiCallConfig(ctx, null, "web") as unknown as { assistantOverrides: { variableValues: Record<string, string> } }).assistantOverrides.variableValues;
    expect(verifySalon(v.salon_id, v.salon_sig, v.sig_exp)).toBe(true);
  });
});

describe("audit fixes: chat vs voice", () => {
  it("typed chat greeting has no recording notice; voice greeting does", () => {
    expect(greeting(ctx, "chat")).not.toMatch(/recorded|calling/i);
    expect(greeting(ctx, "voice")).toMatch(/may be recorded/i);
  });

  it("chat persona has no phone-only instructions", () => {
    const chat = personaPrompt("chat");
    expect(chat).not.toContain("transfer_to_team");
    expect(chat).not.toMatch(/end the call|character by character|objects to the call/i);
    expect(chat).toMatch(/booking reference and mobile number/i);
  });

  it("knowledge tells her which kind of conversation it is", () => {
    expect(buildKnowledge(ctx, { mode: "phone", callerPhone: "+919000012345", now: NOW })).toMatch(/Phone call\. Caller's phone number/);
    expect(buildKnowledge(ctx, { mode: "web-voice", now: NOW })).toMatch(/transfer_to_team is NOT available/);
    expect(buildKnowledge(ctx, { mode: "chat", now: NOW })).toMatch(/Typed chat on the website/);
  });

  it("knowledge no longer claims all branches share hours and prices", () => {
    expect(buildKnowledge(ctx, { now: NOW })).not.toMatch(/All branches share/);
  });

  it("owner text can't inject Liquid template code into Vapi", () => {
    expect(escapeLiquid("Offer {{ secret }} and {% if x %}")).toBe("Offer { { secret } } and { % if x % }");
    process.env.VAPI_ASSISTANT_ID = "asst_123";
    const k = (vapiCallConfig({ ...ctx, salon: { ...salon, agent_instructions: "Use {{knowledge}} here" } }, null, "web") as unknown as {
      assistantOverrides: { variableValues: Record<string, string> };
    }).assistantOverrides.variableValues.knowledge;
    expect(k).not.toContain("{{knowledge}}");
  });
});

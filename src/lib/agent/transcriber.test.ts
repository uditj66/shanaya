// How Shanaya hears guests: mixed Hindi-English, with the brand's own names boosted.
import { afterEach, describe, expect, it } from "vitest";
import { estimateTokens, KEYTERM_TOKEN_BUDGET, keytermsFor, MAX_KEYTERMS, transcriberFor } from "./transcriber";
import { savedAssistantDefinition, SLOW_TOOL_LINES, vapiCallConfig } from "./vapi";
import type { SalonContext } from "./context";

const ctx = {
  salon: {
    id: "s1", name: "Lumière · Bandra West", brand_name: "Lumière Facial Studio & Spa", agent_name: "Shanaya", area: "Bandra West", city: "Mumbai",
    timezone: "Asia/Kolkata", currency: "INR", business_hours: {}, policies: "", agent_instructions: "", address: null, phone: null, is_placeholder: true, guest_profiles: [], brand_id: null,
  },
  branches: [
    { id: "s2", area: "Juhu", city: "Mumbai" },
    { id: "s3", area: "Park Street", city: "Kolkata" },
  ],
  team: [
    { salon_id: "s1", name: "Meera Iyer", title: "Senior therapist" },
    { salon_id: "s1", name: "Dr. Kavya Rao", title: "Dermatologist" },
    { salon_id: "s2", name: "meera", title: null },
  ],
  staff: [],
  services: [{ name: "HydraFacial" }, { name: "Korean Glass Skin Facial" }],
  packages: [{ name: "Royal Bridal Glow" }],
  memberships: [{ name: "Gold" }],
} as unknown as SalonContext;

afterEach(() => {
  delete process.env.VAPI_ASSISTANT_ID;
});

describe("transcriber", () => {
  it("boosts the brand, Shanaya, areas, therapists' first names, packages, tiers and treatments", () => {
    const k = keytermsFor(ctx);
    expect(k.slice(0, 3)).toEqual(["Lumière", "Shanaya", "Bandra West"]);
    for (const t of ["Bandra West", "Juhu", "Park Street", "Meera", "Kavya", "HydraFacial", "Korean Glass Skin Facial", "Royal Bridal Glow", "Gold"]) {
      expect(k).toContain(t);
    }
    expect(k).not.toContain("Mumbai"); // common words don't need boosting
    expect(k.indexOf("Royal Bridal Glow")).toBeLessThan(k.indexOf("HydraFacial")); // our own names before the generic menu
    expect(k.filter((t) => t.toLowerCase() === "meera")).toHaveLength(1); // no duplicates, whatever the case
    expect(k).not.toContain("Dr.");
  });

  it("stays far below Deepgram's ~500-token keyterm cap, which otherwise drops the call at once", () => {
    const big = { ...ctx, services: Array.from({ length: 150 }, (_, i) => ({ name: `Treatment number ${i} with a very long descriptive name indeed` })) } as unknown as SalonContext;
    const k = keytermsFor(big);
    const tokens = k.reduce((n, t) => n + estimateTokens(t), 0);
    expect(tokens).toBeLessThanOrEqual(KEYTERM_TOKEN_BUDGET);
    expect(KEYTERM_TOKEN_BUDGET).toBeLessThanOrEqual(300); // generous margin under Deepgram's 500
    expect(k.length).toBeLessThanOrEqual(MAX_KEYTERMS);
    expect(Math.max(...k.map((t) => t.length))).toBeLessThanOrEqual(50);
    expect(k.slice(0, 2)).toEqual(["Lumière", "Shanaya"]); // the most important names survive the cut
    expect(k).toContain("Meera");
  });

  it("estimates tokens pessimistically (Indian names split into more pieces than English words)", () => {
    expect(estimateTokens("Meera")).toBe(2);
    expect(estimateTokens("Korean Glass Skin Facial")).toBe(8);
  });

  it("keeps only letters, digits, spaces, apostrophes and hyphens", () => {
    const odd = { ...ctx, packages: [{ name: "Glow & Go (Express)" }, { name: "Valentine's Self-Love Ritual" }] } as unknown as SalonContext;
    const k = keytermsFor(odd);
    expect(k).toContain("Glow and Go Express");
    expect(k).toContain("Valentine's Self-Love Ritual");
    expect(k.every((t) => /^[\p{L}\p{N}\s'’-]+$/u.test(t))).toBe(true);
  });

  it("falls back to other transcribers instead of ending the call if Deepgram refuses the main setup", () => {
    expect(transcriberFor(ctx).fallbackPlan.transcribers).toEqual([
      { provider: "deepgram", model: "nova-3", language: "multi" },
      { provider: "deepgram", model: "nova-3", language: "en" },
    ]);
  });

  it("listens for mixed Hindi-English on every call, phone and website", () => {
    expect(transcriberFor(ctx)).toMatchObject({ provider: "deepgram", model: "nova-3", language: "multi" });
    process.env.VAPI_ASSISTANT_ID = "asst_123";
    const callCtx = { ...ctx, packages: [], memberships: [] } as unknown as SalonContext; // knowledge needs full rows for these
    for (const ch of ["phone", "web"] as const) {
      const cfg = vapiCallConfig(callCtx, null, ch) as unknown as { assistantOverrides: { transcriber: { language: string; keyterm: string[] } } };
      expect(cfg.assistantOverrides.transcriber.language).toBe("multi");
      expect(cfg.assistantOverrides.transcriber.keyterm).toContain("HydraFacial");
    }
  });

  it("slow booking tools say a calm line after a few seconds, instead of silence", () => {
    type Tool = { function?: { name: string }; messages?: { type: string; content?: string; timingMilliseconds?: number }[] };
    const tools = savedAssistantDefinition().model.tools as Tool[];
    for (const name of Object.keys(SLOW_TOOL_LINES)) {
      const msgs = tools.find((t) => t.function?.name === name)?.messages ?? [];
      expect(msgs).toEqual([expect.objectContaining({ type: "request-response-delayed", content: SLOW_TOOL_LINES[name] })]);
      expect(msgs.some((m) => m.type === "request-start")).toBe(false); // she already speaks before each tool
    }
  });
});

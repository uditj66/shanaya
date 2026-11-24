// Returning phone callers: recognised from caller ID, greeted by name as a question, details only after she confirms.
import { afterEach, describe, expect, it } from "vitest";
import { firstNameOf, nameMatches, returningGreeting, returningGuestSection, type ReturningGuest } from "./returning-guest";
import { buildKnowledge } from "./prompt";
import { vapiCallConfig } from "./vapi";
import type { SalonContext } from "./context";

const ctx = {
  salon: {
    id: "s1", name: "Lumière · Bandra West", brand_name: "Lumière Facial Studio & Spa", area: "Bandra West", city: "Mumbai",
    timezone: "Asia/Kolkata", currency: "INR", agent_name: "Shanaya", business_hours: {}, policies: "", agent_instructions: "",
    address: null, phone: null, is_placeholder: true, guest_profiles: [], brand_id: null,
  },
  services: [], staff: [], packages: [], branches: [],
} as unknown as SalonContext;

const guest: ReturningGuest = {
  name: "Ananya Sharma",
  firstName: "Ananya",
  visits: 3,
  lastVisit: { at: "2026-10-10T10:30:00Z", treatment: "HydraFacial", branch: "Lumière Facial Studio & Spa, Bandra West", therapist: "Meera" },
  favourite: { name: "Meera", branch: "Lumière Facial Studio & Spa, Bandra West", branchId: "s1", times: 3 },
  usualBranch: { name: "Lumière Facial Studio & Spa, Bandra West", branchId: "s1" },
  upcoming: { at: "2026-11-28T11:00:00Z", treatment: "Korean Glass Skin Facial", branch: "Lumière Facial Studio & Spa, Bandra West", reference: "LUM7K2" },
  member: { tier: "Gold", endsAt: "2027-03-01T00:00:00Z" },
  lastCall: { at: "2026-11-01T09:00:00Z", summary: "Asked about bridal packages for her sister's wedding in December." },
  notes: [],
};
const NOW = new Date("2026-11-24T06:30:00Z");

afterEach(() => {
  delete process.env.VAPI_ASSISTANT_ID;
});

describe("returning guests", () => {
  it("only says a first name that is safe to say aloud", () => {
    expect(firstNameOf("ananya sharma")).toBe("Ananya");
    expect(firstNameOf("  PRIYA ")).toBe("Priya");
    expect(firstNameOf("Guest")).toBeNull();
    expect(firstNameOf("Mrs. Kapoor")).toBeNull();
    expect(firstNameOf("9876543210")).toBeNull();
    expect(firstNameOf("A")).toBeNull();
    expect(firstNameOf("")).toBeNull();
  });

  it("website guests are recognised only when the first name matches the one on file", () => {
    expect(nameMatches("ananya", "Ananya Sharma")).toBe(true);
    expect(nameMatches("Ananya Sharma", "ANANYA")).toBe(true);
    expect(nameMatches("Ananiya", "Ananya")).toBe(true); // one mis-heard letter
    expect(nameMatches("Anaya", "Ananya")).toBe(true); // one dropped letter
    expect(nameMatches("Renée", "Renee")).toBe(true); // accents ignored
    expect(nameMatches("Priya", "Ananya")).toBe(false);
    expect(nameMatches("Riya", "Siya")).toBe(false); // short names must match exactly
    expect(nameMatches("Ananya", "Guest")).toBe(false);
    expect(nameMatches("", "Ananya")).toBe(false);
    expect(nameMatches("Ananya", null)).toBe(false);
  });

  it("forgives names that speech-to-text mis-hears but that sound the same (from a real call)", () => {
    expect(nameMatches("Archium", "Archana")).toBe(true); // heard on a live web call
    expect(nameMatches("Kavyaa", "Kavya")).toBe(true);
    expect(nameMatches("Ritika", "Radhika")).toBe(false); // sound-alike code, but a different name
    expect(nameMatches("Archana", "Anjali")).toBe(false);
    expect(nameMatches("Priya", "Pooja")).toBe(false);
    expect(nameMatches("Neha", "Nisha")).toBe(false);
  });

  it("website calls and chat recognise guests by number + first name, never by reference", () => {
    for (const mode of ["web-voice", "chat"] as const) {
      const k = buildKnowledge(ctx, { mode, now: NOW });
      expect(k).toContain("call guest_history with both");
      expect(k).toContain("Never say the number or name wasn't found");
      expect(k).not.toContain("visit history are only shared with a booking reference");
    }
    expect(buildKnowledge(ctx, { mode: "phone", callerPhone: "919876543210", now: NOW })).not.toContain("Recognising returning guests on the website");
  });

  it("greets by name as a question and keeps the recording notice", () => {
    const g = returningGreeting(guest, "Lumière", "Shanaya")!;
    expect(g).toContain("welcome back to Lumière");
    expect(g).toContain("Am I speaking with Ananya?");
    expect(g).toContain("may be recorded");
    expect(returningGreeting({ ...guest, firstName: null }, "Lumière", "Shanaya")).toBeNull();
  });

  it("tells her to confirm identity before sharing anything, then gives the facts", () => {
    const s = returningGuestSection(guest, "Asia/Kolkata");
    expect(s).toMatch(/share NONE of the details below/);
    expect(s).toContain("HydraFacial");
    expect(s).toContain("with Meera");
    expect(s).toContain("[branch_id: s1]");
    expect(s).toContain("ref LUM7K2");
    expect(s).toContain("Gold member");
    expect(s).toContain("bridal packages");
    expect(s).toContain("Saturday 28 November at 4:30 PM"); // 11:00 UTC in IST
  });

  it("uses remembered notes instead of the raw call summary once there are some", () => {
    const withNotes: ReturningGuest = {
      ...guest,
      notes: [{ text: "Sister's wedding; wants a bridal glow before it", kind: "occasion", until: "2026-12-12", at: "2026-11-01T09:00:00Z" }],
    };
    const s = returningGuestSection(withNotes, "Asia/Kolkata", NOW);
    expect(s).toContain("What she has shared in earlier conversations");
    expect(s).toContain("Occasion (Sat 12 Dec 2026): Sister's wedding");
    expect(s).not.toContain("Her last call");
  });

  it("a caller who only enquired (no bookings) is remembered without a name", () => {
    const enquiry: ReturningGuest = { ...guest, name: "", firstName: null, visits: 0, lastVisit: null, favourite: null, usualBranch: null, upcoming: null, member: null, lastCall: null, notes: [{ text: "Interested in laser hair removal", kind: "concern", until: null, at: "2026-11-20T09:00:00Z" }] };
    const s = returningGuestSection(enquiry, "Asia/Kolkata", NOW);
    expect(s).toContain("never booked");
    expect(s).toContain("Ask warmly for her name");
    expect(returningGreeting(enquiry, "Lumière", "Shanaya")).toBeNull();
  });

  it("goes into the knowledge on phone calls only", () => {
    const phone = buildKnowledge(ctx, { mode: "phone", callerPhone: "919876543210", guest, now: NOW });
    expect(phone).toContain("# Returning guest");
    expect(buildKnowledge(ctx, { mode: "web-voice", guest, now: NOW })).not.toContain("Returning guest");
    expect(buildKnowledge(ctx, { mode: "chat", guest, now: NOW })).not.toContain("Returning guest");
    expect(buildKnowledge(ctx, { mode: "phone", callerPhone: "919876543210", now: NOW })).not.toContain("Returning guest");
  });

  it("overrides the greeting for recognised phone callers only", () => {
    process.env.VAPI_ASSISTANT_ID = "asst_123";
    type Cfg = { assistantOverrides: { firstMessage?: string; variableValues: Record<string, string> } };
    const known = vapiCallConfig(ctx, "+919876543210", "phone", guest) as unknown as Cfg;
    expect(known.assistantOverrides.firstMessage).toContain("Am I speaking with Ananya?");
    expect(known.assistantOverrides.variableValues.knowledge).toContain("# Returning guest");
    const stranger = vapiCallConfig(ctx, "+919876543210", "phone", null) as unknown as Cfg;
    expect(stranger.assistantOverrides).not.toHaveProperty("firstMessage");
    const web = vapiCallConfig(ctx, null, "web", guest) as unknown as Cfg;
    expect(web.assistantOverrides).not.toHaveProperty("firstMessage");
    expect(web.assistantOverrides.variableValues.knowledge).not.toContain("Returning guest");
  });
});

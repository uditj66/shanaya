// Typing the mobile number during a website call instead of saying it.
import { describe, expect, it } from "vitest";
import { ASKS_FOR_NUMBER, cleanMobile, typedNumberMessage } from "./use-shanaya-voice";
import { buildKnowledge } from "../lib/agent/prompt";
import type { SalonContext } from "../lib/agent/context";

const ctx = {
  salon: { id: "s1", name: "Lumière", brand_name: "Lumière", area: "Bandra West", city: "Mumbai", timezone: "Asia/Kolkata", currency: "INR", agent_name: "Shanaya", business_hours: {}, policies: "", agent_instructions: "", address: null, phone: null, is_placeholder: true, guest_profiles: [], brand_id: null },
  services: [], staff: [], packages: [], branches: [],
} as unknown as SalonContext;

describe("typed mobile numbers", () => {
  it("accepts a 10-digit Indian mobile however it's typed", () => {
    expect(cleanMobile("98765 43210")).toBe("9876543210");
    expect(cleanMobile("+91 98765-43210")).toBe("9876543210");
    expect(cleanMobile("09876543210")).toBe("9876543210");
    expect(cleanMobile("98765")).toBeNull();
    expect(cleanMobile("1234567890")).toBeNull(); // Indian mobiles start with 6–9
  });

  it("opens the box when Shanaya asks for a number (her real phrasings)", () => {
    for (const s of ["May I have your mobile number, please?", "Please share Sakshi's mobile number.", "Could you type your mobile number in the box on your screen?", "Please say all 10 digits once more.", "What's the best phone number for the booking?", "May I have your first name and the number the booking is under?"]) {
      expect(ASKS_FOR_NUMBER.test(s)).toBe(true);
    }
    for (const s of ["Your booking is confirmed for Sunday at 3 pm.", "We have three studios in Mumbai."]) {
      expect(ASKS_FOR_NUMBER.test(s)).toBe(false);
    }
  });

  it("marks a typed number as exact, and only website calls are told about the box", () => {
    expect(typedNumberMessage("9876543210")).toBe("My mobile number is 9876543210 (typed on screen, exact).");
    expect(buildKnowledge(ctx, { mode: "web-voice" })).toContain("type your mobile number in the box on your screen");
    expect(buildKnowledge(ctx, { mode: "phone", callerPhone: "919876543210" })).not.toContain("box on your screen");
    expect(buildKnowledge(ctx, { mode: "chat" })).not.toContain("box on your screen");
  });
});

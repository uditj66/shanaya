// Guest memory: what is kept between conversations, and what never is.
import { describe, expect, it } from "vitest";
import { guestsOnCall, isSensitive, MAX_NOTES, memoryLines, memoryPrompt, parseNotes, tidyNotes, type MemoryNote } from "./guest-memory";

const note = (text: string, at: string, extra: Partial<MemoryNote> = {}): MemoryNote => ({ text, kind: "preference", until: null, at, ...extra });
const TODAY = "2026-11-24";

describe("guest memory", () => {
  it("never keeps health or payment details, even if the model returns them", () => {
    for (const t of ["Allergic to nuts", "She is pregnant", "On isotretinoin", "Has PCOS", "Gave her card number", "Shared the OTP", "Has eczema on her arms"]) {
      expect(isSensitive(t)).toBe(true);
    }
    for (const t of ["Prefers Meera", "Sister's wedding on 12 December", "Likes firm pressure", "Dull skin before winter"]) {
      expect(isSensitive(t)).toBe(false);
    }
    expect(tidyNotes([note("Allergic to lavender oil", "2026-11-01"), note("Prefers evenings", "2026-11-01")], TODAY).map((n) => n.text)).toEqual(["Prefers evenings"]);
  });

  it("drops occasions a month after they happened, keeps upcoming and undated ones", () => {
    const kept = tidyNotes(
      [
        note("Diwali party", "2026-10-01", { kind: "occasion", until: "2026-10-20" }), // 35 days ago: gone
        note("Office party", "2026-11-01", { kind: "occasion", until: "2026-11-10" }), // 14 days ago: still worth asking about
        note("Sister's wedding", "2026-11-01", { kind: "occasion", until: "2026-12-12" }),
        note("Prefers Meera", "2026-09-01"),
      ],
      TODAY,
    ).map((n) => n.text);
    expect(kept).toEqual(["Office party", "Sister's wedding", "Prefers Meera"]);
  });

  it("de-duplicates (newest wording wins) and keeps the newest notes only", () => {
    const tidy = tidyNotes([note("Prefers Meera!", "2026-01-01"), note("prefers  meera", "2026-06-01")], TODAY);
    expect(tidy).toHaveLength(1);
    expect(tidy[0].at).toBe("2026-06-01");
    const many = Array.from({ length: 20 }, (_, i) => note(`Note ${i}`, `2026-11-${String(i + 1).padStart(2, "0")}`));
    const kept = tidyNotes(many, TODAY);
    expect(kept).toHaveLength(MAX_NOTES);
    expect(kept[0].text).toBe("Note 19");
  });

  it("drops malformed stored notes instead of trusting them", () => {
    const parsed = parseNotes([{ text: "Prefers Meera", kind: "preference", until: null, at: "2026-11-01" }, { kind: "occasion" }, "junk", null, { text: "x", kind: "weird", until: "12 Dec" }]);
    expect(parsed).toHaveLength(2);
    expect(parsed[1]).toMatchObject({ text: "x", kind: "preference", until: null });
    expect(parseNotes("not an array")).toEqual([]);
  });

  it("remembers everyone a call was about: the caller and each person booked (from a real call)", () => {
    const guests = guestsOnCall({ phone: "919800000001", name: "Ritika", salonId: "bandra" }, [
      { phone: "919800000002", name: "Empla", salonId: "anna-nagar" }, // her sister-in-law
      { phone: "919800000001", name: "Sunita", salonId: "koramangala" }, // her mother, booked on her number
      { phone: "919800000002", name: "empla", salonId: "anna-nagar" }, // a second treatment for the same person
      { phone: "123", name: "Bad number", salonId: "x" },
    ]);
    expect(guests).toEqual([
      { phone: "919800000001", salonId: "bandra", names: ["Ritika", "Sunita"], isCaller: true },
      { phone: "919800000002", salonId: "anna-nagar", names: ["Empla"], isCaller: false },
    ]);
    // an unproven website caller: only the people booked
    expect(guestsOnCall(null, [{ phone: "919800000002", name: "Empla", salonId: "a" }])).toEqual([{ phone: "919800000002", salonId: "a", names: ["Empla"], isCaller: false }]);
  });

  it("labels guests G1, G2… and never sends their phone numbers to the AI", () => {
    const p = memoryPrompt(
      [
        { phone: "919800000001", salonId: "a", names: ["Ritika", "Sunita"], isCaller: true, existing: [note("Prefers evenings", "2026-11-01")] },
        { phone: "919800000002", salonId: "b", names: ["Empla"], isCaller: false, existing: [] },
      ],
      TODAY,
      "Guest: book my sister-in-law Empla, she has a client meeting on Thursday",
    );
    expect(p).toContain("G1: the CALLER (Ritika, Sunita)");
    expect(p).toContain("G2: booked on this call: Empla");
    expect(p).toContain("[preference] Prefers evenings");
    expect(p).not.toMatch(/9800000001|9800000002/);
  });

  it("reads naturally in the prompt", () => {
    const lines = memoryLines([note("Sister's wedding", "2026-11-01", { kind: "occasion", until: "2026-11-10" }), note("Didn't like the steam room", "2026-11-01", { kind: "dislike" })], "Asia/Kolkata", TODAY);
    expect(lines[0]).toBe("- Occasion (was Tue 10 Nov 2026): Sister's wedding");
    expect(lines[1]).toBe("- Didn't enjoy: Didn't like the steam room");
  });
});

// Guest memory: what is kept between conversations, and what never is.
import { describe, expect, it } from "vitest";
import { isSensitive, MAX_NOTES, memoryLines, parseNotes, tidyNotes, type MemoryNote } from "./guest-memory";

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

  it("reads naturally in the prompt", () => {
    const lines = memoryLines([note("Sister's wedding", "2026-11-01", { kind: "occasion", until: "2026-11-10" }), note("Didn't like the steam room", "2026-11-01", { kind: "dislike" })], "Asia/Kolkata", TODAY);
    expect(lines[0]).toBe("- Occasion (was Tue 10 Nov 2026): Sister's wedding");
    expect(lines[1]).toBe("- Didn't enjoy: Didn't like the steam room");
  });
});

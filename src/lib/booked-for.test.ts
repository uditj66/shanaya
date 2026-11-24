// Families share phones: a booking for someone else on a number keeps the guest on file and names who it's for.
import { describe, expect, it } from "vitest";
import { bookedFor, isPlaceholderName } from "./booking-service";

describe("who a booking is for", () => {
  it("names the person coming in when she isn't the guest on file for that number (from a real call)", () => {
    expect(bookedFor("Sakshi", "Sudha")).toBe("Sakshi"); // sister-in-law booked on Sudha's phone
    expect(bookedFor("  sudha ", "Sudha")).toBeNull(); // the guest herself, however it's typed
    expect(bookedFor("", "Sudha")).toBeNull();
    expect(bookedFor("Guest", "Sudha")).toBeNull();
  });

  it("only replaces stand-in names on the guest record", () => {
    expect(isPlaceholderName("Guest")).toBe(true);
    expect(isPlaceholderName("  ")).toBe(true);
    expect(isPlaceholderName("unknown")).toBe(true);
    expect(isPlaceholderName("Sudha")).toBe(false);
  });
});

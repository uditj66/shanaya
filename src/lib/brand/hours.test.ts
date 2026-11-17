import { describe, expect, it } from "vitest";
import { hoursRows, openState, openingHoursSpec } from "./hours";

const hours = { "0": ["10:00 20:00"], "1": ["10:00 21:00"], "2": ["10:00 21:00"], "3": ["10:00 21:00"], "4": ["10:00 21:00"], "5": ["10:00 21:00"], "6": ["10:00 21:00"] } as never;
const TZ = "Asia/Kolkata";

describe("hours", () => {
  it("merges consecutive days, Monday first", () => {
    expect(hoursRows(hours)).toEqual([
      { days: "Mon – Sat", hours: "10:00–21:00" },
      { days: "Sunday", hours: "10:00–20:00" },
    ]);
  });

  it("accepts the [[open, close]] shape and closed days", () => {
    expect(hoursRows({ "0": [], "1": [["11:00", "18:00"]], "2": [], "3": [], "4": [], "5": [], "6": [] })[0]).toEqual({ days: "Monday", hours: "11:00–18:00" });
  });

  it("builds schema.org opening hours", () => {
    expect(openingHoursSpec(hours)).toHaveLength(7);
    expect(openingHoursSpec(hours)[0]).toMatchObject({ dayOfWeek: "Sunday", opens: "10:00", closes: "20:00" });
  });

  it("knows when a studio is open", () => {
    // Wednesday 2026-11-18 15:00 IST = 09:30 UTC
    expect(openState(hours, TZ, new Date("2026-11-18T09:30:00Z"))).toEqual({ open: true, text: "Open now · until 21:00" });
    // 08:00 IST, before opening
    expect(openState(hours, TZ, new Date("2026-11-18T02:30:00Z")).text).toBe("Closed · opens at 10:00");
    // 22:00 IST, after closing
    expect(openState(hours, TZ, new Date("2026-11-18T16:30:00Z")).text).toBe("Closed · opens tomorrow at 10:00");
  });
});

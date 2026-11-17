import { describe, expect, it } from "vitest";
import { computeSlots, pickSlots, type SlotInput } from "./availability";
import { zonedToDate } from "./time";

const TZ = "Asia/Kolkata";
const DATE = "2030-01-02"; // a Wednesday
const at = (hhmm: string) => zonedToDate(DATE, hhmm, TZ).getTime();
const hours = { "0": [], "1": [], "2": [], "3": [["10:00", "20:00"]], "4": [], "5": [], "6": [] } as SlotInput["businessHours"];

const base = (over: Partial<SlotInput> = {}): SlotInput => ({
  date: DATE,
  tz: TZ,
  businessHours: hours,
  staff: [{ id: "a", name: "Ananya", shifts: [{ start: "10:00", end: "14:00" }], busy: [], bookingsToday: 0 }],
  salonClosures: [],
  durationMin: 60,
  bufferMin: 15,
  intervalMin: 30,
  earliest: 0,
  ...over,
});

describe("computeSlots", () => {
  it("fits the whole treatment inside the shift", () => {
    const times = computeSlots(base()).map((s) => s.time);
    expect(times).toEqual(["10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00"]);
  });

  it("returns nothing when the salon is closed that day", () => {
    expect(computeSlots(base({ date: "2030-01-01" }))).toEqual([]); // Tuesday
  });

  it("respects existing bookings plus cleanup buffer", () => {
    const busy = [{ start: at("11:00"), end: at("12:15") }];
    const times = computeSlots(base({ staff: [{ ...base().staff[0], busy }] })).map((s) => s.time);
    // 10:00 slot would block until 11:15 → clashes. 12:30 is the first free start after.
    expect(times).toEqual(["12:30", "13:00"]);
  });

  it("clips to business hours and minimum notice", () => {
    const st = [{ id: "a", name: "A", shifts: [{ start: "08:00", end: "22:00" }], busy: [], bookingsToday: 0 }];
    const times = computeSlots(base({ staff: st, earliest: at("18:10") })).map((s) => s.time);
    expect(times).toEqual(["18:30", "19:00"]);
  });

  it("blocks salon-wide closures", () => {
    const times = computeSlots(base({ salonClosures: [{ start: at("10:00"), end: at("13:00") }] })).map((s) => s.time);
    expect(times).toEqual(["13:00"]);
  });

  it("lists every free therapist, least busy first", () => {
    const staff = [
      { id: "busy", name: "B", shifts: [{ start: "10:00", end: "14:00" }], busy: [], bookingsToday: 4 },
      { id: "free", name: "F", shifts: [{ start: "10:00", end: "14:00" }], busy: [], bookingsToday: 0 },
    ];
    expect(computeSlots(base({ staff }))[0].staffIds).toEqual(["free", "busy"]);
  });

  it("handles split shifts (lunch break)", () => {
    const staff = [{ id: "a", name: "A", shifts: [{ start: "10:00", end: "12:00" }, { start: "13:00", end: "15:00" }], busy: [], bookingsToday: 0 }];
    expect(computeSlots(base({ staff })).map((s) => s.time)).toEqual(["10:00", "10:30", "11:00", "13:00", "13:30", "14:00"]);
  });
});

describe("pickSlots", () => {
  const slots = computeSlots(base());
  it("picks the closest times to a preference", () => {
    expect(pickSlots(slots, "12:10", 3).map((s) => s.time)).toEqual(["11:30", "12:00", "12:30"]);
  });
  it("spreads across the day without a preference", () => {
    expect(pickSlots(slots, undefined, 3).map((s) => s.time)).toEqual(["10:00", "11:30", "13:00"]);
  });
});

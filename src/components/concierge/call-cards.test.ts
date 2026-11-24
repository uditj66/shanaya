// What a website voice call shows on screen: built from exact tool results, never from her spoken words.
import { describe, expect, it } from "vitest";
import { bookingIcs, cardFromToolResult, dayLabel, directionsUrl, readToolResultMessage, timeLabel, whatsappUrl, type BookingCard } from "./call-cards";

// the shapes our tools really return (taken from a live call)
const slots = JSON.stringify({
  branch: "Lumière Facial Studio & Spa, Anna Nagar", date: "2026-11-25", service: "Full Body Polishing", minutes: 90, price: 3999,
  available: [{ time: "10:00", therapists: ["Deepika"] }, { time: "14:45", therapists: ["Payal"] }, { time: "19:30", therapists: [] }, { time: "20:00", therapists: ["X"] }],
});
const booked = JSON.stringify({
  no_deposit: false, success: true, reference: "222FAE", branch: "Lumière Facial Studio & Spa, Anna Nagar",
  address: "Anna Nagar, Chennai: the studio will share the exact address with your confirmation", service: "Full Body Polishing",
  therapist: "Deepika", date: "2026-11-25", time: "10:00", price: 3999, minutes: 90, timezone: "Asia/Kolkata", payment_note: "She pays ₹3,999 at the studio.",
});

describe("call cards", () => {
  it("shows at most three offered times, with who's free", () => {
    const c = cardFromToolResult("check_availability", slots);
    expect(c).toMatchObject({ kind: "slots", service: "Full Body Polishing", date: "2026-11-25" });
    expect(c?.kind === "slots" && c.times).toEqual([{ time: "10:00", therapist: "Deepika" }, { time: "14:45", therapist: "Payal" }, { time: "19:30", therapist: null }]);
  });

  it("turns a booking into a confirmation card", () => {
    expect(cardFromToolResult("book_appointment", booked)).toMatchObject({ kind: "booking", reference: "222FAE", therapist: "Deepika", minutes: 90, timezone: "Asia/Kolkata" });
  });

  it("shows nothing for errors, failed bookings or other tools", () => {
    expect(cardFromToolResult("book_appointment", JSON.stringify({ error: "That time was just taken." }))).toBeNull();
    expect(cardFromToolResult("book_appointment", JSON.stringify({ success: false }))).toBeNull();
    expect(cardFromToolResult("guest_history", JSON.stringify({ visits: [] }))).toBeNull();
    expect(cardFromToolResult("check_availability", "not json")).toBeNull();
  });

  it("finds which tool a result belongs to, by name or by the earlier tool call id", () => {
    const names = new Map([["call_1", "check_availability"]]);
    expect(readToolResultMessage({ type: "tool-calls-result", toolCallResult: { toolCallId: "call_1", result: slots } }, names)).toEqual({ tool: "check_availability", result: slots });
    expect(readToolResultMessage({ toolCallResult: { name: "book_appointment", result: booked } }, names)?.tool).toBe("book_appointment");
    expect(readToolResultMessage({ toolCallResult: { toolCallId: "unknown", result: "{}" } }, names)).toBeNull();
  });

  const card = cardFromToolResult("book_appointment", booked) as BookingCard;

  it("puts the booking in the calendar at the studio's local time, for the treatment's length", () => {
    const ics = bookingIcs(card, "Lumière Facial Studio & Spa", new Date("2026-11-24T12:00:00Z"));
    expect(ics).toContain("DTSTART;TZID=Asia/Kolkata:20261125T100000");
    expect(ics).toContain("DTEND;TZID=Asia/Kolkata:20261125T113000"); // 90 minutes
    expect(ics).toContain("SUMMARY:Full Body Polishing at Lumière Facial Studio & Spa");
    expect(ics).toContain("UID:222FAE@");
    expect(ics).toContain("LOCATION:Lumière Facial Studio & Spa\\, Anna Nagar"); // commas escaped for calendars
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
  });

  it("links to directions and a WhatsApp message with the reference", () => {
    expect(directionsUrl(card)).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Lumi/);
    expect(decodeURIComponent(whatsappUrl(card))).toContain("Booking reference: 222FAE");
    expect(dayLabel("2026-11-25")).toBe("Wed, 25 Nov");
    expect(timeLabel("14:45")).toBe("2:45 pm");
    expect(timeLabel("00:30")).toBe("12:30 am");
  });
});

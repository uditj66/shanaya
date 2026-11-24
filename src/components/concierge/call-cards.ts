// What a website voice call shows on screen besides Shanaya herself: the times she is offering and the booking she
// made. Built from tool RESULTS (exact data), never from her spoken words ("three thousand nine hundred rupees").
// Pure functions, so they can be tested.

export type SlotsCard = { kind: "slots"; service: string; branch: string; date: string; times: { time: string; therapist: string | null }[]; nextDate: string | null };
export type BookingCard = {
  kind: "booking";
  reference: string;
  service: string;
  therapist: string | null;
  branch: string;
  address: string | null;
  date: string; // YYYY-MM-DD, studio's local date
  time: string; // HH:MM, studio's local time
  minutes: number;
  timezone: string;
  payNote: string | null;
};
export type CallCard = SlotsCard | BookingCard;

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Tool results arrive as a JSON string (what our server returned) or already parsed. */
function asObject(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === "string") {
    try {
      return asObject(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
}

/** Turn one tool result into a card, or null when there's nothing worth showing (errors, other tools). */
export function cardFromToolResult(tool: string, raw: unknown): CallCard | null {
  const r = asObject(raw);
  if (!r || r.error) return null;
  if (tool === "check_availability") {
    const available = Array.isArray(r.available) ? (r.available as { time?: unknown; therapists?: unknown }[]) : [];
    const times = available
      .slice(0, 3) // she offers at most three
      .flatMap((s) => (str(s.time) ? [{ time: s.time as string, therapist: Array.isArray(s.therapists) ? (str(s.therapists[0]) ?? null) : null }] : []));
    if (!str(r.service) || !str(r.date)) return null;
    return { kind: "slots", service: r.service as string, branch: str(r.branch) ?? "", date: r.date as string, times, nextDate: str(r.next_available_date) };
  }
  if (tool === "book_appointment" || tool === "reschedule_appointment") {
    if (!r.success || !str(r.reference) || !str(r.date) || !str(r.time)) return null;
    return {
      kind: "booking",
      reference: r.reference as string,
      service: str(r.service) ?? "Your appointment",
      therapist: str(r.therapist),
      branch: str(r.branch) ?? "",
      address: str(r.address),
      date: r.date as string,
      time: r.time as string,
      minutes: typeof r.minutes === "number" && r.minutes > 0 ? r.minutes : 60,
      timezone: str(r.timezone) ?? "Asia/Kolkata",
      payNote: str(r.payment_note),
    };
  }
  return null;
}

/**
 * Vapi's "tool-calls-result" message: the result and which tool it belongs to. The shape isn't fully documented,
 * so read it defensively; `names` maps tool call ids (from the earlier "tool-calls" message) to tool names.
 */
export function readToolResultMessage(m: Record<string, unknown>, names: Map<string, string>): { tool: string; result: unknown } | null {
  const r = asObject(m.toolCallResult) ?? asObject((m.toolCallResults as unknown[] | undefined)?.[0]);
  if (!r) return null;
  const id = str(r.toolCallId) ?? str(r.id);
  const tool = str(r.name) ?? (id ? names.get(id) : undefined) ?? null;
  return tool ? { tool, result: r.result ?? r.content ?? r.output } : null;
}

/** "Wed 25 Nov" for a studio date. */
export const dayLabel = (date: string) => new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

/** "10:00" → "10:00 am" */
export function timeLabel(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** A calendar file for the booking, in the studio's own timezone (TZID), so it lands at the right time anywhere. */
export function bookingIcs(b: BookingCard, brand: string, now = new Date()) {
  const local = (date: string, time: string) => `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
  const [h, m] = b.time.split(":").map(Number);
  const endMins = h * 60 + m + b.minutes;
  // a treatment never crosses midnight at a studio, so the end stays on the same date
  const end = `${String(Math.floor(endMins / 60) % 24).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`;
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${icsText(brand)}//Shanaya//EN`,
    "BEGIN:VEVENT",
    `UID:${b.reference}@${brand.toLowerCase().replace(/[^a-z0-9]+/g, "")}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${b.timezone}:${local(b.date, b.time)}`,
    `DTEND;TZID=${b.timezone}:${local(b.date, end)}`,
    `SUMMARY:${icsText(`${b.service} at ${brand}`)}`,
    `LOCATION:${icsText([b.branch, b.address].filter(Boolean).join(", "))}`,
    `DESCRIPTION:${icsText(`Booking reference ${b.reference}${b.therapist ? ` · with ${b.therapist}` : ""}. Please arrive 10 minutes early.`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/** Google Maps search for the studio (works without exact coordinates, and for studios whose address is pending). */
export const directionsUrl = (b: BookingCard) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([b.branch, b.address].filter(Boolean).join(", "))}`;

/** A WhatsApp message she can send herself or the person she booked for. */
export function whatsappUrl(b: BookingCard) {
  const text = `${b.service}${b.therapist ? ` with ${b.therapist}` : ""}\n${dayLabel(b.date)}, ${timeLabel(b.time)}\n${b.branch}\nBooking reference: ${b.reference}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

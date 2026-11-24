// Returning callers: on a phone call the caller ID is known, so Shanaya can recognise a past guest from the first
// word. This file is pure (no database) so it can be tested; the lookup lives in find-returning-guest.ts.
//
// Privacy: one phone is often shared by a family, and caller ID can be spoofed. So Shanaya greets by first name as a
// QUESTION ("Am I speaking with Ananya?") and shares no visit details until the caller confirms who she is.
import { formatInTimeZone } from "date-fns-tz";
import { memoryLines, type MemoryNote } from "./guest-memory";

export type ReturningGuest = {
  name: string; // full name on her most recent booking
  firstName: string | null; // null when the stored name isn't safe to say aloud
  visits: number; // past visits across the brand (capped at the lookup limit)
  lastVisit: { at: string; treatment: string | null; branch: string; therapist: string | null } | null;
  favourite: { name: string; branch: string; branchId: string; times: number } | null;
  usualBranch: { name: string; branchId: string } | null;
  upcoming: { at: string; treatment: string | null; branch: string; reference: string } | null;
  member: { tier: string; endsAt: string | null } | null;
  lastCall: { at: string; summary: string } | null;
  notes: MemoryNote[]; // what she has shared in earlier conversations (guest_memory)
};

/** "Ananya" from "ananya sharma"; null for numbers, initials or placeholders ("Guest", "Unknown"). */
export function firstNameOf(full: string | null | undefined): string | null {
  const first = String(full ?? "").trim().split(/\s+/)[0] ?? "";
  if (first.length < 2 || !/^\p{L}[\p{L}'-]*$/u.test(first)) return null;
  if (/^(guest|unknown|customer|caller|test|na|n\/a|mr|mrs|ms|miss|dr)\.?$/i.test(first)) return null;
  return first[0].toLocaleUpperCase("en-IN") + first.slice(1).toLocaleLowerCase("en-IN");
}

const plain = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Edit distance, capped: enough to forgive one mis-heard letter ("Ananiya" for "Ananya"). */
function within1(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  const rest = (x: string, y: string) => x.slice(i + 1) === y.slice(i + (x.length === y.length ? 1 : 0));
  return a.slice(i) === b.slice(i) || rest(a, b) || rest(b, a) || a.slice(i + 1) === b.slice(i);
}

/**
 * Website guests have no caller ID, so the first name she gives must match the one on file for that number.
 * One letter of slack for names of 5+ letters (speech-to-text often mis-hears a letter).
 */
export function nameMatches(given: string | null | undefined, onFile: string | null | undefined) {
  const g = firstNameOf(given);
  const f = firstNameOf(onFile);
  if (!g || !f) return false;
  const [a, b] = [plain(g), plain(f)];
  return a === b || (Math.min(a.length, b.length) >= 5 && within1(a, b));
}

const day = (iso: string, tz: string) => formatInTimeZone(new Date(iso), tz, "EEEE d MMMM yyyy");
const when = (iso: string, tz: string) => formatInTimeZone(new Date(iso), tz, "EEEE d MMMM 'at' h:mm a");
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Opening line for a recognised caller. Keeps the recording notice of the standard greeting. */
export function returningGreeting(g: ReturningGuest, brand: string, agent: string) {
  if (!g.firstName) return null;
  return `Hello, welcome back to ${brand}. This is ${agent}. This call may be recorded for quality and booking purposes. Am I speaking with ${g.firstName}?`;
}

/** Added to "This conversation" on phone calls from a number that has visited before. */
export function returningGuestSection(g: ReturningGuest, tz: string, now = new Date()) {
  const today = formatInTimeZone(now, tz, "yyyy-MM-dd");
  const remembered = g.notes.length
    ? `- What she has shared in earlier conversations (use lightly; if an occasion is coming up or just passed, ask about it warmly):\n${memoryLines(g.notes, tz, today).map((l) => `  ${l}`).join("\n")}`
    : "";
  const lines = [
    g.name
      ? `- Name on her bookings: ${g.name}.${g.visits ? ` Past visits with us: ${g.visits >= 10 ? "10 or more" : g.visits}.` : " No completed visits yet."}`
      : "- She has spoken with us before but never booked, so we don't have her name yet.",
    g.lastVisit
      ? `- Last visit: ${g.lastVisit.treatment ?? "a treatment"} at ${g.lastVisit.branch} on ${day(g.lastVisit.at, tz)}${g.lastVisit.therapist ? `, with ${g.lastVisit.therapist}` : ""}.`
      : "",
    g.favourite && g.favourite.times > 1
      ? `- Her favourite: ${g.favourite.name} at ${g.favourite.branch} [branch_id: ${g.favourite.branchId}] (${g.favourite.times} visits). Offer this person first when it suits the treatment.`
      : "",
    g.usualBranch ? `- Usual branch: ${g.usualBranch.name} [branch_id: ${g.usualBranch.branchId}]. Offer it as a question ("Shall I look at ${g.usualBranch.name} again?"), never assume it.` : "",
    g.upcoming ? `- Upcoming: ${g.upcoming.treatment ?? "an appointment"} at ${g.upcoming.branch} on ${when(g.upcoming.at, tz)} (ref ${g.upcoming.reference}). She may be calling about it; check gently, don't lead with it.` : "",
    g.member ? `- Active ${g.member.tier} member${g.member.endsAt ? ` until ${day(g.member.endsAt, tz)}` : ""}. Thank her for being a member; book_appointment applies her benefits.` : "",
    remembered,
    // the raw call summary is only a fallback until there are proper notes
    g.lastCall && !g.notes.length ? `- Her last call (${day(g.lastCall.at, tz)}), summary: ${clip(g.lastCall.summary.replace(/\s+/g, " ").trim(), 400)}` : "",
  ].filter(Boolean);

  return `
# Returning guest (recognised from caller ID)
This number belongs to a guest who has been in touch with us before.${g.firstName ? ` The greeting asked whether you are speaking with ${g.firstName}.` : " Ask warmly for her name."}
- Until she confirms she is ${g.firstName ?? "the guest named below"}, share NONE of the details below: phones are often shared by family. If it's someone else, welcome them as a new guest, ask their name, and never mention this guest's visits, bookings or membership.
- Once she confirms, use what you know naturally and briefly, like a front desk that remembers her ("Lovely to hear from you again, Ananya. How was the HydraFacial with Meera?"). Never read this list out, and never say how you know.
- These facts are a starting point; tools are still the truth for availability, bookings and prices.
${lines.join("\n")}`;
}

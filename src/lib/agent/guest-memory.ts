// What Shanaya remembers about a guest between conversations. Pure helpers (no database or AI calls) so they can be tested;
// the after-call extraction lives in remember-call.ts.
import { formatInTimeZone } from "date-fns-tz";
import { z } from "zod";

export const NOTE_KINDS = ["concern", "occasion", "preference", "dislike", "life"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];
/** One remembered fact. `until` (YYYY-MM-DD) is when an occasion happens; it's dropped a month after that. */
export type MemoryNote = { text: string; kind: NoteKind; until: string | null; at: string };

export const MAX_NOTES = 12;
const MAX_TEXT = 160;
const KEEP_AFTER_OCCASION_DAYS = 30;

/**
 * Health and money details never go into memory (India's DPDP Act treats health data as sensitive, and the studio
 * already records health notes on the booking itself). The extraction prompt says so; this is the backstop.
 */
const SENSITIVE =
  /\b(allerg\w*|pregnan\w*|expecting|trimester|miscarriag\w*|medic\w*|medicine|prescri\w*|tablet|isotretinoin|accutane|retino\w*|steroid\w*|diabet\w*|thyroid|pcos|pcod|eczema|psoriasis|rosacea|dermatitis|cancer|chemo\w*|surgery|surgical|blood pressure|hypertension|epilep\w*|asthma|hiv|depress\w*|anxiety|disease|diagnos\w*|condition|card number|cvv|upi pin|otp|password|aadhaar|pan card)\b/i;

export const isSensitive = (text: string) => SENSITIVE.test(text);

const clean = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
const key = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Notes as stored (jsonb), checked: anything malformed is dropped rather than trusted. */
export function parseNotes(raw: unknown): MemoryNote[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((n) => {
    if (!n || typeof n !== "object") return [];
    const o = n as Record<string, unknown>;
    const text = typeof o.text === "string" ? clean(o.text) : "";
    const kind = NOTE_KINDS.includes(o.kind as NoteKind) ? (o.kind as NoteKind) : "preference";
    if (!text) return [];
    return [{ text, kind, until: isDay(o.until) ? o.until : null, at: typeof o.at === "string" ? o.at : new Date(0).toISOString() }];
  });
}

/** Is this occasion long gone? (`today` is YYYY-MM-DD in the studio's timezone.) */
function expired(n: MemoryNote, today: string) {
  if (!n.until) return false;
  const cutoff = new Date(`${n.until}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() + KEEP_AFTER_OCCASION_DAYS);
  return cutoff.toISOString().slice(0, 10) < today;
}

/**
 * Tidy a list of notes: drop sensitive and expired ones, de-duplicate (the newest wording wins) and keep the
 * newest MAX_NOTES.
 */
export function tidyNotes(notes: MemoryNote[], today: string): MemoryNote[] {
  const byKey = new Map<string, MemoryNote>();
  for (const n of [...notes].sort((a, b) => a.at.localeCompare(b.at))) {
    const text = clean(n.text);
    if (!text || isSensitive(text) || expired(n, today)) continue;
    byKey.set(key(text), { ...n, text });
  }
  return [...byKey.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, MAX_NOTES);
}

const KIND_LABEL: Record<NoteKind, string> = { concern: "Concern", occasion: "Occasion", preference: "Likes", dislike: "Didn't enjoy", life: "About her" };

/** Lines for Shanaya's prompt, e.g. "- Occasion (Sat 12 Dec 2026): sister's wedding, wants a bridal glow before it". */
export function memoryLines(notes: MemoryNote[], tz: string, today: string) {
  return notes.map((n) => {
    const when = n.until ? ` (${n.until < today ? "was " : ""}${formatInTimeZone(new Date(`${n.until}T12:00:00Z`), tz, "EEE d MMM yyyy")})` : "";
    return `- ${KIND_LABEL[n.kind]}${when}: ${n.text}`;
  });
}

/** What the after-call AI step returns: the full, updated list of notes. */
export const MemorySchema = z.object({
  notes: z
    .array(
      z.object({
        text: z.string().describe("One short fact in the third person, under 25 words"),
        kind: z.enum(NOTE_KINDS),
        until: z.string().nullable().describe("For an occasion with a known date: YYYY-MM-DD. Otherwise null"),
      }),
    )
    .describe(`At most ${MAX_NOTES} notes (anything beyond is cut by tidyNotes)`),
});

export const MEMORY_INSTRUCTIONS = `You keep the guest notes for a luxury beauty and spa studio's front desk, so the receptionist can remember a returning guest.
You get the notes already on file and the transcript of the latest conversation. Return the full, updated list of notes.

Keep only facts that will help serve HER better next time:
- concern: her skin, hair or body goals and concerns in beauty terms ("dull skin before winter", "wants to grow out her bob").
- occasion: upcoming events and dates ("sister's wedding on 12 December", "honeymoon in Bali in January"). Resolve relative dates against the call date and put the date in "until".
- preference: what she likes (a therapist, a branch, time of day, firm pressure, quiet treatments, a fragrance).
- dislike: what she didn't enjoy or wants to avoid (a treatment, a therapist, waiting times).
- life: light personal context she volunteered and would be pleased to have remembered ("just moved to Andheri", "works night shifts").

Rules:
- Update or remove existing notes that the conversation shows are out of date. Keep the rest as they are.
- Never record health or medical information of any kind (allergies, pregnancy, medication, skin or medical conditions, treatments by a doctor), payment details, codes, passwords or ID numbers. Those are handled elsewhere.
- Don't record what the booking system already knows: appointment dates, times, prices, references, treatments booked.
- If the conversation was about someone else (booking for a friend), only record facts about the guest herself.
- No guesses, no judgements, nothing she'd be embarrassed to hear repeated. If nothing is worth keeping, return the existing notes unchanged.
- At most ${MAX_NOTES} notes; prefer the most useful and most recent.`;


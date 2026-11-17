// Shanaya's instructions come in two parts:
//  1. PERSONA: who she is and how she talks. For voice this lives in the Vapi dashboard (editable there),
//     seeded from personaPrompt("voice"). Typed chat uses personaPrompt("chat").
//  2. KNOWLEDGE: live data from the database (branches, menu, packages, calendar), injected on every call
//     as the {{knowledge}} variable. Never edited by hand.
import { formatInTimeZone } from "date-fns-tz";
import { displayName, type SalonContext } from "./context";
import { addDays, todayIn } from "../time";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);

type GuestProfile = { name: string; goals?: string[]; recommend?: string[]; note?: string };

export const brandName = (ctx: SalonContext) => ctx.salon.brand_name || ctx.salon.name;

export function greeting(ctx: SalonContext) {
  return (
    ctx.salon.agent_greeting?.trim() ||
    `Hello, thank you for calling ${brandName(ctx)}. This is ${ctx.salon.agent_name}. How may I pamper you today?`
  );
}

/** Who Shanaya is and how she talks. Voice version is the starting point for the editable Vapi prompt. */
export function personaPrompt(mode: "voice" | "chat", agentName = "Shanaya", brand = "Lumière Facial Studio & Spa") {
  const medium =
    mode === "voice"
      ? `## How you speak (voice)
- This is a live voice conversation, on the phone or from our website. Speak in short, natural sentences, one or two at a time, and ask one question at a time.
- Sound like a warm, polished woman at the front desk of a luxury spa in India: gracious, confident and genuinely interested. Natural openers like "Of course," "Lovely," "Oh, that sounds exciting," contractions, and a relaxed pace.
- Use her first name once you know it. A brief "mm-hmm" or "I see" while she explains is fine; never talk over her, and stop the moment she interrupts.
- Never read out lists, codes, symbols or markdown. Say prices and times the way people do: "three thousand nine hundred and ninety-nine rupees", "half past four in the evening".
- Before using a tool, say a short natural line such as "Let me just check that for you."`
      : `## How you write (website chat)
- Short, warm replies of two to four sentences. Plain text, no markdown or bullet symbols.
- Write dates and times the way people say them ("Saturday 21 November at 4:30 pm").`;

  return `You are ${agentName}, the guest-relations host for ${brand}, a premium, women-focused chain of facial studios and spas across India. You are an AI assistant; say so honestly if asked, but you are proud of the studios and know them inside out.

${medium}

## Be specific, never vague
- Every recommendation names the actual treatment, what it does in a vivid phrase, how long it takes and the price. Dull: "We have many facials." Good: "For that tired, dull skin, I'd love you to try our Korean Glass Skin Facial: seventy-five minutes of layered hydration that leaves you dewy for days, at three thousand four hundred and ninety-nine rupees."
- Ask one good question to understand her: her skin or hair concern, the occasion (wedding, Karwa Chauth, Diwali, a holiday, a date night), when it is, and whether she wants a quick refresh or a proper indulgence.
- Then suggest one or two options with a reason that fits her, and mention a package when it suits the occasion. End with a clear next step ("Shall I check Saturday for you?").
- Share small, useful details naturally: which therapist specialises in it, how early to arrive, what to avoid before a treatment.

## Choosing the branch
- We have studios in many cities, often several per city. Before checking times or booking, always confirm which branch she wants. Unless she has already named a city or area, ask which city and which area is most convenient for her, then suggest the nearest branch from the Branch directory by its area (for example "Our Bandra West studio on Linking Road would be closest").
- If she reached us through a specific branch's line or page, offer that branch as a question, never as an assumption: "Would our Bandra West studio suit you, or is another area easier?". Happily book any branch she prefers.
- Always say the branch name when offering times and when confirming a booking.

## Her favourite therapist, doctor or beautician
- Once the treatment and branch are clear, always ask warmly whether she has a favourite therapist, doctor or beautician she'd like ("Do you have someone you love seeing, or shall I find whoever is free?").
- If she names someone, pass that name as therapist_name to check_availability at that branch. Use only names from that branch's Team in the Branch directory.
- If she says "the same as last time", or likes someone but can't remember the name, use guest_history with her number. Name that person exactly, with the branch and treatment ("Last time Meera did your HydraFacial at Bandra West. Shall I book her again?"), then check that person's availability.
- If that person isn't free when she wants, offer their next free times first, then another senior team member at the same branch.
- If she has no preference, any available specialist is fine; mention who it will be when you offer the time.

## Booking
1. Check real availability with check_availability (branch_id + service code + date) before offering times. Offer at most three times. If the day is full, offer the next available date or a nearby branch.
2. You need the branch, treatment, date, time and her name, plus a mobile number (on phone calls the caller's number is known: just confirm it).
3. Read everything back in one sentence ("So that's the Celebrity Glow Facial at our Juhu studio on Saturday at four pm, under Priya, correct?") and wait for a clear yes before book_appointment.
4. After booking, give the booking reference slowly, character by character, the branch address, and a gentle reminder to arrive ten minutes early.
5. To reschedule or cancel: find_appointments with her number, confirm which one, then reschedule_appointment or cancel_appointment.

## Consultations and hand-offs
- Medi-facials such as the Vampire Facial (PRP), Microneedling and Carbon Laser, and multi-visit programmes such as the Royal Bridal Glow and Honeymoon Ready, are arranged through a consultation. Describe them warmly, take her name, mobile number and preferred dates, then use request_callback with "Consultation: <treatment>". Never book them directly, and only say the team will call after request_callback succeeds.
- If she is upset, has a complaint, asks for a person or asks a medical question, apologise sincerely, take her details and use request_callback.

## Never
- Never invent treatments, prices, discounts, branches, therapists or availability. Use only the knowledge below and tool results.
- Never give medical advice, diagnose or promise results. If she mentions pregnancy, allergies, active skin conditions, recent peels or retinoids, note it in the booking and say the therapist will check before the treatment.
- Age alone never decides what is suitable.

Dates in tool calls are YYYY-MM-DD and times HH:MM (24-hour). Use the calendar in the knowledge to resolve "Saturday" or "tomorrow".`;
}

/** Live facts for this call, injected into the prompt as {{knowledge}}. */
export function buildKnowledge(ctx: SalonContext, opts: { callerPhone?: string | null; now?: Date } = {}) {
  const { salon, services, packages, branches } = ctx;
  const tz = salon.timezone;
  const now = opts.now ?? new Date();
  const today = todayIn(tz, now);
  const hours = salon.business_hours as Record<string, [string, string][]>;

  const calendar = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(today, i);
    const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
    const open = hours[String(wd)]?.length ? hours[String(wd)].map(([o, c]) => `${o}-${c}`).join(", ") : "closed";
    return `${d} ${DAYS[wd]}${i === 0 ? " (today)" : i === 1 ? " (tomorrow)" : ""}: ${open}`;
  }).join("\n");

  // Branch directory, grouped by city (entry branch marked).
  const all = [{ id: salon.id, city: salon.city, area: salon.area, address: salon.address, phone: salon.phone, name: salon.name }, ...branches];
  const cities = [...new Set(all.map((b) => b.city ?? "Other"))];
  const teamOf = (id: string) =>
    (ctx.team ?? [])
      .filter((m) => m.salon_id === id)
      .map((m) => `${m.name}${m.title ? ` (${m.title})` : ""}`)
      .join(", ");
  const directory = cities
    .map(
      (c) =>
        `${c}:\n` +
        all
          .filter((b) => (b.city ?? "Other") === c)
          .map((b) => {
            const team = teamOf(b.id);
            return `- ${b.area ?? b.name} [branch_id: ${b.id}]${b.id === salon.id ? " (the line she reached)" : ""}: ${b.address ?? ""}${b.phone ? `, ${b.phone}` : ""}${team ? `\n  Team: ${team}` : ""}`;
          })
          .join("\n"),
    )
    .join("\n");

  const byCategory = new Map<string, typeof services>();
  for (const s of services) byCategory.set(s.category, [...(byCategory.get(s.category) ?? []), s]);
  const menu = [...byCategory.entries()]
    .map(
      ([cat, list]) =>
        `## ${cat}\n` +
        list
          .map((s) => {
            const extras = [
              s.suitable_for?.length ? `Good for: ${s.suitable_for.join(", ")}.` : "",
              s.add_ons?.length ? `Add-ons: ${s.add_ons.join(", ")}.` : "",
              s.consultation_first ? "CONSULTATION ONLY (use request_callback)." : "",
              s.provider_note ?? "",
            ].filter(Boolean).join(" ");
            return `- [${s.code ?? s.id}] ${s.name}: ${s.duration_minutes} min, ${money(Number(s.price), salon.currency)}. ${s.description} ${extras}`.trim();
          })
          .join("\n"),
    )
    .join("\n");

  const packageList = packages
    .map((p) => `- [${p.code}] ${p.name}: ${money(Number(p.price), salon.currency)}, ${p.visits > 1 ? `${p.visits} visits (consultation only)` : "one visit"}. Occasion: ${p.occasion}. For: ${p.target_customers.join(", ")}. ${p.description}`)
    .join("\n");

  const profiles = ((salon.guest_profiles ?? []) as GuestProfile[])
    .map((g) => `- ${g.name}: goals ${g.goals?.join(", ") ?? "-"}. Suggest: ${g.recommend?.join(", ") ?? "-"}. ${g.note ?? ""}`.trim())
    .join("\n");

  return `# Today (timezone ${tz}; now ${formatInTimeZone(now, tz, "HH:mm")})
${calendar}
All branches share these opening hours, the same menu and the same prices.

# Where she reached us
${displayName(salon)}${salon.address ? `, ${salon.address}` : ""}

# Branch directory (use branch_id in tools)
${directory}

# Menu (use the [code] in tools)
${menu || "No services configured."}
${packageList ? `\n# Occasion packages (book single-visit ones by their [code])\n${packageList}\n` : ""}${profiles ? `\n# Guest profiles (how to recommend)\n${profiles}\n` : ""}
# Policies
${salon.policies || "None."}

# Extra information
${salon.agent_instructions || "None."}
${opts.callerPhone ? `\n# This call\nCaller's phone number: ${opts.callerPhone}` : ""}`;
}

/** Full prompt for typed chat (and the voice fallback when no saved Vapi assistant is configured). */
export function buildPrompt(ctx: SalonContext, opts: { channel: "phone" | "web"; callerPhone?: string | null; now?: Date }) {
  return `${personaPrompt(opts.channel === "phone" ? "voice" : "chat", ctx.salon.agent_name, brandName(ctx))}\n\n# KNOWLEDGE\n${buildKnowledge(ctx, opts)}`;
}

import { formatInTimeZone } from "date-fns-tz";
import { displayName, type SalonContext } from "./context";
import { addDays, todayIn } from "../time";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);

type GuestProfile = { name: string; goals?: string[]; recommend?: string[]; note?: string };

export function greeting(ctx: SalonContext) {
  return (
    ctx.salon.agent_greeting?.trim() ||
    `Hello, thank you for calling ${displayName(ctx.salon)}. This is ${ctx.salon.agent_name}, the studio's AI assistant. How may I help you today?`
  );
}

export function buildPrompt(ctx: SalonContext, opts: { channel: "phone" | "web"; callerPhone?: string | null; now?: Date }) {
  const { salon, services, staff, packages, branches } = ctx;
  const tz = salon.timezone;
  const now = opts.now ?? new Date();
  const today = todayIn(tz, now);
  const hours = salon.business_hours as Record<string, [string, string][]>;
  const studio = displayName(salon);

  // A 14-day calendar so the model never has to do date arithmetic ("this Saturday", "next Monday").
  const calendar = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(today, i);
    const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
    const open = hours[String(wd)]?.length ? hours[String(wd)].map(([o, c]) => `${o}-${c}`).join(", ") : "closed";
    return `${d} ${DAYS[wd]}${i === 0 ? " (today)" : i === 1 ? " (tomorrow)" : ""}: ${open}`;
  }).join("\n");

  // Services grouped by category, with what each is good for and any consultation rule.
  const byCategory = new Map<string, typeof services>();
  for (const s of services) byCategory.set(s.category, [...(byCategory.get(s.category) ?? []), s]);
  const serviceList = [...byCategory.entries()]
    .map(
      ([cat, list]) =>
        `## ${cat}\n` +
        list
          .map((s) => {
            const extras = [
              s.suitable_for?.length ? `Good for: ${s.suitable_for.join(", ")}.` : "",
              s.add_ons?.length ? `Add-ons: ${s.add_ons.join(", ")}.` : "",
              s.consultation_first ? "CONSULTATION ONLY: never book directly, use request_callback to arrange a consultation." : "",
              s.provider_note ?? "",
            ].filter(Boolean).join(" ");
            return `- ${s.name} [service_id: ${s.id}] ${s.duration_minutes} min, ${money(Number(s.price), salon.currency)}. ${s.description} ${extras}`.trim();
          })
          .join("\n"),
    )
    .join("\n");

  const packageList = packages
    .map(
      (p) =>
        `- ${p.name}: ${money(Number(p.price), salon.currency)}, ${p.visits > 1 ? `${p.visits} visits` : "one visit"}. Occasion: ${p.occasion}. For: ${p.target_customers.join(", ")}. ${p.description}` +
        (p.visits > 1 ? " Arrange via a consultation (request_callback)." : p.service_id ? ` Book it as service_id ${p.service_id}.` : ""),
    )
    .join("\n");

  const profiles = ((salon.guest_profiles ?? []) as GuestProfile[])
    .map((g) => `- ${g.name}: goals ${g.goals?.join(", ") ?? "-"}. Suggest: ${g.recommend?.join(", ") ?? "-"}. ${g.note ?? ""}`.trim())
    .join("\n");

  const sameCity = branches.filter((b) => b.city === salon.city);
  const otherCities = [...new Set(branches.filter((b) => b.city !== salon.city).map((b) => b.city))];
  const branchInfo = branches.length
    ? `${sameCity.length ? `Other ${salon.city} branches:\n${sameCity.map((b) => `- ${b.area}: ${b.address}${b.phone ? `, ${b.phone}` : ""}`).join("\n")}\n` : ""}${otherCities.length ? `Also in: ${otherCities.join(", ")}.` : ""}
You can only book at THIS branch (${salon.area ?? salon.name}). If a guest prefers another branch, give that branch's area and phone number.`
    : "";

  const voice = opts.channel === "phone";

  return `You are ${salon.agent_name}, the ${voice ? "phone receptionist" : "online booking assistant"} for ${studio}${salon.brand_name ? `, part of the ${salon.brand_name} chain, a premium women-focused beauty, skincare and wellness brand` : ", a premium facial and spa studio"}. You are an AI assistant; say so honestly if asked.

# Style
${voice
  ? `- This is a live voice conversation (a phone call, or a voice call from the studio's website). Your words are spoken aloud by your voice. Keep replies to one or two short sentences and ask one question at a time.
- Talk like a real person at a luxury front desk, not a script: natural openers like "Sure," "Of course," "Lovely," or "Let me see," contractions, and a friendly, unhurried pace. Use the guest's first name once you know it, but not in every sentence.
- Listening: if the guest is still explaining, a brief "mm-hmm" or "I see" is fine, but never talk over them. If they interrupt, stop and listen to what they say.
- Never use lists, symbols, markdown or emojis. Say prices and times the way a person speaks them ("two thousand four hundred ninety-nine rupees", "four thirty in the evening").
- When you call a tool, first say a short natural filler like "One moment, let me just check that for you."`
  : `- This is a chat on the studio's website. Keep replies short and warm, at most three sentences. Plain text only, no markdown.
- Write dates and times the way people say them ("Wednesday 18 November at 2:30 pm"), never as 2026-11-18 or 14:30.`}
- Sound calm, warm and polished, like the front desk of a luxury spa.

# Your job
1. Answer questions about services, prices, timings, location, packages, offers and policies, using only the facts below. If you don't know, say you'll have the team call back.
2. Recommend like an expert host: first understand who she is and what it's for (skin concern, occasion such as a wedding, Karwa Chauth, Diwali, Valentine's, New Year or honeymoon, the date, and budget). Use the guest profiles and packages below, and suggest one or two options with a short reason. Mention a package when the occasion fits.
3. Book appointments:
   - Always call check_availability before offering times. Never invent availability.
   - Offer at most three times. If the day is full, the tool returns the next available date; offer that.
   - You need the service, date, time, the guest's name${voice && opts.callerPhone ? " (their phone number is already known from the call; confirm it is the best number for the booking)" : " and a mobile number"}.
   - Read the details back in one sentence and get a clear yes, then call book_appointment.
   - After booking, say the booking reference letter by letter and remind them to arrive ten minutes early.
4. Consultation-only treatments (medi-facials such as the Vampire Facial, Microneedling, Carbon Laser) and multi-visit programmes (Royal Bridal Glow, Honeymoon Ready): explain them warmly, then take her name and mobile number and use request_callback with the reason "Consultation: <treatment or package>" and her preferred dates. Never book them directly, and never say the team will call before request_callback has succeeded.
5. Reschedule or cancel: use find_appointments with the guest's phone number, confirm which booking, then reschedule_appointment or cancel_appointment.
6. Hand-off: if the guest is upset, has a complaint, asks for a person, has a medical or skin-condition question, or wants something you cannot do, use request_callback${voice && salon.transfer_phone ? " or transfer the call to the team" : ""} and tell them the team will get back to them.

# Rules
- Never give medical advice, diagnose, or promise results. If a guest mentions pregnancy, allergies, active skin conditions, recent peels or retinoids, add it to the booking notes and say the therapist will check before the treatment.
- Age alone never decides what is suitable; ask about her skin and comfort.
- Never make up services, prices, discounts, branches or staff. Prices are the same at every branch.
- Dates in tool calls are YYYY-MM-DD and times are HH:MM (24-hour). Use the calendar below to resolve words like "Saturday" or "tomorrow".
- Guests may request a therapist by name; otherwise any available therapist is fine.

# Calendar (studio timezone ${tz}; now ${formatInTimeZone(now, tz, "HH:mm")})
${calendar}

# This branch
Name: ${studio}
${salon.address ? `Address: ${salon.address}\n` : ""}${salon.phone ? `Phone: ${salon.phone}\n` : ""}Team: ${staff.map((s) => `${s.name}${s.title ? ` (${s.title})` : ""}`).join(", ") || "our team"}
${branchInfo}

# Services
${serviceList || "No services configured."}
${packageList ? `\n# Occasion packages\n${packageList}\n` : ""}${profiles ? `\n# Guest profiles (how to recommend)\n${profiles}\n` : ""}
# Policies
${salon.policies || "None provided."}

# Offers and extra information
${salon.agent_instructions || "None."}
${opts.callerPhone ? `\n# This call\nCaller's phone number: ${opts.callerPhone}` : ""}`;
}

// Shanaya concierge (brand website chat) tools for the Vercel AI SDK.
// - Booking tools wrap the SAME runTool() the phone line uses (validation, branch rules, privacy, idempotency).
// - "show_*" tools return card data read from the cached brand data, so every price, photo and name on a card comes from
//   the database, never from the model.
import "server-only";
import { jsonSchema, tool } from "ai";
import { z } from "zod";
import { getMenu, getPackages, getStudios, getTeam } from "@/lib/brand/data";
import { hoursRows } from "@/lib/brand/hours";
import { runTool, toolDefs, type ToolContext } from "@/lib/agent/tools";

const BOOKING_TOOLS = [
  "check_availability",
  "book_appointment",
  "guest_history",
  "find_appointments",
  "reschedule_appointment",
  "cancel_appointment",
  "request_callback",
] as const;
type BookingToolName = (typeof BOOKING_TOOLS)[number];

/** Booking tools exactly as the phone agent has them (same definitions, same runTool), adapted to the AI SDK. */
function bookingTools(t: ToolContext) {
  const make = (name: BookingToolName) => {
    const d = toolDefs.find((x) => x.name === name)!;
    return tool({
      description: d.description,
      inputSchema: jsonSchema<Record<string, unknown>>(d.parameters as Parameters<typeof jsonSchema>[0]),
      execute: async (args: Record<string, unknown>) => (await runTool(t, name, args)) as Record<string, unknown>,
    });
  };
  return Object.fromEntries(BOOKING_TOOLS.map((n) => [n, make(n)])) as Record<BookingToolName, ReturnType<typeof make>>;
}

export function conciergeTools(brand: string, t: ToolContext) {
  return {
    ...bookingTools(t),

    show_treatments: tool({
      description:
        "Show the guest treatment cards (photo, price, duration) for 1 to 3 treatments or packages you are recommending. Use it whenever you recommend specific treatments. Pass codes from the menu (e.g. FAC001, PKG002).",
      inputSchema: z.object({ codes: z.array(z.string()).min(1).max(3) }),
      execute: async ({ codes }) => {
        const [menu, packages] = await Promise.all([getMenu(brand), getPackages(brand)]);
        const cards = codes
          .map((code) => {
            const m = menu.find((x) => x.code === code.toUpperCase());
            if (m) return { code: m.code, name: m.name, headline: m.headline, price: m.price, minutes: m.minutes, image: m.image, href: `/services/${m.slug}`, consultationFirst: m.consultationFirst, category: m.categoryLabel };
            const p = packages.find((x) => x.code === code.toUpperCase());
            if (p) return { code: p.code, name: p.name, headline: p.description, price: p.price, minutes: p.minutes, image: p.image, href: `/occasions#${p.slug}`, consultationFirst: p.consultationFirst, category: p.occasion };
            return null;
          })
          .filter((c) => c !== null);
        return cards.length ? { cards } : { error: "Unknown codes. Use codes from the menu." };
      },
    }),

    show_studios: tool({
      description: "Show studio cards so the guest can choose a branch. Optionally filter by city (e.g. Mumbai, New Delhi, Bengaluru).",
      inputSchema: z.object({ city: z.string().optional() }),
      execute: async ({ city }) => {
        const studios = await getStudios(brand);
        const list = studios.filter((s) => !city || s.city.toLowerCase().includes(city.toLowerCase()));
        return {
          studios: (list.length ? list : studios).slice(0, 6).map((s) => ({
            branch_id: s.id,
            slug: s.slug,
            area: s.area,
            city: s.city,
            address: s.address,
            image: s.heroImage,
            hours: hoursRows(s.hours).map((r) => `${r.days} ${r.hours}`).join(" · "),
          })),
        };
      },
    }),

    show_specialists: tool({
      description: "Show the specialists at a branch (name, role, specialties), e.g. when she asks who will treat her or wants to pick someone.",
      inputSchema: z.object({ branch_id: z.string() }),
      execute: async ({ branch_id }) => {
        const [studios, team] = await Promise.all([getStudios(brand), getTeam(brand)]);
        const studio = studios.find((s) => s.id === branch_id || s.slug === branch_id);
        if (!studio) return { error: "Unknown branch_id. Use one from the Branch directory." };
        return {
          studio: studio.area,
          specialists: team
            .filter((p) => p.studioSlug === studio.slug)
            .map((p) => ({ name: p.name, title: p.title, specialties: p.specialties.slice(0, 2), href: `/studios/${p.studioSlug}/team/${p.slug}` })),
        };
      },
    }),

    suggest_replies: tool({
      description: "Offer the guest 2 to 4 short tap-to-reply chips (max 5 words each) for the most likely next answers. Use at the end of most replies.",
      inputSchema: z.object({ options: z.array(z.string().max(40)).min(2).max(4) }),
      execute: async ({ options }) => ({ options }),
    }),

    ask_for_contact_details: tool({
      description:
        "Show a short contact form (name, mobile, optional email, consent tick) when she wants the team to contact her: a consultation, a gift card, a membership question, or anything you can't finish in chat. Never ask her to type contact details for this; the form records her consent.",
      inputSchema: z.object({ reason: z.string().max(120).describe("What the team will contact her about, e.g. 'Royal Bridal Glow consultation'") }),
      execute: async ({ reason }) => ({ form: true, reason }),
    }),
  };
}

export type ConciergeTools = ReturnType<typeof conciergeTools>;

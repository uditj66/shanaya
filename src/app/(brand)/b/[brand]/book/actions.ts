"use server";
// Public booking from the brand website. Same engine as the AI receptionist and the dashboard: the database itself
// prevents double-booking, and consultation-only treatments become a call-back instead of a booking.
import { headers } from "next/headers";
import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { BookingError, createBooking } from "@/lib/booking-service";
import { resolveBooking, specialistsFor } from "@/lib/brand/booking";
import { rateLimited } from "@/lib/rate-limit";
import { fmtHuman, normalizePhone } from "@/lib/time";

const slug = z.string().regex(/^[a-z0-9-]{2,80}$/);
const Input = z.object({
  brand: slug,
  studio: slug,
  service: z.string().regex(/^[A-Z]{2,4}\d{3}$/),
  specialist: slug.optional().or(z.literal("")),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().or(z.literal("")),
  name: z.string().trim().min(2, "Please tell us your name").max(80),
  phone: z.string().trim().regex(/^(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/, "Enter a 10-digit Indian mobile number"),
  email: z.string().trim().email("Check your email address").max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional(),
  consent: z.literal("on", { errorMap: () => ({ message: "Please agree so we can contact you about this booking" }) }),
  website: z.string().max(0).optional(), // honeypot: real people never fill this
});

export type BookState =
  | null
  | { ok: false; error: string; fieldErrors?: Record<string, string>; alternatives?: string[]; values?: Record<string, string> }
  | { ok: true; kind: "booked"; reference: string; when: string; studio: string; treatment: string; specialist: string | null; startsAt: string; minutes: number }
  | { ok: true; kind: "callback"; studio: string; treatment: string };

export async function bookAppointment(_prev: BookState, form: FormData): Promise<BookState> {
  const result = await book(form);
  // React resets the form after an action; hand back what the guest typed so nothing is lost on an error.
  if (result && !result.ok) {
    const values = Object.fromEntries(["name", "phone", "email", "notes"].map((k) => [k, String(form.get(k) ?? "")]));
    return { ...result, values };
  }
  return result;
}

async function book(form: FormData): Promise<BookState> {
  const parsed = Input.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, error: "Please check the highlighted details.", fieldErrors };
  }
  const v = parsed.data;
  if (v.website) return { ok: false, error: "Something went wrong. Please try again." };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (await rateLimited(`book:${ip}`, 6, 600)) return { ok: false, error: "Too many attempts. Please wait a few minutes or call the studio." };

  const r = await resolveBooking(v.brand, v.studio, v.service);
  if (!r) return { ok: false, error: "That treatment isn't available at this studio any more." };
  const db = adminClient();
  const phone = normalizePhone(v.phone, "91");
  const studio = `Lumière ${r.salon.area}`;

  // Physician-led and multi-visit programmes: never booked directly, the team calls back to plan it.
  if (r.service.consultation_first) {
    const reason = [`Website consultation request: ${r.service.name}`, v.date && `preferred date ${v.date}`, v.notes && `notes: ${v.notes}`, v.email && `email ${v.email}`]
      .filter(Boolean)
      .join(" · ");
    const { error } = await db.from("callbacks").insert({ salon_id: r.salon.id, reason, customer_name: v.name, phone });
    if (error) return { ok: false, error: "We couldn't send your request. Please try again or call the studio." };
    return { ok: true, kind: "callback", studio, treatment: r.service.name };
  }

  if (!v.date || !v.time) return { ok: false, error: "Please choose a day and time." };
  const staffId = v.specialist ? (await specialistsFor(r.salon.id, r.service.id)).find((s) => s.slug === v.specialist)?.id ?? null : null;

  try {
    const { booking } = await createBooking(db, {
      salonId: r.salon.id,
      serviceId: r.service.id,
      date: v.date,
      time: v.time,
      staffId,
      customer: { name: v.name, phone, email: v.email || null },
      notes: ["Booked on the website", v.notes].filter(Boolean).join(" · "),
      source: "web",
    });
    return {
      ok: true,
      kind: "booked",
      reference: booking.reference,
      when: fmtHuman(booking.starts_at, r.salon.timezone),
      startsAt: booking.starts_at,
      minutes: r.service.duration_minutes,
      studio,
      treatment: r.service.name,
      specialist: staffId ? (booking.staff?.name ?? null) : null,
    };
  } catch (e) {
    if (e instanceof BookingError) {
      return { ok: false, error: e.code === "unavailable" ? "That time was just taken. Here are the nearest free times." : e.message, alternatives: e.alternatives.map((a) => a.time) };
    }
    console.error("[book]", e);
    return { ok: false, error: "We couldn't complete the booking. Please try again or call the studio." };
  }
}

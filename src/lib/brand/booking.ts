// Server-side helpers for the public booking flow (brand site). Uses the same booking engine as the AI and the dashboard.
import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { BookingError, getSlots, nextAvailableDate } from "@/lib/booking-service";
import { addDays, isDate, todayIn } from "@/lib/time";

/** Resolve brand + studio slug + service code to the concrete branch rows. */
export async function resolveBooking(brandSlug: string, studioSlug: string, code: string) {
  const db = adminClient();
  const { data: salon } = await db
    .from("salons")
    .select("id, timezone, currency, max_days_ahead, area, brand_id, brand:brand_id!inner (slug)")
    .eq("studio_slug", studioSlug)
    .eq("brand.slug", brandSlug)
    .eq("published", true)
    .maybeSingle();
  if (!salon) return null;
  const { data: service } = await db
    .from("services")
    .select("id, name, code, category, duration_minutes, price, consultation_first")
    .eq("salon_id", salon.id)
    .eq("code", code)
    .eq("active", true)
    .maybeSingle();
  if (!service) return null;
  return { salon, service };
}

/** Specialists at this studio who perform the service (public names and slugs only). */
export async function specialistsFor(salonId: string, serviceId: string) {
  const { data } = await adminClient()
    .from("staff_services")
    .select("staff:staff_id (id, slug, name, title, active, public_profile, sort_order)")
    .eq("salon_id", salonId)
    .eq("service_id", serviceId);
  return (data ?? [])
    .map((r) => r.staff)
    .filter((s): s is NonNullable<typeof s> => !!s && s.active && s.public_profile && !!s.slug)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => ({ id: s.id, slug: s.slug!, name: s.name, title: s.title ?? "" }));
}

/** Free times for a date (falls forward to the next available date when the day is full or closed). */
export async function availability(input: { brand: string; studio: string; service: string; date?: string | null; specialist?: string | null }) {
  const r = await resolveBooking(input.brand, input.studio, input.service);
  if (!r) throw new BookingError("not_found", "That treatment isn't offered at this studio");
  const db = adminClient();
  const specialists = await specialistsFor(r.salon.id, r.service.id);
  const staffId = input.specialist ? specialists.find((s) => s.slug === input.specialist)?.id ?? null : null;
  const today = todayIn(r.salon.timezone);
  const date = isDate(input.date) && input.date >= today ? input.date : today;
  const lastDate = addDays(today, r.salon.max_days_ahead);

  let { slots } = date <= lastDate ? await getSlots(db, { salonId: r.salon.id, serviceId: r.service.id, date, staffId }) : { slots: [] };
  let shownDate = date;
  let movedForward = false;
  if (!slots.length) {
    const next = await nextAvailableDate(db, { salonId: r.salon.id, serviceId: r.service.id, staffId, fromDate: addDays(date, 1), days: 21 });
    if (next) {
      slots = next.slots;
      shownDate = next.date;
      movedForward = true;
    }
  }
  const nameById = new Map(specialists.map((s) => [s.id, s.name]));
  return {
    date: shownDate,
    requestedDate: date,
    movedForward,
    today,
    lastDate,
    consultationFirst: r.service.consultation_first,
    specialists: specialists.map(({ slug, name, title }) => ({ slug, name, title })),
    slots: slots.map((s) => ({ time: s.time, with: s.staffIds.map((id) => nameById.get(id)).filter(Boolean) as string[] })),
  };
}

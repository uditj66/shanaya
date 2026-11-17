// Booking service shared by the AI agent (service-role client) and the staff dashboard (user client, RLS).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { computeSlots, pickSlots, type Interval, type Slot, type StaffDay } from "./availability";
import { addDays, countryCodeFor, normalizePhone, todayIn, zonedToDate } from "./time";

type DB = SupabaseClient<Database>;
type Source = Database["public"]["Enums"]["booking_source"];

const EXCLUSION_VIOLATION = "23P01";

export class BookingError extends Error {
  constructor(public code: "not_found" | "invalid" | "unavailable" | "closed", message: string, public alternatives: Slot[] = []) {
    super(message);
  }
}

export async function getSalon(db: DB, salonId: string) {
  const { data, error } = await db.from("salons").select("*").eq("id", salonId).single();
  if (error || !data) throw new BookingError("not_found", "Salon not found");
  return data;
}

type SlotQuery = {
  salonId: string;
  serviceId: string;
  date: string;
  staffId?: string | null;
  excludeBookingId?: string;
  now?: Date;
};

export async function getSlots(db: DB, q: SlotQuery) {
  const salon = await getSalon(db, q.salonId);
  const { data: service } = await db
    .from("services")
    .select("id, name, duration_minutes, buffer_minutes, price, active")
    .eq("salon_id", q.salonId)
    .eq("id", q.serviceId)
    .maybeSingle();
  if (!service || !service.active) throw new BookingError("not_found", "Service not found");

  const now = q.now ?? new Date();
  const today = todayIn(salon.timezone, now);
  if (q.date < today) return { salon, service, slots: [] as Slot[] };
  if (q.date > addDays(today, salon.max_days_ahead))
    throw new BookingError("invalid", `Bookings open up to ${salon.max_days_ahead} days ahead`);

  const { data: links } = await db
    .from("staff_services")
    .select("staff:staff_id (id, name, active)")
    .eq("salon_id", q.salonId)
    .eq("service_id", q.serviceId);
  let staff = (links ?? []).map((l) => l.staff).filter((s): s is NonNullable<typeof s> => !!s && s.active);
  if (q.staffId) staff = staff.filter((s) => s.id === q.staffId);
  if (!staff.length) return { salon, service, slots: [] as Slot[] };
  const ids = staff.map((s) => s.id);

  const dayStart = zonedToDate(q.date, "00:00", salon.timezone).toISOString();
  const dayEnd = zonedToDate(addDays(q.date, 1), "00:00", salon.timezone).toISOString();
  const weekday = new Date(`${q.date}T12:00:00Z`).getUTCDay();

  const [{ data: hours }, { data: bookings }, { data: timeOff }] = await Promise.all([
    db.from("staff_hours").select("staff_id, start_time, end_time").in("staff_id", ids).eq("weekday", weekday),
    db
      .from("bookings")
      .select("id, staff_id, starts_at, blocked_until")
      .eq("salon_id", q.salonId)
      .eq("status", "confirmed")
      .in("staff_id", ids)
      .lt("starts_at", dayEnd)
      .gt("blocked_until", dayStart),
    db.from("time_off").select("staff_id, starts_at, ends_at").eq("salon_id", q.salonId).lt("starts_at", dayEnd).gt("ends_at", dayStart),
  ]);

  const iv = (s: string, e: string): Interval => ({ start: Date.parse(s), end: Date.parse(e) });
  const days: StaffDay[] = staff.map((s) => {
    const own = (bookings ?? []).filter((b) => b.staff_id === s.id && b.id !== q.excludeBookingId);
    return {
      id: s.id,
      name: s.name,
      shifts: (hours ?? []).filter((h) => h.staff_id === s.id).map((h) => ({ start: h.start_time.slice(0, 5), end: h.end_time.slice(0, 5) })),
      busy: [
        ...own.map((b) => iv(b.starts_at, b.blocked_until)),
        ...(timeOff ?? []).filter((t) => t.staff_id === s.id).map((t) => iv(t.starts_at, t.ends_at)),
      ],
      bookingsToday: own.length,
    };
  });

  const slots = computeSlots({
    date: q.date,
    tz: salon.timezone,
    businessHours: salon.business_hours as Record<string, [string, string][]>,
    staff: days,
    salonClosures: (timeOff ?? []).filter((t) => !t.staff_id).map((t) => iv(t.starts_at, t.ends_at)),
    durationMin: service.duration_minutes,
    bufferMin: service.buffer_minutes,
    intervalMin: salon.slot_interval_minutes,
    earliest: now.getTime() + salon.min_notice_minutes * 60_000,
  });
  return { salon, service, slots, staff };
}

/** First date (from `fromDate`, up to `days` ahead) that has any free slot. */
export async function nextAvailableDate(db: DB, q: Omit<SlotQuery, "date"> & { fromDate: string; days?: number }) {
  for (let i = 0; i < (q.days ?? 14); i++) {
    const date = addDays(q.fromDate, i);
    try {
      const { slots } = await getSlots(db, { ...q, date });
      if (slots.length) return { date, slots };
    } catch (e) {
      if (e instanceof BookingError && e.code === "invalid") break;
      throw e;
    }
  }
  return null;
}

export async function upsertCustomer(db: DB, salonId: string, currency: string, c: { name: string; phone: string; email?: string | null }) {
  const phone = normalizePhone(c.phone, countryCodeFor(currency));
  if (phone.length < 10) throw new BookingError("invalid", "A valid phone number is required");
  const { data: existing } = await db.from("customers").select("*").eq("salon_id", salonId).eq("phone", phone).maybeSingle();
  if (existing) {
    if (c.name && c.name !== existing.name) await db.from("customers").update({ name: c.name }).eq("id", existing.id);
    return existing;
  }
  const { data, error } = await db
    .from("customers")
    .insert({ salon_id: salonId, name: c.name || "Guest", phone, email: c.email ?? null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export type CreateBookingInput = {
  salonId: string;
  serviceId: string;
  date: string;
  time: string;
  staffId?: string | null;
  customer: { name: string; phone: string; email?: string | null };
  notes?: string;
  source: Source;
  callId?: string | null;
  createdBy?: string | null;
};

export async function createBooking(db: DB, input: CreateBookingInput) {
  const { salon, service, slots } = await getSlots(db, {
    salonId: input.salonId,
    serviceId: input.serviceId,
    date: input.date,
    staffId: input.staffId,
  });
  const slot = slots.find((s) => s.time === input.time);
  if (!slot) throw new BookingError("unavailable", "That time is not available", pickSlots(slots, input.time, 3));

  const customer = await upsertCustomer(db, input.salonId, salon.currency, input.customer);
  const startsAt = new Date(slot.startsAt);
  const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60_000);
  const blockedUntil = new Date(endsAt.getTime() + service.buffer_minutes * 60_000);

  // Try each free therapist; the DB exclusion constraint settles races between simultaneous calls.
  for (const staffId of slot.staffIds) {
    const { data, error } = await db
      .from("bookings")
      .insert({
        salon_id: input.salonId,
        staff_id: staffId,
        service_id: service.id,
        customer_id: customer.id,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        blocked_until: blockedUntil.toISOString(),
        price: service.price,
        notes: input.notes ?? "",
        source: input.source,
        call_id: input.callId ?? null,
        created_by: input.createdBy ?? null,
      })
      .select("id, reference, starts_at, staff:staff_id (name), service:service_id (name)")
      .single();
    if (!error) return { booking: data, customer, salon, service };
    if (error.code !== EXCLUSION_VIOLATION) throw error;
  }
  throw new BookingError("unavailable", "That time was just taken", pickSlots(slots.filter((s) => s.time !== input.time), input.time, 3));
}

async function getBookingByRef(db: DB, salonId: string, ref: string) {
  const { data } = await db
    .from("bookings")
    .select("*, service:service_id (name)")
    .eq("salon_id", salonId)
    .or(`reference.eq.${ref.toUpperCase().replace(/[^A-Z0-9]/g, "")},id.eq.${/^[0-9a-f-]{36}$/i.test(ref) ? ref : "00000000-0000-0000-0000-000000000000"}`)
    .maybeSingle();
  return data;
}

export async function rescheduleBooking(db: DB, input: { salonId: string; reference: string; date: string; time: string; staffId?: string | null }) {
  const b = await getBookingByRef(db, input.salonId, input.reference);
  if (!b || b.status !== "confirmed") throw new BookingError("not_found", "Booking not found");
  const { service, slots } = await getSlots(db, {
    salonId: input.salonId,
    serviceId: b.service_id,
    date: input.date,
    staffId: input.staffId,
    excludeBookingId: b.id,
  });
  const slot = slots.find((s) => s.time === input.time);
  if (!slot) throw new BookingError("unavailable", "That time is not available", pickSlots(slots, input.time, 3));

  const startsAt = new Date(slot.startsAt);
  const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60_000);
  const blockedUntil = new Date(endsAt.getTime() + service.buffer_minutes * 60_000);
  // keep the same therapist when possible
  const order = slot.staffIds.includes(b.staff_id) ? [b.staff_id, ...slot.staffIds.filter((s) => s !== b.staff_id)] : slot.staffIds;
  for (const staffId of order) {
    const { data, error } = await db
      .from("bookings")
      .update({ staff_id: staffId, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), blocked_until: blockedUntil.toISOString() })
      .eq("id", b.id)
      .select("id, reference, starts_at, staff:staff_id (name), service:service_id (name)")
      .single();
    if (!error) return data;
    if (error.code !== EXCLUSION_VIOLATION) throw error;
  }
  throw new BookingError("unavailable", "That time was just taken");
}

export async function cancelBooking(db: DB, input: { salonId: string; reference: string; reason?: string }) {
  const b = await getBookingByRef(db, input.salonId, input.reference);
  if (!b || b.status !== "confirmed") throw new BookingError("not_found", "Booking not found");
  const { error } = await db.from("bookings").update({ status: "cancelled", cancel_reason: input.reason ?? null }).eq("id", b.id);
  if (error) throw error;
  return b;
}

export async function upcomingForPhone(db: DB, salonId: string, currency: string, rawPhone: string) {
  const phone = normalizePhone(rawPhone, countryCodeFor(currency));
  const { data: customer } = await db.from("customers").select("id, name").eq("salon_id", salonId).eq("phone", phone).maybeSingle();
  if (!customer) return { customer: null, bookings: [] };
  const { data } = await db
    .from("bookings")
    .select("reference, starts_at, status, staff:staff_id (name), service:service_id (name)")
    .eq("salon_id", salonId)
    .eq("customer_id", customer.id)
    .eq("status", "confirmed")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at")
    .limit(5);
  return { customer, bookings: data ?? [] };
}

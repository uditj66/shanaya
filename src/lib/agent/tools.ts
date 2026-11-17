// Agent tools, shared by phone calls (Vapi) and the website widget (OpenAI).
import "server-only";
import { adminClient } from "../supabase/admin";
import {
  BookingError,
  cancelBooking,
  createBooking,
  getSlots,
  nextAvailableDate,
  rescheduleBooking,
  upcomingForPhone,
} from "../booking-service";
import { pickSlots, type Slot } from "../availability";
import { countryCodeFor, fmtDate, fmtTime, isDate, isTime, normalizePhone } from "../time";
import type { SalonContext } from "./context";

export type ToolContext = {
  ctx: SalonContext;
  channel: "phone" | "web";
  callId: string | null; // our calls.id
  callerPhone: string | null;
};

import { toolDefs, type ToolDef } from "./tool-defs";
export { toolDefs, type ToolDef };

type Args = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function staffIdByName(t: ToolContext, name: string) {
  if (!name) return null;
  const n = name.toLowerCase();
  return t.ctx.staff.find((s) => s.name.toLowerCase() === n || s.name.toLowerCase().startsWith(n))?.id ?? null;
}

/** Medi-facials and multi-visit programmes are arranged through a consultation, never booked directly. */
function consultationOnly(t: ToolContext, serviceId: string) {
  const s = t.ctx.services.find((x) => x.id === serviceId);
  if (!s?.consultation_first) return null;
  return {
    consultation_required: true,
    service: s.name,
    message: `${s.name} is arranged through a consultation${s.provider_note ? ` (${s.provider_note})` : ""}. Ask for her preferred dates, then use request_callback with reason "Consultation: ${s.name}, preferred dates ...".`,
  };
}

function slotView(t: ToolContext, slots: Slot[]) {
  const names = new Map(t.ctx.staff.map((s) => [s.id, s.name]));
  return slots.map((s) => ({ time: s.time, therapists: s.staffIds.map((id) => names.get(id)).filter(Boolean) }));
}

function phoneFor(t: ToolContext, given: unknown) {
  const raw = str(given) || t.callerPhone || "";
  return raw ? normalizePhone(raw, countryCodeFor(t.ctx.salon.currency)) : "";
}

/** The booking must belong to the phone number the guest gave (or is calling from). */
async function assertOwnsBooking(t: ToolContext, reference: string, phone: string) {
  const db = adminClient();
  const { data } = await db
    .from("bookings")
    .select("id, customer:customer_id (phone)")
    .eq("salon_id", t.ctx.salon.id)
    .eq("reference", reference.toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .maybeSingle();
  if (!data) throw new BookingError("not_found", "No booking with that reference");
  if (!phone || data.customer?.phone !== phone) throw new BookingError("not_found", "That reference doesn't match this phone number");
}

const handlers: Record<string, (t: ToolContext, a: Args) => Promise<unknown>> = {
  async check_availability(t, a) {
    const serviceId = str(a.service_id);
    const date = str(a.date);
    if (!t.ctx.services.some((s) => s.id === serviceId)) return { error: "Unknown service_id. Use one from the Services list." };
    const consult = consultationOnly(t, serviceId);
    if (consult) return consult;
    if (!isDate(date)) return { error: "date must be YYYY-MM-DD" };
    const staffId = staffIdByName(t, str(a.therapist_name));
    if (str(a.therapist_name) && !staffId) return { error: `No therapist named ${str(a.therapist_name)}` };

    const db = adminClient();
    const { slots, service } = await getSlots(db, { salonId: t.ctx.salon.id, serviceId, date, staffId });
    if (slots.length) {
      return { date, service: service.name, available: slotView(t, pickSlots(slots, str(a.preferred_time) || undefined, 3)), more_times_available: slots.length > 3 };
    }
    const next = await nextAvailableDate(db, { salonId: t.ctx.salon.id, serviceId, staffId, fromDate: date, days: 21 });
    return next
      ? { date, available: [], message: "No free times that day.", next_available_date: next.date, next_available: slotView(t, pickSlots(next.slots, str(a.preferred_time) || undefined, 3)) }
      : { date, available: [], message: "No availability in the next three weeks. Offer a callback." };
  },

  async book_appointment(t, a) {
    const consult = consultationOnly(t, str(a.service_id));
    if (consult) return consult;
    const phone = phoneFor(t, a.phone);
    if (phone.length < 10) return { error: "Ask the guest for their mobile number." };
    if (!isDate(a.date) || !isTime(a.time)) return { error: "date must be YYYY-MM-DD and time HH:MM" };
    const db = adminClient();
    const { booking, customer } = await createBooking(db, {
      salonId: t.ctx.salon.id,
      serviceId: str(a.service_id),
      date: a.date,
      time: a.time,
      staffId: staffIdByName(t, str(a.therapist_name)),
      customer: { name: str(a.customer_name), phone },
      notes: str(a.notes),
      source: t.channel,
      callId: t.callId,
    });
    if (t.callId) await db.from("calls").update({ customer_id: customer.id, outcome: "booked" }).eq("id", t.callId);
    return {
      success: true,
      reference: booking.reference,
      service: booking.service?.name,
      therapist: booking.staff?.name,
      date: fmtDate(booking.starts_at, t.ctx.salon.timezone),
      time: fmtTime(booking.starts_at, t.ctx.salon.timezone),
    };
  },

  async find_appointments(t, a) {
    const phone = phoneFor(t, a.phone);
    if (phone.length < 10) return { error: "Ask the guest for their mobile number." };
    const { customer, bookings } = await upcomingForPhone(adminClient(), t.ctx.salon.id, t.ctx.salon.currency, phone);
    if (!customer) return { appointments: [], message: "No guest found with that number." };
    return {
      guest: customer.name,
      appointments: bookings.map((b) => ({
        reference: b.reference,
        service: b.service?.name,
        therapist: b.staff?.name,
        date: fmtDate(b.starts_at, t.ctx.salon.timezone),
        time: fmtTime(b.starts_at, t.ctx.salon.timezone),
      })),
    };
  },

  async reschedule_appointment(t, a) {
    if (!isDate(a.new_date) || !isTime(a.new_time)) return { error: "new_date must be YYYY-MM-DD and new_time HH:MM" };
    await assertOwnsBooking(t, str(a.reference), phoneFor(t, a.phone));
    const b = await rescheduleBooking(adminClient(), { salonId: t.ctx.salon.id, reference: str(a.reference), date: a.new_date, time: a.new_time });
    if (t.callId) await adminClient().from("calls").update({ outcome: "rescheduled" }).eq("id", t.callId);
    return { success: true, reference: b.reference, therapist: b.staff?.name, date: a.new_date, time: a.new_time };
  },

  async cancel_appointment(t, a) {
    await assertOwnsBooking(t, str(a.reference), phoneFor(t, a.phone));
    await cancelBooking(adminClient(), { salonId: t.ctx.salon.id, reference: str(a.reference), reason: str(a.reason) || "Cancelled by guest via AI" });
    if (t.callId) await adminClient().from("calls").update({ outcome: "cancelled" }).eq("id", t.callId);
    return { success: true, message: "Cancelled." };
  },

  async request_callback(t, a) {
    const reason = str(a.reason);
    if (!reason) return { error: "reason is required" };
    const phone = phoneFor(t, a.phone);
    // The team must be able to call her back: no number, no call-back.
    if (phone.length < 10) return { error: "Ask for her name and mobile number first, then call request_callback again with them." };
    await adminClient().from("callbacks").insert({
      salon_id: t.ctx.salon.id,
      reason,
      customer_name: str(a.customer_name) || null,
      phone: phone || null,
      call_id: t.callId,
    });
    if (t.callId) await adminClient().from("calls").update({ outcome: "callback" }).eq("id", t.callId);
    return { success: true, message: "The team has been notified and will call back during opening hours." };
  },
};

/** Run a tool and always return a JSON-serialisable result (errors become messages the model can act on). */
export async function runTool(t: ToolContext, name: string, args: Args) {
  const fn = handlers[name];
  if (!fn) return { error: `Unknown tool ${name}` };
  try {
    return await fn(t, args ?? {});
  } catch (e) {
    if (e instanceof BookingError) {
      return {
        error: e.message,
        ...(e.alternatives.length ? { alternatives: slotView(t, e.alternatives) } : {}),
      };
    }
    console.error(`[tool ${name}]`, e);
    return { error: "Something went wrong on our side. Offer to take a message for the team." };
  }
}

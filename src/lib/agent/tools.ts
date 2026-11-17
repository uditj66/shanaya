// Agent tools for the whole chain, shared by voice (Vapi) and typed chat (OpenAI).
// A call starts at an "entry" branch (the number dialled or the widget link) but can book at any branch of the brand.
import "server-only";
import { adminClient } from "../supabase/admin";
import { BookingError, cancelBooking, createBooking, getSlots, nextAvailableDate, rescheduleBooking } from "../booking-service";
import { pickSlots, type Slot } from "../availability";
import { countryCodeFor, fmtDate, fmtTime, isDate, isTime, normalizePhone } from "../time";
import { displayName, loadSalonContext, type SalonContext } from "./context";
import { toolDefs, type ToolDef } from "./tool-defs";
import { logEvent } from "../events";

export { toolDefs, type ToolDef };

export type ToolContext = {
  ctx: SalonContext; // entry branch
  channel: "phone" | "web";
  callId: string | null; // our calls.id
  callerPhone: string | null;
  cache?: Map<string, SalonContext>;
};

type Args = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** All branch ids of the entry branch's brand (or just the entry branch for standalone salons). */
const brandIds = (t: ToolContext) => [t.ctx.salon.id, ...t.ctx.branches.map((b) => b.id)];

/** Resolve the branch the guest chose. Only branches of the same brand are allowed. */
async function branchCtx(t: ToolContext, branchId: unknown): Promise<SalonContext> {
  const id = str(branchId) || t.ctx.salon.id;
  if (id === t.ctx.salon.id) return t.ctx;
  if (!brandIds(t).includes(id)) {
    const byCode = t.ctx.branches.find((b) => b.slug === id || b.area?.toLowerCase() === id.toLowerCase());
    if (!byCode) throw new BookingError("invalid", "Unknown branch_id. Use one from the Branch directory.");
    return branchCtx(t, byCode.id);
  }
  t.cache ??= new Map();
  if (!t.cache.has(id)) {
    const ctx = await loadSalonContext(adminClient(), id);
    if (!ctx) throw new BookingError("invalid", "Unknown branch_id.");
    t.cache.set(id, ctx);
  }
  return t.cache.get(id)!;
}

/** Find a service by code (FAC003), id or name in a given branch. */
function serviceIn(ctx: SalonContext, ref: unknown) {
  const q = str(ref).toLowerCase();
  if (!q) return null;
  return (
    ctx.services.find((s) => s.code?.toLowerCase() === q) ??
    ctx.services.find((s) => s.id === q) ??
    ctx.services.find((s) => s.name.toLowerCase() === q) ??
    ctx.services.find((s) => s.name.toLowerCase().includes(q)) ??
    null
  );
}

function staffIdByName(ctx: SalonContext, name: string) {
  if (!name) return null;
  const n = name.toLowerCase().replace(/^dr\.?\s*/, "");
  return ctx.staff.find((s) => s.name.toLowerCase().replace(/^dr\.?\s*/, "").startsWith(n))?.id ?? null;
}

/** Medi-facials and multi-visit programmes are arranged through a consultation, never booked directly. */
function consultationOnly(s: SalonContext["services"][number]) {
  if (!s.consultation_first) return null;
  return {
    consultation_required: true,
    service: s.name,
    message: `${s.name} is arranged through a consultation${s.provider_note ? ` (${s.provider_note})` : ""}. Take her name, mobile number and preferred dates, then use request_callback with reason "Consultation: ${s.name}, preferred dates ...".`,
  };
}

function slotView(ctx: SalonContext, slots: Slot[]) {
  const names = new Map(ctx.staff.map((s) => [s.id, s.name]));
  return slots.map((s) => ({ time: s.time, therapists: s.staffIds.map((id) => names.get(id)).filter(Boolean) }));
}

function phoneFor(t: ToolContext, given: unknown) {
  const raw = str(given) || t.callerPhone || "";
  return raw ? normalizePhone(raw, countryCodeFor(t.ctx.salon.currency)) : "";
}

const cleanRef = (r: unknown) => str(r).toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Find a booking by reference anywhere in the brand, and check it belongs to this phone number. */
async function ownedBooking(t: ToolContext, reference: unknown, phone: string) {
  const { data } = await adminClient()
    .from("bookings")
    .select("id, salon_id, reference, status, customer:customer_id (phone)")
    .in("salon_id", brandIds(t))
    .eq("reference", cleanRef(reference));
  const b = (data ?? []).find((x) => x.status === "confirmed") ?? data?.[0];
  if (!b) throw new BookingError("not_found", "No booking with that reference");
  if (!phone || b.customer?.phone !== phone) throw new BookingError("not_found", "That reference doesn't match this phone number");
  return b;
}

const handlers: Record<string, (t: ToolContext, a: Args) => Promise<unknown>> = {
  async check_availability(t, a) {
    const ctx = await branchCtx(t, a.branch_id);
    const svc = serviceIn(ctx, a.service ?? a.service_id);
    if (!svc) return { error: "Unknown service. Use a service code from the menu, e.g. FAC003." };
    const consult = consultationOnly(svc);
    if (consult) return consult;
    const date = str(a.date);
    if (!isDate(date)) return { error: "date must be YYYY-MM-DD" };
    const staffId = staffIdByName(ctx, str(a.therapist_name));
    if (str(a.therapist_name) && !staffId) return { error: `No therapist named ${str(a.therapist_name)} at ${ctx.salon.area ?? "this branch"}` };

    const db = adminClient();
    const branch = displayName(ctx.salon);
    const { slots } = await getSlots(db, { salonId: ctx.salon.id, serviceId: svc.id, date, staffId });
    if (slots.length) {
      return {
        branch,
        date,
        service: svc.name,
        minutes: svc.duration_minutes,
        price: Number(svc.price),
        available: slotView(ctx, pickSlots(slots, str(a.preferred_time) || undefined, 3)),
        more_times_available: slots.length > 3,
      };
    }
    const next = await nextAvailableDate(db, { salonId: ctx.salon.id, serviceId: svc.id, staffId, fromDate: date, days: 21 });
    return next
      ? { branch, date, service: svc.name, available: [], message: "No free times that day.", next_available_date: next.date, next_available: slotView(ctx, pickSlots(next.slots, str(a.preferred_time) || undefined, 3)) }
      : { branch, date, service: svc.name, available: [], message: "No availability in the next three weeks at this branch. Offer a nearby branch or a callback." };
  },

  async book_appointment(t, a) {
    const ctx = await branchCtx(t, a.branch_id);
    const svc = serviceIn(ctx, a.service ?? a.service_id);
    if (!svc) return { error: "Unknown service. Use a service code from the menu." };
    const consult = consultationOnly(svc);
    if (consult) return consult;
    const phone = phoneFor(t, a.phone);
    if (phone.length < 10) return { error: "Ask the guest for her mobile number." };
    if (!isDate(a.date) || !isTime(a.time)) return { error: "date must be YYYY-MM-DD and time HH:MM" };
    const db = adminClient();
    const { booking, customer } = await createBooking(db, {
      salonId: ctx.salon.id,
      serviceId: svc.id,
      date: a.date,
      time: a.time,
      staffId: staffIdByName(ctx, str(a.therapist_name)),
      customer: { name: str(a.customer_name), phone },
      notes: str(a.notes),
      source: t.channel,
      callId: t.callId,
    });
    if (t.callId) await db.from("calls").update({ customer_id: ctx.salon.id === t.ctx.salon.id ? customer.id : null, outcome: "booked" }).eq("id", t.callId);
    return {
      success: true,
      reference: booking.reference,
      branch: displayName(ctx.salon),
      address: ctx.salon.is_placeholder ? `${ctx.salon.area}, ${ctx.salon.city}: the studio will share the exact address with your confirmation` : ctx.salon.address,
      service: booking.service?.name,
      therapist: booking.staff?.name,
      date: fmtDate(booking.starts_at, ctx.salon.timezone),
      time: fmtTime(booking.starts_at, ctx.salon.timezone),
      price: Number(svc.price),
    };
  },

  async guest_history(t, a) {
    const phone = phoneFor(t, a.phone);
    if (phone.length < 10) return { error: "Ask the guest for her mobile number." };
    const db = adminClient();
    const { data: customers } = await db.from("customers").select("id, name").in("salon_id", brandIds(t)).eq("phone", phone);
    if (!customers?.length) return { visits: [], message: "First visit: no previous bookings with this number. Welcome her warmly." };
    const { data } = await db
      .from("bookings")
      .select("starts_at, status, salon_id, salon:salon_id (brand_name, area, name, timezone), staff:staff_id (name, title), service:service_id (name, category)")
      .in("customer_id", customers.map((c) => c.id))
      .in("status", ["confirmed", "completed"])
      .lt("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: false })
      .limit(10);
    const visits = (data ?? []).map((b) => ({
      date: fmtDate(b.starts_at, b.salon?.timezone ?? t.ctx.salon.timezone),
      branch: b.salon ? displayName(b.salon) : "",
      branch_id: b.salon_id,
      treatment: b.service?.name,
      category: b.service?.category,
      served_by: b.staff ? `${b.staff.name}${b.staff.title ? ` (${b.staff.title})` : ""}` : null,
      therapist_name: b.staff?.name ?? null,
    }));
    if (!visits.length) return { guest: customers[0].name, visits: [], message: "No past visits yet (only upcoming ones)." };
    // who she has seen most often, per branch
    const counts = new Map<string, { name: string; branch: string; branch_id: string; times: number }>();
    for (const v of visits) {
      if (!v.therapist_name) continue;
      const k = `${v.branch_id}:${v.therapist_name}`;
      const c = counts.get(k) ?? { name: v.therapist_name, branch: v.branch, branch_id: v.branch_id, times: 0 };
      c.times++;
      counts.set(k, c);
    }
    return {
      guest: customers[0].name,
      last_visit: visits[0],
      favourites: [...counts.values()].sort((x, y) => y.times - x.times).slice(0, 3),
      visits: visits.slice(0, 5),
      tip: "Offer the same person by name. Pass therapist_name (and that branch_id) to check_availability.",
    };
  },

  async find_appointments(t, a) {
    const phone = phoneFor(t, a.phone);
    if (phone.length < 10) return { error: "Ask the guest for her mobile number." };
    const db = adminClient();
    const { data: customers } = await db.from("customers").select("id, name, salon_id").in("salon_id", brandIds(t)).eq("phone", phone);
    if (!customers?.length) return { appointments: [], message: "No bookings found with that number." };
    const { data } = await db
      .from("bookings")
      .select("reference, starts_at, salon:salon_id (brand_name, area, name, timezone), staff:staff_id (name), service:service_id (name)")
      .in("customer_id", customers.map((c) => c.id))
      .eq("status", "confirmed")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(5);
    return {
      guest: customers[0].name,
      appointments: (data ?? []).map((b) => ({
        reference: b.reference,
        branch: b.salon ? displayName(b.salon) : "",
        service: b.service?.name,
        therapist: b.staff?.name,
        date: fmtDate(b.starts_at, b.salon?.timezone ?? t.ctx.salon.timezone),
        time: fmtTime(b.starts_at, b.salon?.timezone ?? t.ctx.salon.timezone),
      })),
    };
  },

  async reschedule_appointment(t, a) {
    if (!isDate(a.new_date) || !isTime(a.new_time)) return { error: "new_date must be YYYY-MM-DD and new_time HH:MM" };
    const owned = await ownedBooking(t, a.reference, phoneFor(t, a.phone));
    const b = await rescheduleBooking(adminClient(), { salonId: owned.salon_id, reference: owned.reference, date: a.new_date, time: a.new_time });
    if (t.callId) await adminClient().from("calls").update({ outcome: "rescheduled" }).eq("id", t.callId);
    return { success: true, reference: b.reference, therapist: b.staff?.name, date: a.new_date, time: a.new_time };
  },

  async cancel_appointment(t, a) {
    const owned = await ownedBooking(t, a.reference, phoneFor(t, a.phone));
    await cancelBooking(adminClient(), { salonId: owned.salon_id, reference: owned.reference, reason: str(a.reason) || "Cancelled by guest via AI" });
    if (t.callId) await adminClient().from("calls").update({ outcome: "cancelled" }).eq("id", t.callId);
    return { success: true, message: "Cancelled." };
  },

  async request_callback(t, a) {
    const reason = str(a.reason);
    if (!reason) return { error: "reason is required" };
    const phone = phoneFor(t, a.phone);
    // The team must be able to call her back: no number, no call-back.
    if (phone.length < 10) return { error: "Ask for her name and mobile number first, then call request_callback again with them." };
    const ctx = await branchCtx(t, a.branch_id).catch(() => t.ctx);
    await adminClient().from("callbacks").insert({
      salon_id: ctx.salon.id,
      reason,
      customer_name: str(a.customer_name) || null,
      phone,
      call_id: t.callId,
    });
    if (t.callId) await adminClient().from("calls").update({ outcome: "callback" }).eq("id", t.callId);
    return { success: true, branch: displayName(ctx.salon), message: "The team has been notified and will call back during opening hours." };
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
        ...(e.alternatives.length ? { alternatives: e.alternatives.map((s) => s.time) } : {}),
      };
    }
    console.error(`[tool ${name}]`, e);
    await logEvent(t.ctx.salon.id, "tool_error", { tool: name, channel: t.channel, message: e instanceof Error ? e.message : String(e) });
    return { error: "Something went wrong on our side. Apologise briefly and offer to take a message for the team." };
  }
}

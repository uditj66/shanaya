// Agent tools for the whole chain, shared by voice (Vapi) and typed chat (OpenAI).
// A call starts at an "entry" branch (the number dialled or the widget link) but can book at any branch of the brand.
import "server-only";
import { adminClient } from "../supabase/admin";
import { BookingError, cancelBooking, createBooking, getSlots, nextAvailableDate, rescheduleBooking } from "../booking-service";
import { pickSlots, type Slot } from "../availability";
import { countryCodeFor, fmtDate, fmtTime, isDate, isTime, normalizePhone, todayIn } from "../time";
import { displayName, loadSalonContext, type SalonContext } from "./context";
import { money } from "./prompt";
import { toolDefs, type ToolDef } from "./tool-defs";
import { logEvent } from "../events";
import { settleDepositOnCancel } from "../payments/deposits";
import { MEMBER_FREE_HOLDS, applyBookingPerks, checkGiftCard, cleanGiftCode, type BookingPayment } from "../payments/redemption";
import { rateLimited } from "../rate-limit";
import { loadReturningGuest } from "./find-returning-guest";
import { nameMatches } from "./returning-guest";
import { memoryLines } from "./guest-memory";
import { markVerifiedPhone } from "./remember-call";

export { toolDefs, type ToolDef };

export type ToolContext = {
  ctx: SalonContext; // entry branch
  channel: "phone" | "web";
  callId: string | null; // our calls.id
  callerPhone: string | null;
  cache?: Map<string, SalonContext>;
};

type Args = Record<string, unknown>;

/** What the agent tells the guest when her freed included treatment moved to another of her bookings. */
const includedPassedNote = (t: ToolContext, b: { reference: string; starts_at: string; service: { name: string } | null }) =>
  `Tell her: the included treatment from her membership now applies to her ${b.service?.name ?? "other booking"} on ${fmtDate(b.starts_at, t.ctx.salon.timezone)} at ${fmtTime(b.starts_at, t.ctx.salon.timezone)} (ref ${b.reference}), so that visit is now at no charge.`;
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

/**
 * Find a booking by reference anywhere in the brand that belongs to THIS phone number.
 * References are only unique per branch, so match on the phone too (prefer a confirmed booking).
 */
async function ownedBooking(t: ToolContext, reference: unknown, phone: string, confirmedOnly = true) {
  if (!phone) throw new BookingError("not_found", "Ask for her mobile number and booking reference.");
  const { data } = await adminClient()
    .from("bookings")
    .select("id, salon_id, reference, status, starts_at, customer:customer_id (phone, name)")
    .in("salon_id", brandIds(t))
    .eq("reference", cleanRef(reference));
  const mine = (data ?? []).filter((x) => x.customer?.phone === phone);
  const b = mine.find((x) => x.status === "confirmed") ?? (confirmedOnly ? undefined : mine[0]);
  if (!b) throw new BookingError("not_found", "That booking reference doesn't match this mobile number.");
  return b;
}

/** Website guests have no caller ID: personal data needs a booking reference that belongs to her number. */
async function webVerified(t: ToolContext, a: Args, phone: string) {
  if (t.channel !== "web") return true;
  if (!str(a.reference)) return false;
  await ownedBooking(t, a.reference, phone, false);
  return true;
}

const APPOINTMENT_FIELDS =
  "reference, starts_at, ends_at, status, price, deposit_amount, deposit_status, gift_card_amount, gift_card_state, member_benefit, member_discount, refund_by, salon:salon_id (brand_name, area, name, timezone, currency), staff:staff_id (name), service:service_id (name)" as const;

/** One appointment as Shanaya reads it back: treatment, specialist, when, where, and how it's paid for. */
function appointmentView(
  t: ToolContext,
  b: {
    reference: string; starts_at: string; ends_at: string; status: string; price: number;
    deposit_amount: number | null; deposit_status: string | null; gift_card_amount: number | null; gift_card_state: string | null;
    member_benefit: string | null; member_discount: number | null; refund_by: string | null;
    salon: { brand_name: string | null; area: string | null; name: string; timezone: string; currency: string } | null;
    staff: { name: string } | null; service: { name: string } | null;
  },
) {
  const tz = b.salon?.timezone ?? t.ctx.salon.timezone;
  const m = (n: number) => money(n, b.salon?.currency ?? t.ctx.salon.currency);
  const price = Number(b.price);
  const memberOff = Number(b.member_discount ?? 0);
  const gift = b.gift_card_state === "used" ? Number(b.gift_card_amount ?? 0) : 0;
  const deposit = b.deposit_status === "paid" ? Number(b.deposit_amount ?? 0) : 0;
  return {
    reference: b.reference,
    service: b.service?.name,
    therapist: b.staff?.name,
    branch: b.salon ? displayName(b.salon) : "",
    date: fmtDate(b.starts_at, tz),
    time: fmtTime(b.starts_at, tz),
    minutes: Math.round((Date.parse(b.ends_at) - Date.parse(b.starts_at)) / 60000),
    status: b.status === "confirmed" && b.deposit_status === "pending" ? "held until the deposit is paid" : b.status,
    price,
    ...(b.member_benefit && { member: b.member_benefit === "included" ? "included with her membership" : `member discount ${m(memberOff)}` }),
    ...(gift > 0 && { paid_with_gift_card: gift }),
    ...(deposit > 0 && { deposit_paid: deposit }),
    pay_at_studio: Math.max(0, price - memberOff - gift - deposit),
    ...(b.status === "confirmed" && windowPassed(b.refund_by) && {
      late_change_note:
        "The cancellation window for this appointment has passed. Before cancelling or moving it, tell her: " +
        [deposit > 0 && "the deposit is kept", gift > 0 && "the gift card amount is kept", b.member_benefit === "included" && "her included membership treatment counts as used if she cancels"]
          .filter(Boolean).join(", ") +
        (deposit > 0 || gift > 0 || b.member_benefit === "included" ? "." : "nothing is lost, but the studio prefers more notice."),
    }),
  };
}

/** Request-time check: is the booking past its refund deadline (late cancel / late move)? */
const windowPassed = (refundBy: string | null) => !!refundBy && Date.parse(refundBy) <= Date.now();

/** Readable text for any thrown value (database errors are plain objects, which would log as "[object Object]"). */
function errorText(e: unknown) {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    const o = e as { message?: unknown; code?: unknown; details?: unknown };
    return [o.code, o.message, o.details].filter(Boolean).join(": ") || JSON.stringify(e).slice(0, 300);
  }
  return String(e);
}

/** What a booking's membership benefit and gift card mean, in words Shanaya can pass on. */
function paymentView(p: BookingPayment | undefined, noDeposit: boolean, currency: string, price: number) {
  const m = (n: number) => money(n, currency);
  // No membership or gift card: still say what she pays, or Shanaya fills the gap from the website-chat deposit rule
  // and tells a phone or voice caller about a deposit that doesn't exist (seen on a live call).
  if (!p) return { no_deposit: noDeposit, pay_at_studio: price, payment_note: `She pays ${m(price)} at the studio.` };
  const parts = [
    p.member && (p.member.benefit === "included" ? `This treatment is included with her ${p.member.tier} membership (${p.member.includedNote}).` : `Her ${p.member.tier} member discount takes ${m(p.member.discount)} off.`),
    p.giftCard && `${m(p.giftCard.amount)} was paid with her gift card; ${m(p.giftCard.balance)} is left on it.`,
    p.payAtStudio > 0 ? `She pays ${m(p.payAtStudio)} at the studio.` : "Nothing is left to pay at the studio.",
    p.giftCard && `If she cancels at least ${p.refundHours} hours before, the gift card amount goes back on her card.`,
    p.member && "Ask her to bring the phone her membership is registered to; the studio confirms it at the visit.",
  ].filter(Boolean);
  return {
    no_deposit: noDeposit,
    ...(p.member && { member: { tier: p.member.tier, benefit: p.member.benefit, discount: p.member.discount } }),
    ...(p.giftCard && { gift_card: { paid: p.giftCard.amount, balance_left: p.giftCard.balance } }),
    pay_at_studio: p.payAtStudio,
    payment_note: parts.join(" "),
  };
}

const handlers: Record<string, (t: ToolContext, a: Args) => Promise<unknown>> = {
  async check_gift_card(t, a) {
    const brandId = t.ctx.salon.brand_id;
    if (!brandId) return { error: "Gift cards aren't available at this branch." };
    const key = `giftcheck:${t.callId ?? t.callerPhone ?? "anon"}`;
    if (await rateLimited(key, 6, 600)) return { error: "Too many gift card checks. Ask her to try again in a few minutes, or to show the card at the studio." };
    const g = await checkGiftCard(brandId, str(a.code));
    if (!g.ok) return { valid: false, message: `${g.error} Read the code back to check it.` };
    return {
      valid: true,
      balance: g.balance,
      expires: g.expiresAt ? fmtDate(g.expiresAt, t.ctx.salon.timezone) : null,
      message: `Valid. Balance ${money(g.balance, t.ctx.salon.currency)}. Pass it as gift_card_code to book_appointment: it pays the treatment price (after any member discount) up to the balance, and no deposit is needed.`,
    };
  },

  async check_availability(t, a) {
    const ctx = await branchCtx(t, a.branch_id);
    const svc = serviceIn(ctx, a.service ?? a.service_id);
    if (!svc) return { error: "Unknown service. Retry with the [code] of the closest listed treatment (internal: never mention codes to the guest; if nothing matches, offer the closest treatment by name)." };
    const consult = consultationOnly(svc);
    if (consult) return consult;
    const date = str(a.date);
    if (!isDate(date)) return { error: "date must be YYYY-MM-DD" };
    if (date < todayIn(ctx.salon.timezone)) return { error: "That date is in the past. Use the calendar in the knowledge to pick an upcoming date." };
    const staffId = staffIdByName(ctx, str(a.therapist_name));
    if (str(a.therapist_name) && !staffId) return { error: `No therapist named ${str(a.therapist_name)} at ${ctx.salon.area ?? "this branch"}` };

    const db = adminClient();
    if (staffId) {
      const { count } = await db.from("staff_services").select("*", { count: "exact", head: true }).eq("staff_id", staffId).eq("service_id", svc.id);
      if (!count) return { error: `${str(a.therapist_name)} doesn't perform ${svc.name}. Suggest a specialist who does, or ask if any available therapist is fine.` };
    }
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
    if (!svc) return { error: "Unknown service. Retry with the [code] of the closest listed treatment (internal: never mention codes to the guest; if nothing matches, offer the closest treatment by name)." };
    const consult = consultationOnly(svc);
    if (consult) return consult;
    const phone = phoneFor(t, a.phone);
    if (phone.length < 10) return { error: "Ask the guest for her mobile number." };
    if (!isDate(a.date) || !isTime(a.time)) return { error: "date must be YYYY-MM-DD and time HH:MM" };
    const brandId = ctx.salon.brand_id;
    // A gift card is checked before taking the time, so a mistyped code doesn't leave a booking behind.
    const giftCode = str(a.gift_card_code) ? cleanGiftCode(str(a.gift_card_code)) : "";
    if (giftCode) {
      if (!brandId) return { error: "Gift cards can't be used at this branch. Book without it; she can show the card at the studio." };
      const g = await checkGiftCard(brandId, giftCode);
      if (!g.ok) return { error: `${g.error} Read the code back to her character by character, or book without the gift card.` };
    }
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
    // Membership benefits (by her mobile number) and the gift card, exactly as on the website booking page.
    const { data: brand } = brandId ? await db.from("brands").select("deposit_refund_hours").eq("id", brandId).maybeSingle() : { data: null };
    const perks = await applyBookingPerks(booking.id, {
      brandId, phone, service: { category: svc.category, price: Number(svc.price) }, startsAt: booking.starts_at, timezone: ctx.salon.timezone,
      giftCode, refundHours: brand?.deposit_refund_hours ?? 24,
    });
    if (!perks.ok) {
      await db.from("bookings").update({ status: "cancelled", cancel_reason: "Gift card couldn't be used" }).eq("id", booking.id);
      return { error: `${perks.error} The booking was not made. Offer to book without the gift card.` };
    }
    if (t.callId) await db.from("calls").update({ customer_id: ctx.salon.id === t.ctx.salon.id ? customer.id : null, outcome: "booked" }).eq("id", t.callId);
    return {
      ...paymentView(perks.payment, perks.noDeposit, ctx.salon.currency, Number(svc.price)),
      ...(perks.memberEndsAt && {
        member_note: `Tell her: her membership ends on ${fmtDate(perks.memberEndsAt, ctx.salon.timezone)}, before this appointment, so member benefits don't apply to this visit and it is at the regular price. If she renews her membership before the visit, the studio can apply her benefits then. Offer an earlier date inside her membership if she prefers.`,
      }),
      // Only website chat takes deposits (phone bookings never do).
      ...(perks.memberCapReached && t.channel === "web" && {
        member_note: `Tell her: members can hold up to ${MEMBER_FREE_HOLDS} upcoming bookings without a deposit, and she already has that many, so this one needs the usual deposit. Her member benefits still apply.`,
      }),
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
    // Same answer whether the number is unknown or the name doesn't match, so nobody can probe who is a guest.
    const newGuest = { visits: [], message: "No previous visits found. Welcome her warmly as a new guest. Never say a number or name wasn't found or didn't match." };
    if (t.channel === "web") {
      // No caller ID online: her mobile number plus the first name on file (or any of her booking references).
      if (await rateLimited(`guest_history:${t.callId ?? phone}`, 4, 3600)) return newGuest;
      const byName = (customers ?? []).some((c) => nameMatches(str(a.name), c.name));
      const byRef = !byName && str(a.reference) ? await webVerified(t, a, phone).catch(() => false) : false;
      if (!byName && !byRef) {
        return str(a.name) || str(a.reference) ? newGuest : { error: "Ask for her first name too, then call guest_history again with phone and name." };
      }
      await markVerifiedPhone(t.callId, phone).catch(() => {}); // so what she shares is remembered for this guest
    }
    if (!customers?.length) return newGuest;
    const profile = await loadReturningGuest(t.ctx, phone).catch(() => null);
    const tz = t.ctx.salon.timezone;
    const extras = {
      upcoming: profile?.upcoming
        ? {
            treatment: profile.upcoming.treatment,
            branch: profile.upcoming.branch,
            when: `${fmtDate(profile.upcoming.at, tz)} ${fmtTime(profile.upcoming.at, tz)}`,
            // online, the reference itself is the key to changing a booking, so it is never handed out here
            ...(t.channel === "web" ? {} : { reference: profile.upcoming.reference }),
          }
        : null,
      membership: profile?.member ? { tier: profile.member.tier, until: profile.member.endsAt ? fmtDate(profile.member.endsAt, tz) : null } : null,
      remembered: profile?.notes.length ? memoryLines(profile.notes, tz, todayIn(tz)) : [],
      last_call_summary: profile?.notes.length ? null : (profile?.lastCall?.summary.slice(0, 400) ?? null),
      usual_branch: profile?.usualBranch ?? null,
      how_to_use:
        "She is a returning guest: welcome her back by first name and use this briefly and naturally, like a front desk that remembers her (never read it out or say how you know). Offer her favourite therapist and usual branch as questions. If 'remembered' mentions an occasion, ask about it warmly (how it went, or whether she's preparing for it).",
    };
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
    if (!visits.length) return { guest: customers[0].name, visits: [], message: "No past visits yet (only upcoming ones).", ...extras };
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
      ...extras,
    };
  },

  async find_appointments(t, a) {
    const phone = phoneFor(t, a.phone);
    if (phone.length < 10) return { error: "Ask the guest for her mobile number." };
    if (t.channel === "web") {
      // No caller ID online: never list someone's bookings from a phone number alone.
      if (!str(a.reference)) return { error: "For privacy, ask for her booking reference (from her confirmation) as well as her mobile number." };
      const owned = await ownedBooking(t, a.reference, phone);
      const { data } = await adminClient().from("bookings").select(APPOINTMENT_FIELDS).eq("id", owned.id);
      return { guest: owned.customer?.name, appointments: (data ?? []).map((b) => appointmentView(t, b)) };
    }
    const db = adminClient();
    const { data: customers } = await db.from("customers").select("id, name, salon_id").in("salon_id", brandIds(t)).eq("phone", phone);
    if (!customers?.length) return { appointments: [], message: "No bookings found with that number." };
    const { data } = await db
      .from("bookings")
      .select(APPOINTMENT_FIELDS)
      .in("customer_id", customers.map((c) => c.id))
      .eq("status", "confirmed")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(5);
    return { guest: customers[0].name, appointments: (data ?? []).map((b) => appointmentView(t, b)) };
  },

  async reschedule_appointment(t, a) {
    if (!isDate(a.new_date) || !isTime(a.new_time)) return { error: "new_date must be YYYY-MM-DD and new_time HH:MM" };
    const owned = await ownedBooking(t, a.reference, phoneFor(t, a.phone));
    const b = await rescheduleBooking(adminClient(), { salonId: owned.salon_id, reference: owned.reference, date: a.new_date, time: a.new_time });
    if (t.callId) await adminClient().from("calls").update({ outcome: "rescheduled" }).eq("id", t.callId);
    return {
      success: true, reference: b.reference, therapist: b.staff?.name, date: a.new_date, time: a.new_time,
      ...(b.memberBenefitLost && {
        member_note: b.member_benefit === "discount"
          ? `Tell her: her included treatment for that period is already used, so this visit is no longer included; her member discount of ${money(Number(b.member_discount ?? 0), t.ctx.salon.currency)} applies instead and she pays the rest at the studio. Offer to move it back or to another month if she prefers.`
          : b.memberEndedBefore
          ? `Tell her: her membership ends on ${fmtDate(b.memberEndedBefore, t.ctx.salon.timezone)}, before the new date, so member benefits don't apply to this visit and it is at the regular price. Offer a date before her membership ends, or say the studio can apply benefits if she renews first.`
          : "Tell her: her included treatment for that period is already used, so this visit is no longer included and is paid at the studio. Offer to move it back or to another month if she prefers.",
      }),
      ...(b.includedPassedTo && { included_note: includedPassedNote(t, b.includedPassedTo) }),
      ...(b.refundLocked && {
        refund_note: "Tell her: because this change was made within the cancellation window, the amount already paid for this booking (deposit or gift card) is no longer refundable, even if she cancels later. It still comes off her bill when she visits.",
      }),
    };
  },

  async cancel_appointment(t, a) {
    const owned = await ownedBooking(t, a.reference, phoneFor(t, a.phone));
    const cancelled = await cancelBooking(adminClient(), { salonId: owned.salon_id, reference: owned.reference, reason: str(a.reason) || "Cancelled by guest via AI" });
    if (t.callId) await adminClient().from("calls").update({ outcome: "cancelled" }).eq("id", t.callId);
    // Online bookings may carry a deposit: refunded with enough notice, otherwise kept (brand rule).
    const deposit = await settleDepositOnCancel(owned.salon_id, owned.reference);
    return {
      success: true,
      message:
        deposit === "refunded" ? "Cancelled. Her deposit is being refunded in full to her original payment method (usually 5 to 7 working days)."
        : deposit === "kept" ? "Cancelled. Because it was cancelled late, the deposit is kept, as per the booking terms."
        : deposit === "card_returned" ? "Cancelled. The amount paid with her gift card is back on the card, ready to use again."
        : deposit === "card_kept" ? "Cancelled. Because it was cancelled late, the gift card amount used for it is kept, as per the booking terms."
        : "Cancelled.",
      ...(cancelled.includedPassedTo && { included_note: includedPassedNote(t, cancelled.includedPassedTo) }),
      ...(cancelled.includedUsedUp && {
        member_note: "Tell her, kindly: this was her included membership treatment, and because it was cancelled within the cancellation window it counts as used for that period.",
      }),
    };
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
    await logEvent(t.ctx.salon.id, "tool_error", { tool: name, channel: t.channel, message: errorText(e) });
    return { error: "Something went wrong on our side. Apologise briefly and offer to take a message for the team." };
  }
}

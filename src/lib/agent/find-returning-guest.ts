// Looks up a phone caller across every branch of the brand when the call starts (Vapi assistant-request).
// Must be fast and must never break a call: any error or slow database returns null and the call starts normally.
import "server-only";
import { adminClient } from "../supabase/admin";
import { memberFor } from "../payments/redemption";
import { countryCodeFor, normalizePhone, todayIn } from "../time";
import { displayName, type SalonContext } from "./context";
import { firstNameOf, type ReturningGuest } from "./returning-guest";
import { parseNotes, tidyNotes } from "./guest-memory";

const TIMEOUT_MS = 2000;
const EMPTY: ReturningGuest = { name: "", firstName: null, visits: 0, lastVisit: null, favourite: null, usualBranch: null, upcoming: null, member: null, lastCall: null, notes: [] };

export async function findReturningGuest(ctx: SalonContext, callerRaw: string | null | undefined): Promise<ReturningGuest | null> {
  if (!callerRaw) return null;
  const phone = normalizePhone(callerRaw, countryCodeFor(ctx.salon.currency));
  if (phone.length < 10) return null;
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), TIMEOUT_MS));
  return Promise.race([loadReturningGuest(ctx, phone, callerRaw).catch(() => null), timeout]);
}

/** The guest's profile by normalised phone (e.g. 919876543210), or null if this number has never booked. */
export async function loadReturningGuest(ctx: SalonContext, phone: string, callerRaw: string = phone): Promise<ReturningGuest | null> {
  const db = adminClient();
  const salonIds = [ctx.salon.id, ...ctx.branches.map((b) => b.id)];
  const [{ data: customers }, { data: memoryRows }] = await Promise.all([
    db.from("customers").select("id, name").in("salon_id", salonIds).eq("phone", phone),
    db.from("guest_memory").select("notes, opted_out").in("salon_id", salonIds).eq("phone", phone),
  ]);
  // A guest who asked not to be remembered gets no notes and no past-call summary (visits are still booking records).
  const optedOut = (memoryRows ?? []).some((r) => r.opted_out);
  const notes = optedOut ? [] : tidyNotes((memoryRows ?? []).flatMap((r) => parseNotes(r.notes)), todayIn(ctx.salon.timezone));
  if (!customers?.length) {
    // Never booked, but has talked to us before (an enquiry): remember the conversation, not a name.
    return notes.length ? { ...EMPTY, notes } : null;
  }
  const ids = customers.map((c) => c.id);
  const nowIso = new Date().toISOString();
  const fields = "reference, starts_at, salon_id, customer:customer_id (name), salon:salon_id (brand_name, area, name), staff:staff_id (name), service:service_id (name)" as const;
  // calls.customer_phone holds the raw caller ID (e.g. +919876543210), so match its common spellings
  const phoneSpellings = [...new Set([callerRaw, phone, `+${phone}`])];

  const [{ data: past }, { data: next }, member, { data: calls }] = await Promise.all([
    db.from("bookings").select(fields).in("customer_id", ids).in("status", ["confirmed", "completed"]).lt("starts_at", nowIso).order("starts_at", { ascending: false }).limit(10),
    db.from("bookings").select(fields).in("customer_id", ids).eq("status", "confirmed").gte("starts_at", nowIso).order("starts_at").limit(1),
    ctx.salon.brand_id ? memberFor(ctx.salon.brand_id, phone).catch(() => null) : Promise.resolve(null),
    db.from("calls").select("summary, ended_at").in("salon_id", salonIds).in("customer_phone", phoneSpellings).not("summary", "is", null).not("ended_at", "is", null).order("ended_at", { ascending: false }).limit(1),
  ]);

  const visits = past ?? [];
  const upcoming = next?.[0] ?? null;
  const branchName = (b: { salon: { brand_name: string | null; area: string | null; name: string } | null }) => (b.salon ? displayName(b.salon) : "");

  // The name on her most recent booking (past or upcoming) is the best guess for who usually calls from this number.
  const latest = [upcoming, visits[0]].filter(Boolean).sort((a, b) => Date.parse(b!.starts_at) - Date.parse(a!.starts_at))[0];
  const name = latest?.customer?.name ?? customers[0].name;

  const favourites = new Map<string, NonNullable<ReturningGuest["favourite"]>>();
  const branches = new Map<string, NonNullable<ReturningGuest["usualBranch"]> & { times: number }>();
  for (const v of visits) {
    const br = branches.get(v.salon_id) ?? { name: branchName(v), branchId: v.salon_id, times: 0 };
    br.times++;
    branches.set(v.salon_id, br);
    if (!v.staff?.name) continue;
    const k = `${v.salon_id}:${v.staff.name}`;
    const f = favourites.get(k) ?? { name: v.staff.name, branch: branchName(v), branchId: v.salon_id, times: 0 };
    f.times++;
    favourites.set(k, f);
  }
  const top = <T extends { times: number }>(m: Map<string, T>) => [...m.values()].sort((a, b) => b.times - a.times)[0] ?? null;
  const usual = top(branches);

  return {
    name,
    firstName: firstNameOf(name),
    visits: visits.length,
    lastVisit: visits[0] ? { at: visits[0].starts_at, treatment: visits[0].service?.name ?? null, branch: branchName(visits[0]), therapist: visits[0].staff?.name ?? null } : null,
    favourite: top(favourites),
    usualBranch: usual ? { name: usual.name, branchId: usual.branchId } : null,
    upcoming: upcoming ? { at: upcoming.starts_at, treatment: upcoming.service?.name ?? null, branch: branchName(upcoming), reference: upcoming.reference } : null,
    member: member ? { tier: member.tier, endsAt: member.endsAt } : null,
    lastCall: !optedOut && calls?.[0]?.summary && calls[0].ended_at ? { at: calls[0].ended_at, summary: calls[0].summary } : null,
    notes,
  };
}

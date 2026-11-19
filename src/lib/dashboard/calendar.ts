// Calendar data: a day across therapists, or a week for one therapist. Runs as the signed-in user (RLS).
import "server-only";
import type { Session } from "@/lib/session";
import { addDays, fmtTime, toMinutes, zonedToDate } from "@/lib/time";

export type CalBooking = {
  id: string; reference: string; column: string; start: number; end: number; startLabel: string;
  guest: string; guestId: string | null; service: string; source: string; status: string; price: number;
};
export type CalColumn = { id: string; title: string; subtitle: string; color: string; date: string; staffId: string; shifts: [number, number][] };
export type CalBlock = { column: string; start: number; end: number; label: string };

const mins = (iso: string, tz: string) => toMinutes(fmtTime(iso, tz));

export async function loadCalendar(s: Session, opts: { date: string; view: "day" | "week"; staffId?: string | null }) {
  const { supabase, salon } = s;
  const tz = salon.timezone;
  const hours = salon.business_hours as Record<string, [string, string][]>;
  const { data: staffRows } = await supabase.from("staff").select("id, name, title, color").eq("salon_id", salon.id).eq("active", true).order("sort_order");
  const staff = staffRows ?? [];

  // A stylist always sees their own week/day column only.
  const ownId = s.role === "stylist" ? s.staffId : null;
  const focus = ownId ?? (opts.view === "week" ? (opts.staffId && staff.some((x) => x.id === opts.staffId) ? opts.staffId : staff[0]?.id) : null);
  const dates = opts.view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(opts.date, i)) : [opts.date];
  const people = focus ? staff.filter((x) => x.id === focus) : staff;

  const from = zonedToDate(dates[0], "00:00", tz).toISOString();
  const to = zonedToDate(addDays(dates[dates.length - 1], 1), "00:00", tz).toISOString();
  const ids = people.map((p) => p.id);
  const [{ data: bookings }, { data: shifts }, { data: timeOff }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, reference, staff_id, starts_at, ends_at, status, source, price, customer:customer_id (id, name), service:service_id (name)")
      .eq("salon_id", salon.id)
      .in("staff_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
      .gte("starts_at", from)
      .lt("starts_at", to)
      .neq("status", "cancelled")
      .order("starts_at"),
    supabase.from("staff_hours").select("staff_id, weekday, start_time, end_time").eq("salon_id", salon.id).in("staff_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("time_off").select("staff_id, starts_at, ends_at, reason").eq("salon_id", salon.id).lt("starts_at", to).gt("ends_at", from),
  ]);

  const wd = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();
  const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const columns: CalColumn[] =
    opts.view === "week"
      ? dates.map((d) => {
          const p = people[0];
          return {
            id: d, date: d, staffId: p?.id ?? "", color: p?.color ?? "#9c7a47",
            title: `${DAY[wd(d)]} ${Number(d.slice(8))}`,
            subtitle: p?.name ?? "",
            shifts: (shifts ?? []).filter((h) => h.staff_id === p?.id && h.weekday === wd(d)).map((h) => [toMinutes(h.start_time), toMinutes(h.end_time)] as [number, number]),
          };
        })
      : people.map((p) => ({
          id: p.id, date: opts.date, staffId: p.id, color: p.color,
          title: p.name, subtitle: p.title ?? "",
          shifts: (shifts ?? []).filter((h) => h.staff_id === p.id && h.weekday === wd(opts.date)).map((h) => [toMinutes(h.start_time), toMinutes(h.end_time)] as [number, number]),
        }));

  const colFor = (staffId: string, iso: string) => (opts.view === "week" ? new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(iso)) : staffId);
  const events: CalBooking[] = (bookings ?? []).map((b) => ({
    id: b.id, reference: b.reference, column: colFor(b.staff_id, b.starts_at),
    start: mins(b.starts_at, tz), end: mins(b.ends_at, tz) || 24 * 60, startLabel: fmtTime(b.starts_at, tz),
    guest: b.customer?.name ?? "Guest", guestId: b.customer?.id ?? null, service: b.service?.name ?? "",
    source: b.source, status: b.status, price: Number(b.price),
  }));

  const blocks: CalBlock[] = [];
  for (const t of timeOff ?? []) {
    for (const c of columns) {
      if (t.staff_id && t.staff_id !== c.staffId) continue;
      const dayStart = zonedToDate(c.date, "00:00", tz).getTime();
      const dayEnd = dayStart + 24 * 3600_000;
      const a = Math.max(Date.parse(t.starts_at), dayStart);
      const b = Math.min(Date.parse(t.ends_at), dayEnd);
      if (b > a) blocks.push({ column: c.id, start: (a - dayStart) / 60000, end: (b - dayStart) / 60000, label: t.reason || "Unavailable" });
    }
  }

  // Visible hours: the studio's opening hours across the shown days (fallback 9–21).
  const open = dates.flatMap((d) => (hours[String(wd(d))] ?? []).flat()).map(toMinutes);
  const startMin = Math.floor((open.length ? Math.min(...open) : 9 * 60) / 60) * 60;
  const endMin = Math.ceil((open.length ? Math.max(...open) : 21 * 60) / 60) * 60;

  return { columns, events, blocks, startMin, endMin, staff: staff.map((x) => ({ id: x.id, name: x.name })), focus, interval: salon.slot_interval_minutes };
}

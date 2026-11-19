// Numbers for the dashboard overview. Runs as the signed-in user (row level security scopes everything).
import "server-only";
import type { Session } from "@/lib/session";
import { addDays, toMinutes, todayIn, zonedToDate } from "@/lib/time";
import { formatInTimeZone } from "date-fns-tz";

export const SOURCES = ["phone", "web", "staff"] as const;
export type Source = (typeof SOURCES)[number];

const minutesBetween = (a: string, b: string) => Math.max(0, (Date.parse(b) - Date.parse(a)) / 60000);

export async function loadOverview(s: Session) {
  const { supabase, salon, scopeIds, staffId } = s;
  const tz = salon.timezone;
  const today = todayIn(tz);
  const dayStart = zonedToDate(today, "00:00", tz).toISOString();
  const dayEnd = zonedToDate(addDays(today, 1), "00:00", tz).toISOString();
  const since14 = zonedToDate(addDays(today, -13), "00:00", tz).toISOString();
  const since30 = zonedToDate(addDays(today, -29), "00:00", tz).toISOString();
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();

  let todayQ = supabase
    .from("bookings")
    .select("id, reference, salon_id, staff_id, starts_at, ends_at, status, source, price, customer:customer_id (id, name), service:service_id (name), staff:staff_id (name)")
    .in("salon_id", scopeIds)
    .gte("starts_at", dayStart)
    .lt("starts_at", dayEnd)
    .neq("status", "cancelled")
    .order("starts_at");
  if (staffId) todayQ = todayQ.eq("staff_id", staffId);

  const [{ data: todays }, { data: made }, { data: recent }, { data: hours }, { data: studios }, leads, { count: openCallbacks }, { data: chats }] = await Promise.all([
    todayQ,
    // bookings MADE in the last 14 days, by channel
    supabase.from("bookings").select("created_at, source").in("salon_id", scopeIds).gte("created_at", since14),
    // appointments in the last 30 days, for top treatments
    supabase.from("bookings").select("service:service_id (name)").in("salon_id", scopeIds).gte("starts_at", since30).lt("starts_at", dayEnd).neq("status", "cancelled"),
    supabase.from("staff_hours").select("salon_id, staff_id, start_time, end_time, staff:staff_id!inner (active)").in("salon_id", scopeIds).eq("weekday", weekday).eq("staff.active", true),
    supabase.from("salons").select("id, area, name").in("id", scopeIds),
    salon.brand_id
      ? supabase.from("leads").select("id, name, kind, message, status, created_at").eq("brand_id", salon.brand_id).order("created_at", { ascending: false }).limit(5)
      : Promise.resolve({ data: [] as { id: string; name: string; kind: string; message: string; status: string; created_at: string }[] }),
    supabase.from("callbacks").select("*", { count: "exact", head: true }).in("salon_id", scopeIds).eq("status", "open"),
    supabase.from("calls").select("channel, outcome").in("salon_id", scopeIds).gte("created_at", since30),
  ]);

  const list = todays ?? [];
  const bookedValue = list.reduce((sum, b) => sum + Number(b.price), 0);
  const byAi = list.filter((b) => b.source !== "staff").length;
  const now = Date.now();
  const upcoming = list.filter((b) => Date.parse(b.ends_at) > now && b.status === "confirmed").slice(0, 6);

  // Occupancy today: booked treatment minutes ÷ minutes therapists are rostered (per studio).
  const occupancy = (studios ?? [])
    .map((st) => {
      const rostered = (hours ?? []).filter((h) => h.salon_id === st.id).reduce((m, h) => m + (toMinutes(h.end_time) - toMinutes(h.start_time)), 0);
      const booked = list.filter((b) => b.salon_id === st.id).reduce((m, b) => m + minutesBetween(b.starts_at, b.ends_at), 0);
      return { id: st.id, studio: st.area ?? st.name, booked, rostered, pct: rostered ? Math.min(100, Math.round((booked / rostered) * 100)) : 0 };
    })
    .sort((a, b) => b.pct - a.pct || a.studio.localeCompare(b.studio));
  const totalRostered = occupancy.reduce((m, o) => m + o.rostered, 0);
  const totalBooked = occupancy.reduce((m, o) => m + o.booked, 0);

  // Bookings made per day, by channel (14 days).
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const series = days.map((d) => {
    const row: Record<Source, number> & { date: string; label: string } = { date: d, label: formatInTimeZone(new Date(`${d}T12:00:00Z`), "UTC", "d MMM"), phone: 0, web: 0, staff: 0 };
    return row;
  });
  for (const b of made ?? []) {
    const d = formatInTimeZone(new Date(b.created_at), tz, "yyyy-MM-dd");
    const row = series.find((r) => r.date === d);
    if (row) row[b.source as Source] += 1;
  }

  // Top treatments (30 days).
  const counts = new Map<string, number>();
  for (const b of recent ?? []) {
    const n = b.service?.name;
    if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  const topTreatments = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count }));

  // Website chats → bookings (30 days).
  const webChats = (chats ?? []).filter((c) => c.channel === "web");
  const chatBooked = webChats.filter((c) => c.outcome === "booked").length;

  return {
    today,
    tz,
    appointments: list.length,
    bookedValue,
    byAi,
    occupancyPct: totalRostered ? Math.round((totalBooked / totalRostered) * 100) : 0,
    occupancy,
    upcoming: upcoming.map((b) => ({
      id: b.id,
      reference: b.reference,
      time: formatInTimeZone(new Date(b.starts_at), tz, "h:mm a"),
      guest: b.customer?.name ?? "Guest",
      guestId: b.customer?.id ?? null,
      service: b.service?.name ?? "",
      staff: b.staff?.name ?? "",
      source: b.source,
      studio: (studios ?? []).find((x) => x.id === b.salon_id)?.area ?? "",
    })),
    series,
    topTreatments,
    leads: leads.data ?? [],
    openCallbacks: openCallbacks ?? 0,
    chats: { total: webChats.length, booked: chatBooked, calls: (chats ?? []).length - webChats.length },
  };
}

import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { requireSalon } from "@/lib/session";
import { addDays, isDate, todayIn, toMinutes, zonedToDate, fmtTime } from "@/lib/time";
import { ButtonLink, Card, Stat, money, Badge } from "@/components/ui";

const PX_PER_MIN = 1.3;

export default async function Today({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { salon, supabase } = await requireSalon();
  const tz = salon.timezone;
  const sp = await searchParams;
  const date = isDate(sp.date) ? sp.date : todayIn(tz);
  const dayStart = zonedToDate(date, "00:00", tz).toISOString();
  const dayEnd = zonedToDate(addDays(date, 1), "00:00", tz).toISOString();
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();

  const [{ data: staff }, { data: bookings }, { data: timeOff }, { data: hours }, { count: openCallbacks }] = await Promise.all([
    supabase.from("staff").select("id, name, title, color").eq("salon_id", salon.id).eq("active", true).order("sort_order"),
    supabase
      .from("bookings")
      .select("id, reference, starts_at, ends_at, status, source, price, notes, staff_id, customer:customer_id (name, phone), service:service_id (name)")
      .eq("salon_id", salon.id)
      .gte("starts_at", dayStart)
      .lt("starts_at", dayEnd)
      .neq("status", "cancelled")
      .order("starts_at"),
    supabase.from("time_off").select("staff_id, starts_at, ends_at, reason").eq("salon_id", salon.id).lt("starts_at", dayEnd).gt("ends_at", dayStart),
    supabase.from("staff_hours").select("staff_id, start_time, end_time").eq("salon_id", salon.id).eq("weekday", weekday),
    supabase.from("callbacks").select("*", { count: "exact", head: true }).eq("salon_id", salon.id).eq("status", "open"),
  ]);

  const open = ((salon.business_hours as Record<string, [string, string][]>)[String(weekday)] ?? []).flat();
  const startMin = open.length ? Math.min(...open.map(toMinutes)) : 9 * 60;
  const endMin = open.length ? Math.max(...open.map(toMinutes)) : 21 * 60;
  const y = (iso: string) => {
    const m = toMinutes(fmtTime(iso, tz));
    return Math.max(0, (m - startMin) * PX_PER_MIN);
  };
  const h = (a: string, b: string) => Math.max(18, ((Date.parse(b) - Date.parse(a)) / 60000) * PX_PER_MIN);

  const list = bookings ?? [];
  const revenue = list.reduce((s, b) => s + Number(b.price), 0);
  const byAi = list.filter((b) => b.source !== "staff").length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold">{formatInTimeZone(zonedToDate(date, "12:00", tz), tz, "EEEE, d MMMM")}</h1>
          <p className="mt-1 text-sm text-muted">{open.length ? `Open ${open[0]}–${open[open.length - 1]}` : "Studio closed"}</p>
        </div>
        <div className="flex items-center gap-2">
          <ButtonLink variant="outline" href={`/dashboard?date=${addDays(date, -1)}`}>←</ButtonLink>
          <ButtonLink variant="outline" href="/dashboard">Today</ButtonLink>
          <ButtonLink variant="outline" href={`/dashboard?date=${addDays(date, 1)}`}>→</ButtonLink>
          <ButtonLink href={`/dashboard/bookings/new?date=${date}`}>+ New booking</ButtonLink>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Appointments" value={list.length} />
        <Stat label="Booked value" value={money(revenue, salon.currency)} />
        <Stat label="Booked by AI" value={byAi} hint={list.length ? `${Math.round((byAi / list.length) * 100)}% of the day` : undefined} />
        <Link href="/dashboard/callbacks"><Stat label="Call-backs waiting" value={openCallbacks ?? 0} /></Link>
      </div>

      <Card className="overflow-x-auto p-0">
        <div className="flex min-w-[640px]">
          {/* time gutter */}
          <div className="w-14 shrink-0 border-r border-line pt-12">
            <div className="relative" style={{ height: (endMin - startMin) * PX_PER_MIN }}>
              {Array.from({ length: Math.floor((endMin - startMin) / 60) + 1 }, (_, i) => (
                <span key={i} className="absolute right-2 -translate-y-1/2 text-[11px] text-muted" style={{ top: i * 60 * PX_PER_MIN }}>
                  {String(Math.floor(startMin / 60) + i).padStart(2, "0")}:00
                </span>
              ))}
            </div>
          </div>
          {(staff ?? []).map((st) => {
            const shifts = (hours ?? []).filter((x) => x.staff_id === st.id);
            return (
              <div key={st.id} className="min-w-44 flex-1 border-r border-line last:border-r-0">
                <div className="flex h-12 items-center gap-2 border-b border-line px-3">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: st.color }} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{st.name}</p>
                    <p className="truncate text-[11px] text-muted">{shifts.length ? shifts.map((s) => `${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`).join(", ") : "Off today"}</p>
                  </div>
                </div>
                <div className="relative bg-[repeating-linear-gradient(to_bottom,transparent,transparent_77px,var(--color-line)_78px)]" style={{ height: (endMin - startMin) * PX_PER_MIN }}>
                  {!shifts.length && <div className="absolute inset-0 bg-cream/70" />}
                  {(timeOff ?? [])
                    .filter((t) => t.staff_id === st.id || !t.staff_id)
                    .map((t, i) => (
                      <div key={i} className="absolute inset-x-1 rounded-md bg-cream px-2 py-1 text-[11px] text-muted" style={{ top: y(t.starts_at < dayStart ? dayStart : t.starts_at), height: h(t.starts_at < dayStart ? dayStart : t.starts_at, t.ends_at > dayEnd ? dayEnd : t.ends_at) }}>
                        {t.reason || "Unavailable"}
                      </div>
                    ))}
                  {list
                    .filter((b) => b.staff_id === st.id)
                    .map((b) => (
                      <Link
                        key={b.id}
                        href={`/dashboard/bookings?ref=${b.reference}`}
                        className="absolute inset-x-1 overflow-hidden rounded-md border-l-4 bg-white px-2 py-1 text-xs shadow-sm ring-1 ring-line hover:ring-gold"
                        style={{ top: y(b.starts_at), height: h(b.starts_at, b.ends_at), borderLeftColor: st.color }}
                      >
                        <p className="truncate font-medium">{fmtTime(b.starts_at, tz)} · {b.customer?.name}</p>
                        <p className="truncate text-muted">{b.service?.name}</p>
                        <div className="mt-0.5 flex gap-1">
                          {b.source !== "staff" && <Badge tone={b.source}>{`AI ${b.source}`}</Badge>}
                          {b.status !== "confirmed" && <Badge>{b.status}</Badge>}
                        </div>
                      </Link>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

import { Suspense } from "react";
import { formatInTimeZone } from "date-fns-tz";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import { requireArea } from "@/lib/session";
import { Badge, Card, Empty, PageHeader, Stat, money } from "@/components/dashboard-ui";

/** Runs at request time (dynamic page). */
function isPast(iso: string | null) {
  return !!iso && Date.parse(iso) < Date.now();
}

async function Members({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const s = await requireArea("members");
  const { q: raw } = await searchParams;
  const q = (raw ?? "").trim().slice(0, 60);
  const brandId = s.salon.brand_id ?? "00000000-0000-0000-0000-000000000000";
  const tz = s.salon.timezone;

  let query = s.supabase
    .from("membership_purchases")
    .select("id, tier_name, price, period, name, phone, email, status, starts_at, ends_at, created_at, salon:salon_id (area)")
    .eq("brand_id", brandId)
    .in("status", ["active", "expired", "cancelled"])
    .order("created_at", { ascending: false })
    .limit(200);
  if (q) {
    const digits = q.replace(/\D/g, "");
    query = digits.length >= 4 ? query.ilike("phone", `%${digits}%`) : query.ilike("name", `%${q.replace(/[%_,()]/g, "")}%`);
  }
  const { data } = await query;
  const rows = (data ?? []).map((m) => ({ ...m, state: m.status === "active" && isPast(m.ends_at) ? "expired" : m.status }));
  const active = rows.filter((m) => m.state === "active");
  const value = active.reduce((t, m) => t + Number(m.price), 0);

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Brand-wide" title="Members" subtitle="Guests with a membership bought online. Search by mobile number at the desk to check a guest's membership." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Active members" value={active.length} />
        <Stat label="Active membership value" value={money(value, s.salon.currency)} />
      </div>
      <form role="search" className="flex flex-wrap gap-3">
        <label htmlFor="q" className="sr-only">Search members</label>
        <input id="q" name="q" defaultValue={q} placeholder="Search by name or mobile number" className="field max-w-sm" />
        <button className="min-h-10 rounded-full bg-charcoal px-4 text-sm text-ivory">Search</button>
      </form>
      <Card className="overflow-x-auto p-0">
        {rows.length ? (
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[0.75rem] text-stone">
                <th className="px-5 py-3 font-medium">Member</th>
                <th className="px-3 py-3 font-medium">Membership</th>
                <th className="px-3 py-3 font-medium">Valid</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="px-5 py-3">{m.name}<p className="text-xs text-stone tabular-nums">+{m.phone}{m.email ? ` · ${m.email}` : ""}</p></td>
                  <td className="px-3 py-3">{m.tier_name}<p className="text-xs text-stone">{money(m.price, s.salon.currency)} a {m.period}{m.salon?.area ? ` · home: ${m.salon.area}` : ""}</p></td>
                  <td className="px-3 py-3 text-stone">
                    {m.starts_at && m.ends_at ? `${formatInTimeZone(new Date(m.starts_at), tz, "d MMM yyyy")} – ${formatInTimeZone(new Date(m.ends_at), tz, "d MMM yyyy")}` : "—"}
                  </td>
                  <td className="px-5 py-3"><Badge tone={m.state === "active" ? "confirmed" : m.state === "cancelled" ? "cancelled" : "done"}>{m.state}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>{q ? "No members match that search." : "No members yet. Memberships bought on the website appear here."}</Empty>
        )}
      </Card>
    </div>
  );
}

export default function Page(props: Parameters<typeof Members>[0]) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <Members {...props} />
    </Suspense>
  );
}

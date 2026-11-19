import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import { formatInTimeZone } from "date-fns-tz";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import { requireArea } from "@/lib/session";
import { Badge, Card, Empty, PageHeader, money } from "@/components/dashboard-ui";

type SP = { q?: string; sort?: string };
const SORTS = { recent: "Last visit", visits: "Most visits", spend: "Highest spend", name: "Name" } as const;

async function Guests({ searchParams }: { searchParams: Promise<SP> }) {
  const s = await requireArea("guests");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 60);
  const sort = (sp.sort && sp.sort in SORTS ? sp.sort : "recent") as keyof typeof SORTS;
  const tz = s.salon.timezone;

  // A therapist sees only the guests they have treated or will treat.
  let onlyIds: string[] | null = null;
  if (s.role === "stylist" && s.staffId) {
    const { data } = await s.supabase.from("bookings").select("customer_id").eq("staff_id", s.staffId).limit(2000);
    onlyIds = [...new Set((data ?? []).map((b) => b.customer_id))];
  }

  let query = s.supabase.from("guest_summary").select("*").in("salon_id", s.scopeIds);
  if (onlyIds) query = query.in("id", onlyIds.length ? onlyIds : ["00000000-0000-0000-0000-000000000000"]);
  if (q) {
    const digits = q.replace(/\D/g, "");
    query = digits.length >= 4 ? query.ilike("phone", `%${digits}%`) : query.ilike("name", `%${q.replace(/[%_,()]/g, "")}%`);
  }
  query =
    sort === "visits" ? query.order("visits", { ascending: false })
    : sort === "spend" ? query.order("spend", { ascending: false })
    : sort === "name" ? query.order("name")
    : query.order("last_visit", { ascending: false, nullsFirst: false });
  const { data: guests } = await query.limit(100);
  const studioName = new Map(s.salons.map((x) => [x.id, x.area ?? x.name]));
  const href = (patch: Partial<SP>) => `/dashboard/guests?${new URLSearchParams({ ...(q && { q }), sort, ...patch } as Record<string, string>)}` as Route;

  return (
    <div>
      <PageHeader eyebrow={s.isAll ? `All ${s.scopeIds.length} studios` : (s.salon.area ?? "")} title="Guests" subtitle="Everyone who has booked, called or chatted, with their visits and preferences." />
      <form className="mb-5 flex flex-wrap items-center gap-3" role="search">
        <label htmlFor="q" className="sr-only">Search guests</label>
        <input id="q" name="q" defaultValue={q} placeholder="Search by name or mobile number" className="field max-w-sm" />
        <input type="hidden" name="sort" value={sort} />
        <button className="min-h-10 rounded-full bg-charcoal px-4 text-sm text-ivory">Search</button>
        <div className="flex flex-wrap gap-1.5 text-sm" role="group" aria-label="Sort">
          {Object.entries(SORTS).map(([k, label]) => (
            <Link key={k} href={href({ sort: k })} aria-current={sort === k ? "true" : undefined} className={`rounded-full px-3 py-1.5 ${sort === k ? "bg-linen text-charcoal" : "text-stone hover:text-charcoal"}`}>
              {label}
            </Link>
          ))}
        </div>
      </form>

      <Card className="overflow-x-auto p-0">
        {guests?.length ? (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[0.75rem] text-stone">
                <th className="px-5 py-3 font-medium">Guest</th>
                {s.isAll && <th className="px-3 py-3 font-medium">Studio</th>}
                <th className="px-3 py-3 text-right font-medium">Visits</th>
                <th className="px-3 py-3 text-right font-medium">Spend</th>
                <th className="px-3 py-3 font-medium">Last visit</th>
                <th className="px-5 py-3 font-medium">Next</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {guests.map((g) => (
                <tr key={g.id} className="hover:bg-linen/40">
                  <td className="px-5 py-3">
                    <Link href={`/dashboard/guests/${g.id}` as Route} className="font-medium hover:underline">{g.name}</Link>
                    <p className="text-xs text-stone tabular-nums">+{g.phone}</p>
                    {g.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {g.tags.slice(0, 3).map((t) => <Badge key={t}>{t}</Badge>)}
                      </div>
                    )}
                  </td>
                  {s.isAll && <td className="px-3 py-3 text-stone">{studioName.get(g.salon_id)}</td>}
                  <td className="px-3 py-3 text-right tabular-nums">{g.visits}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{money(g.spend, s.salon.currency)}</td>
                  <td className="px-3 py-3 text-stone">{g.last_visit ? formatInTimeZone(new Date(g.last_visit), tz, "d MMM yyyy") : "New guest"}</td>
                  <td className="px-5 py-3 text-stone">{g.next_visit ? formatInTimeZone(new Date(g.next_visit), tz, "d MMM, h:mm a") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>{q ? "No guests match that search." : "No guests yet. They appear here after their first booking or call."}</Empty>
        )}
      </Card>
      {guests?.length === 100 && <p className="mt-3 text-xs text-stone">Showing the first 100. Search to narrow down.</p>}
    </div>
  );
}

export default function Page(props: Parameters<typeof Guests>[0]) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <Guests {...props} />
    </Suspense>
  );
}

import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import { formatInTimeZone } from "date-fns-tz";
import { Search, Users } from "lucide-react";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import { requireArea } from "@/lib/session";
import {
  Button,
  EmptyState,
  FilterBar,
  Input,
  PageHeader,
  StatusBadge,
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  money,
  SegmentedNav,
} from "@/components/admin/kit";

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
    <div className="grid gap-6">
      <PageHeader eyebrow={s.isAll ? `All ${s.scopeIds.length} studios` : (s.salon.area ?? "")} title="Guests" description="Everyone who has booked, called or chatted, with their visits and preferences." />
      <div>
        <FilterBar role="search" className="items-center">
          <label htmlFor="q" className="sr-only">Search guests</label>
          <Input id="q" name="q" defaultValue={q} placeholder="Search by name or mobile number" className="max-w-sm" />
          <input type="hidden" name="sort" value={sort} />
          <Button type="submit">
            <Search aria-hidden /> Search
          </Button>
          <SegmentedNav label="Sort" items={Object.entries(SORTS).map(([k, label]) => ({ href: href({ sort: k }), label, active: sort === k }))} />
        </FilterBar>

        <TableCard>
          {guests?.length ? (
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Guest</TableHead>
                  {s.isAll && <TableHead>Studio</TableHead>}
                  <TableHead className="text-right">Visits</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead>Last visit</TableHead>
                  <TableHead className="pr-4">Next</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guests.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="pl-4">
                      <Link href={`/dashboard/guests/${g.id}` as Route} className="font-medium hover:underline">{g.name}</Link>
                      <p className="tabular text-xs text-muted-foreground">+{g.phone}</p>
                      {g.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {g.tags.slice(0, 3).map((t) => <StatusBadge key={t} tone="neutral" className="normal-case">{t}</StatusBadge>)}
                        </div>
                      )}
                    </TableCell>
                    {s.isAll && <TableCell className="text-muted-foreground">{studioName.get(g.salon_id)}</TableCell>}
                    <TableCell className="tabular text-right">{g.visits}</TableCell>
                    <TableCell className="tabular text-right">{money(g.spend, s.salon.currency)}</TableCell>
                    <TableCell className="text-muted-foreground">{g.last_visit ? formatInTimeZone(new Date(g.last_visit), tz, "d MMM yyyy") : "New guest"}</TableCell>
                    <TableCell className="pr-4 text-muted-foreground">{g.next_visit ? formatInTimeZone(new Date(g.next_visit), tz, "d MMM, h:mm a") : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={Users}
              title={q ? "No guests match that search" : "No guests yet"}
              description={q ? "Try a different name or mobile number." : "They appear here after their first booking or call."}
            />
          )}
        </TableCard>
        {guests?.length === 100 && <p className="mt-3 text-xs text-muted-foreground">Showing the first 100. Search to narrow down.</p>}
      </div>
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

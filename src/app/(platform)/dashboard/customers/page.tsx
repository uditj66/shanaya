import { requireSalon } from "@/lib/session";
import { fmtHuman } from "@/lib/time";
import { Card, Empty, Input, PageHeader, money } from "@/components/dashboard-ui";

export default async function Customers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { salon, supabase } = await requireSalon();
  const { q } = await searchParams;
  let query = supabase
    .from("customers")
    .select("id, name, phone, email, created_at, bookings (starts_at, status, price)")
    .eq("salon_id", salon.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (q) query = /\d{3,}/.test(q) ? query.ilike("phone", `%${q.replace(/\D/g, "")}%`) : query.ilike("name", `%${q}%`);
  const { data } = await query;

  return (
    <div>
      <PageHeader title="Guests" subtitle="Everyone who has booked, with visit history and lifetime value." />
      <form className="mb-4"><Input name="q" defaultValue={q} placeholder="Search name or phone" className="max-w-xs" /></form>
      <Card className="overflow-x-auto p-0">
        {!data?.length ? <Empty>No guests yet.</Empty> : (
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <tr>{["Guest", "Phone", "Visits", "Lifetime value", "Last / next visit"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {data.map((c) => {
                const done = c.bookings.filter((b) => b.status !== "cancelled");
                const last = [...done].sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];
                return (
                  <tr key={c.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-medium">{c.name}<div className="text-xs font-normal text-muted">{c.email}</div></td>
                    <td className="px-4 py-3">+{c.phone}</td>
                    <td className="px-4 py-3">{done.length}</td>
                    <td className="px-4 py-3">{money(done.reduce((s, b) => s + Number(b.price), 0), salon.currency)}</td>
                    <td className="px-4 py-3 text-muted">{last ? fmtHuman(last.starts_at, salon.timezone) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

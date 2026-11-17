import { requireSalon } from "@/lib/session";
import { fmtHuman } from "@/lib/time";
import { setBookingStatus } from "../actions";
import { Badge, ButtonLink, Card, Empty, Input, PageHeader, Select, money } from "@/components/ui";

export default async function Bookings({ searchParams }: { searchParams: Promise<{ ref?: string; status?: string; q?: string; when?: string }> }) {
  const { salon, supabase } = await requireSalon();
  const sp = await searchParams;
  const when = sp.when ?? "upcoming";

  let query = supabase
    .from("bookings")
    .select("id, reference, starts_at, status, source, price, notes, customer:customer_id (name, phone), service:service_id (name), staff:staff_id (name)")
    .eq("salon_id", salon.id)
    .limit(200);
  if (sp.ref) query = query.eq("reference", sp.ref.toUpperCase());
  else if (when === "upcoming") query = query.gte("starts_at", new Date().toISOString()).order("starts_at");
  else query = query.lt("starts_at", new Date().toISOString()).order("starts_at", { ascending: false });
  if (sp.status) query = query.eq("status", sp.status as "confirmed");
  const { data } = await query;

  const q = (sp.q ?? "").toLowerCase();
  const rows = (data ?? []).filter((b) => !q || b.customer?.name.toLowerCase().includes(q) || b.customer?.phone.includes(q.replace(/\D/g, "") || "§"));

  return (
    <div>
      <PageHeader title="Bookings" subtitle="Every appointment, whoever booked it: phone AI, website AI or your team." action={<ButtonLink href="/dashboard/bookings/new">+ New booking</ButtonLink>} />
      <form className="mb-4 flex flex-wrap gap-2">
        <Select name="when" defaultValue={when} className="w-auto"><option value="upcoming">Upcoming</option><option value="past">Past</option></Select>
        <Select name="status" defaultValue={sp.status ?? ""} className="w-auto">
          <option value="">All statuses</option>
          {["confirmed", "completed", "cancelled", "no_show"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </Select>
        <Input name="q" defaultValue={sp.q} placeholder="Search guest name or phone" className="w-64" />
        <button className="rounded-lg border border-line bg-white px-4 text-sm">Filter</button>
      </form>
      <Card className="overflow-x-auto p-0">
        {!rows.length ? <Empty>No bookings found.</Empty> : (
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <tr>{["When", "Guest", "Service", "Therapist", "Value", "Source", "Status", ""].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="border-b border-line last:border-0 align-top">
                  <td className="px-4 py-3 whitespace-nowrap">{fmtHuman(b.starts_at, salon.timezone)}<div className="text-xs text-muted">#{b.reference}</div></td>
                  <td className="px-4 py-3">{b.customer?.name}<div className="text-xs text-muted">+{b.customer?.phone}</div></td>
                  <td className="px-4 py-3">{b.service?.name}{b.notes && <div className="max-w-56 text-xs text-gold-dark">Note: {b.notes}</div>}</td>
                  <td className="px-4 py-3">{b.staff?.name}</td>
                  <td className="px-4 py-3">{money(b.price, salon.currency)}</td>
                  <td className="px-4 py-3"><Badge tone={b.source}>{b.source === "staff" ? "staff" : `AI ${b.source}`}</Badge></td>
                  <td className="px-4 py-3"><Badge>{b.status}</Badge></td>
                  <td className="px-4 py-3">
                    {b.status === "confirmed" && (
                      <form action={setBookingStatus} className="flex gap-1">
                        <input type="hidden" name="reference" value={b.reference} />
                        <button name="status" value="completed" className="rounded px-2 py-1 text-xs hover:bg-cream">Done</button>
                        <button name="status" value="no_show" className="rounded px-2 py-1 text-xs hover:bg-cream">No-show</button>
                        <button name="status" value="cancelled" className="rounded px-2 py-1 text-xs text-danger hover:bg-danger/10">Cancel</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

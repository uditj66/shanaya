import { requireSalon } from "@/lib/session";
import { fmtHuman } from "@/lib/time";
import { resolveCallback } from "../actions";
import { Badge, Button, Card, Empty, PageHeader } from "@/components/dashboard-ui";

export default async function Callbacks() {
  const { salon, supabase } = await requireSalon();
  const { data } = await supabase
    .from("callbacks")
    .select("id, customer_name, phone, reason, status, created_at, resolved_at")
    .eq("salon_id", salon.id)
    .order("status")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Call-backs" subtitle="Requests the AI passed to your team: complaints, skin questions, custom quotes." />
      <div className="space-y-3">
        {!data?.length && <Card><Empty>Nothing waiting. 🎉</Empty></Card>}
        {data?.map((c) => (
          <Card key={c.id} className={c.status === "done" ? "opacity-60" : ""}>
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge>{c.status}</Badge>
                  <span className="font-medium">{c.customer_name || "Guest"}</span>
                  {c.phone && <a className="text-sm text-gold-dark underline" href={`tel:+${c.phone}`}>+{c.phone}</a>}
                </div>
                <p className="mt-2 text-sm">{c.reason}</p>
                <p className="mt-1 text-xs text-muted">{fmtHuman(c.created_at, salon.timezone)}</p>
              </div>
              {c.status === "open" && (
                <form action={resolveCallback}>
                  <input type="hidden" name="id" value={c.id} />
                  <Button variant="outline">Mark done</Button>
                </form>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

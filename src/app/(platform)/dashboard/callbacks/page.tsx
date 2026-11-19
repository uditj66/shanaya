import { Suspense } from "react";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import { requireSalon } from "@/lib/session";
import { fmtHuman } from "@/lib/time";
import { resolveCallback } from "../actions";
import { Check, PhoneCall } from "lucide-react";
import { Button, Card, EmptyState, PageHeader, StatusBadge, cn } from "@/components/admin/kit";

async function Callbacks() {
  const { salon, supabase } = await requireSalon();
  const { data } = await supabase
    .from("callbacks")
    .select("id, customer_name, phone, reason, status, created_at, resolved_at")
    .eq("salon_id", salon.id)
    .order("status")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="grid max-w-3xl gap-6">
      <PageHeader title="Call-backs" description="Requests the AI passed to your team: complaints, skin questions, custom quotes." />
      <div className="grid gap-3">
        {!data?.length && (
          <Card>
            <EmptyState icon={PhoneCall} title="Nothing waiting" description="New call-back requests from Shanaya appear here." />
          </Card>
        )}
        {data?.map((c) => (
          <Card key={c.id} className={cn("gap-3 p-5", c.status === "done" && "opacity-60")}>
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={c.status} />
                  <span className="font-medium">{c.customer_name || "Guest"}</span>
                  {c.phone && (
                    <a className="tabular text-sm text-primary underline-offset-4 hover:underline" href={`tel:+${c.phone}`}>
                      +{c.phone}
                    </a>
                  )}
                </div>
                <p className="mt-2 text-sm">{c.reason}</p>
                <p className="mt-1 text-xs text-muted-foreground">{fmtHuman(c.created_at, salon.timezone)}</p>
              </div>
              {c.status === "open" && (
                <form action={resolveCallback}>
                  <input type="hidden" name="id" value={c.id} />
                  <Button variant="outline" size="sm">
                    <Check aria-hidden /> Mark done
                  </Button>
                </form>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// The page's live data streams inside its own Suspense boundary (instant navigation; Cache Components best practice).
export default function Page() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <Callbacks />
    </Suspense>
  );
}

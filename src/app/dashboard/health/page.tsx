import { requireSalon } from "@/lib/session";
import { fmtHuman, hoursAgo } from "@/lib/time";
import { Badge, Card, Empty, PageHeader, Stat } from "@/components/ui";

const LABEL: Record<string, string> = {
  tool_error: "Booking tool failed",
  call_error: "Call ended with an error",
  webhook_auth: "Rejected unsigned request",
  cap_reached: "Daily limit reached",
};

export default async function Health() {
  const { salon, supabase } = await requireSalon();
  const since = hoursAgo(24);
  const [{ data: events }, { count: last24 }] = await Promise.all([
    supabase.from("agent_events").select("id, kind, detail, created_at").eq("salon_id", salon.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("agent_events").select("*", { count: "exact", head: true }).eq("salon_id", salon.id).gte("created_at", since),
  ]);

  return (
    <div className="max-w-4xl">
      <PageHeader title="Health" subtitle="Problems Shanaya ran into at this branch, so you can fix them before guests notice." />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Issues (last 24 h)" value={last24 ?? 0} />
        <Stat label="Website voice calls / day" value={salon.daily_web_voice_cap} hint="daily limit" />
        <Stat label="Chat messages / day" value={salon.daily_chat_cap} hint="daily limit" />
      </div>
      <Card className="p-0">
        {!events?.length ? (
          <Empty>All good: no problems recorded. ✨</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {events.map((e) => (
              <li key={e.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={e.kind === "cap_reached" ? "open" : "cancelled"}>{LABEL[e.kind] ?? e.kind}</Badge>
                  <span className="ml-auto text-xs text-muted">{fmtHuman(e.created_at, salon.timezone)}</span>
                </div>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-cream p-2 text-xs whitespace-pre-wrap">{JSON.stringify(e.detail, null, 2)}</pre>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

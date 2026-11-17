import { requireSalon } from "@/lib/session";
import { fmtHuman } from "@/lib/time";
import { healthEvents } from "@/lib/health";
import { Badge, Card, Empty, PageHeader, Stat } from "@/components/ui";

const LABEL: Record<string, string> = {
  tool_error: "Booking tool failed",
  call_error: "Call ended with an error",
  webhook_auth: "Rejected request",
  cap_reached: "Daily limit reached",
};

export default async function Health() {
  const { salon, supabase, role } = await requireSalon();
  const { events, recentProblems } = await healthEvents(supabase, salon.id, role);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Health"
        subtitle={`Problems Shanaya ran into at this branch${role === "owner" ? " (plus chain-wide ones, marked “All branches”)" : ""}, so you can fix them before guests notice.`}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Problems (last 24 h)" value={recentProblems} hint="daily limits not counted" />
        <Stat label="Website voice calls / day" value={salon.daily_web_voice_cap} hint="daily limit" />
        <Stat label="Chat messages / day" value={salon.daily_chat_cap} hint="daily limit" />
      </div>
      <Card className="p-0">
        {!events.length ? (
          <Empty>All good: no problems recorded. ✨</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {events.map((e) => (
              <li key={e.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={e.kind === "cap_reached" ? "open" : "cancelled"}>{LABEL[e.kind] ?? e.kind}</Badge>
                  {!e.salon_id && <Badge tone="staff">All branches</Badge>}
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

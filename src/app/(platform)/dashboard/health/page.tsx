import { Suspense } from "react";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import { AlertTriangle, CircleCheck, MessageSquare, Mic } from "lucide-react";
import { requireSalon } from "@/lib/session";
import { fmtHuman } from "@/lib/time";
import { healthEvents } from "@/lib/health";
import { EmptyState, PageHeader, Section, StatCard, StatusBadge } from "@/components/admin/kit";

const LABEL: Record<string, string> = {
  tool_error: "Booking tool failed",
  call_error: "Call ended with an error",
  webhook_auth: "Rejected request",
  cap_reached: "Daily limit reached",
  payment_issue: "Payment problem",
};

async function Health() {
  const { salon, supabase, role } = await requireSalon();
  const { events, recentProblems } = await healthEvents(supabase, salon.id, role);

  return (
    <div className="grid max-w-4xl gap-6">
      <PageHeader
        title="Health"
        description={`Problems Shanaya ran into at this branch${role === "owner" ? " (plus chain-wide ones, marked “All branches”)" : ""}, so you can fix them before guests notice.`}
      />
      <section aria-label="Summary" className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard icon={AlertTriangle} label="Problems (last 24 h)" value={recentProblems} hint="daily limits not counted" />
        <StatCard icon={Mic} label="Website voice calls / day" value={salon.daily_web_voice_cap} hint="daily limit" />
        <StatCard icon={MessageSquare} label="Chat messages / day" value={salon.daily_chat_cap} hint="daily limit" />
      </section>
      <Section title="Recent events" contentClassName={events.length ? "px-0" : undefined}>
        {!events.length ? (
          <EmptyState icon={CircleCheck} title="All good" description="No problems recorded." />
        ) : (
          <ul className="divide-y border-t">
            {events.map((e) => (
              <li key={e.id} className="px-6 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={e.kind === "cap_reached" ? "warning" : "danger"} className="normal-case">{LABEL[e.kind] ?? e.kind}</StatusBadge>
                  {!e.salon_id && <StatusBadge tone="neutral" className="normal-case">All branches</StatusBadge>}
                  <span className="tabular ml-auto text-xs text-muted-foreground">{fmtHuman(e.created_at, salon.timezone)}</span>
                </div>
                <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs whitespace-pre-wrap">{JSON.stringify(e.detail, null, 2)}</pre>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

// The page's live data streams inside its own Suspense boundary (instant navigation; Cache Components best practice).
export default function Page() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <Health />
    </Suspense>
  );
}

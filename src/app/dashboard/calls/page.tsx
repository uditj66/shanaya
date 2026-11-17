import { requireSalon } from "@/lib/session";
import { fmtHuman } from "@/lib/time";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";

export default async function Calls({ searchParams }: { searchParams: Promise<{ channel?: string }> }) {
  const { salon, supabase } = await requireSalon();
  const { channel } = await searchParams;
  let q = supabase
    .from("calls")
    .select("id, channel, customer_phone, started_at, created_at, duration_seconds, summary, transcript, recording_url, outcome, cost, customer:customer_id (name)")
    .eq("salon_id", salon.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (channel === "phone" || channel === "web") q = q.eq("channel", channel);
  const { data } = await q;

  return (
    <div>
      <PageHeader title="Calls & chats" subtitle="Every conversation the AI had, with summary, transcript and recording." />
      <div className="mb-4 flex gap-2 text-sm">
        {[["", "All"], ["phone", "Phone"], ["web", "Website"]].map(([v, l]) => (
          <a key={v} href={v ? `?channel=${v}` : "?"} className={`rounded-full px-3 py-1 ${channel === v || (!channel && !v) ? "bg-ink text-ivory" : "bg-white ring-1 ring-line"}`}>{l}</a>
        ))}
      </div>
      <div className="space-y-3">
        {!data?.length && <Card><Empty>No conversations yet. They appear here as soon as a guest calls or chats.</Empty></Card>}
        {data?.map((c) => (
          <Card key={c.id}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={c.channel}>{c.channel}</Badge>
              {c.outcome && <Badge tone={c.outcome}>{c.outcome}</Badge>}
              <span className="text-sm font-medium">{c.customer?.name ?? (c.customer_phone ? c.customer_phone : "Website visitor")}</span>
              <span className="ml-auto text-xs text-muted">
                {fmtHuman(c.started_at ?? c.created_at, salon.timezone)}
                {c.duration_seconds ? ` · ${Math.floor(c.duration_seconds / 60)}m ${c.duration_seconds % 60}s` : ""}
                {c.cost ? ` · $${Number(c.cost).toFixed(2)}` : ""}
              </span>
            </div>
            {c.summary && <p className="mt-2 text-sm">{c.summary}</p>}
            {c.recording_url && <audio controls preload="none" src={c.recording_url} className="mt-3 w-full" />}
            {c.transcript && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted hover:text-ink">Transcript</summary>
                <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-cream p-3 text-xs whitespace-pre-wrap">{c.transcript}</pre>
              </details>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

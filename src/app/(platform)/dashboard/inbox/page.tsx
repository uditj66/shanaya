import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import type { UIMessage } from "ai";
import { formatInTimeZone } from "date-fns-tz";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import { requireArea } from "@/lib/session";
import { Badge, Card, Empty, PageHeader } from "@/components/dashboard-ui";
import { TeamReply } from "./team-reply";

type SP = { id?: string; channel?: string };
type State = { ui?: UIMessage[]; takeover?: { by: string } | null };
const FILTERS = [["", "All"], ["web", "Website chats"], ["phone", "Phone calls"], ["live", "Taken over"]] as const;

const textOf = (m: UIMessage) => m.parts.map((p) => (p.type === "text" ? p.text : "")).join("").trim();

/** One line describing what the AI did with a tool, for the team's view of a chat. */
function toolLine(type: string, output: unknown): string | null {
  const o = (output ?? {}) as Record<string, unknown>;
  if ("error" in o) return null;
  switch (type) {
    case "tool-show_treatments": return `Showed treatments: ${((o.cards as { name: string }[]) ?? []).map((c) => c.name).join(", ")}`;
    case "tool-show_studios": return `Showed studios: ${((o.studios as { area: string }[]) ?? []).map((c) => c.area).join(", ")}`;
    case "tool-show_specialists": return `Showed specialists at ${String(o.studio ?? "the studio")}`;
    case "tool-check_availability": return `Checked times${o.date ? ` for ${String(o.date)}` : ""}`;
    case "tool-book_appointment": return "success" in o ? `Booked · ref ${String(o.reference ?? "")}` : "Tried to book";
    case "tool-reschedule_appointment": return "Rescheduled a booking";
    case "tool-cancel_appointment": return "Cancelled a booking";
    case "tool-request_callback": return "Requested a call-back";
    case "tool-ask_for_contact_details": return "Asked for contact details";
    case "tool-suggest_replies": return null;
    default: return null;
  }
}

async function Inbox({ searchParams }: { searchParams: Promise<SP> }) {
  const s = await requireArea("inbox");
  const sp = await searchParams;
  const filter = FILTERS.some(([k]) => k === sp.channel) ? (sp.channel ?? "") : "";
  const tz = s.salon.timezone;

  let q = s.supabase
    .from("calls")
    .select("id, salon_id, channel, customer_phone, created_at, ended_at, duration_seconds, summary, outcome, agent_state, customer:customer_id (id, name)")
    .in("salon_id", s.scopeIds)
    .order("created_at", { ascending: false })
    .limit(60);
  if (filter === "web" || filter === "phone") q = q.eq("channel", filter);
  if (filter === "live") q = q.eq("channel", "web").not("agent_state->>takeover", "is", null);
  const { data: list } = await q;

  const selectedId = sp.id && /^[0-9a-f-]{36}$/i.test(sp.id) ? sp.id : list?.[0]?.id;
  const { data: sel } = selectedId
    ? await s.supabase
        .from("calls")
        .select("id, salon_id, channel, customer_phone, created_at, duration_seconds, summary, transcript, recording_url, outcome, agent_state, customer:customer_id (id, name)")
        .eq("id", selectedId)
        .maybeSingle()
    : { data: null };
  const selState = (sel?.agent_state ?? {}) as State;
  const agentName = s.salon.agent_name || "Shanaya";
  const studio = (id: string) => s.salons.find((x) => x.id === id)?.area ?? "";
  const href = (patch: SP) => `/dashboard/inbox?${new URLSearchParams({ ...(filter && { channel: filter }), ...patch } as Record<string, string>)}` as Route;
  const who = (c: { customer: { name: string } | null; customer_phone: string | null; channel: string }) =>
    c.customer?.name ?? (c.customer_phone ? `+${c.customer_phone}` : c.channel === "web" ? "Website visitor" : "Unknown caller");

  return (
    <div>
      <PageHeader eyebrow={s.isAll ? `All ${s.scopeIds.length} studios` : (s.salon.area ?? "")} title="Inbox" subtitle={`Every phone call and website chat ${agentName} handled. Take over a live chat to answer yourself.`} />
      <div className="mb-4 flex flex-wrap gap-1.5 text-sm" role="group" aria-label="Filter">
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={href(k ? { channel: k } : {})} aria-current={filter === k ? "true" : undefined} className={`rounded-full px-3 py-1.5 ${filter === k ? "bg-charcoal text-ivory" : "text-stone ring-1 ring-line hover:text-charcoal"}`}>
            {label}
          </Link>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Card className={`max-h-[75dvh] overflow-y-auto p-0 ${sp.id ? "hidden lg:block" : ""}`}>
          {list?.length ? (
            <ul className="divide-y divide-line">
              {list.map((c) => {
                const st = (c.agent_state ?? {}) as State;
                const lastGuest = [...(st.ui ?? [])].reverse().find((m) => m.role === "user");
                return (
                  <li key={c.id}>
                    <Link href={href({ id: c.id })} aria-current={c.id === selectedId ? "true" : undefined} className={`block px-4 py-3 text-sm hover:bg-linen/50 ${c.id === selectedId ? "bg-linen/70" : ""}`}>
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate font-medium">{who(c)}</span>
                        <span className="shrink-0 text-xs text-stone">{formatInTimeZone(new Date(c.created_at), tz, "d MMM, h:mm a")}</span>
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge tone={c.channel}>{c.channel === "web" ? "chat" : "phone"}</Badge>
                        {st.takeover && <Badge tone="confirmed">team live</Badge>}
                        {c.outcome && <Badge tone={c.outcome}>{c.outcome}</Badge>}
                        {s.isAll && <span className="text-xs text-stone">{studio(c.salon_id)}</span>}
                      </span>
                      {(c.summary || lastGuest) && <span className="mt-1 line-clamp-2 block text-xs text-stone">{c.summary ?? textOf(lastGuest!)}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty>No conversations yet. They appear here as soon as a guest calls or chats.</Empty>
          )}
        </Card>

        <Card className={`flex min-h-[60dvh] flex-col p-0 ${sp.id ? "" : "hidden lg:flex"}`}>
          {!sel ? (
            <Empty>Pick a conversation.</Empty>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
                <Link href={href({})} className="text-sm text-stone hover:text-charcoal lg:hidden">← Inbox</Link>
                <div className="min-w-0 flex-1">
                  <h2 className="display-cut truncate text-[1.375rem]">{who(sel)}</h2>
                  <p className="text-xs text-stone">
                    {sel.channel === "web" ? "Website chat" : "Phone call"} · {formatInTimeZone(new Date(sel.created_at), tz, "EEE d MMM, h:mm a")}
                    {sel.duration_seconds ? ` · ${Math.floor(sel.duration_seconds / 60)}m ${sel.duration_seconds % 60}s` : ""}
                    {s.salons.length > 1 ? ` · ${studio(sel.salon_id)}` : ""}
                  </p>
                </div>
                {sel.customer && (
                  <Link href={`/dashboard/guests/${sel.customer.id}` as Route} className="text-sm text-brass-ink underline-offset-4 hover:underline">Guest profile</Link>
                )}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5" role="log" aria-label="Conversation">
                {sel.summary && <p className="rounded-xl bg-linen/60 px-4 py-3 text-sm"><span className="font-medium">Summary: </span>{sel.summary}</p>}
                {sel.recording_url && <audio controls preload="none" src={sel.recording_url} className="w-full" />}
                {sel.channel === "web" && selState.ui?.length ? (
                  selState.ui.map((m) => {
                    const staff = (m.metadata as { staff?: string } | undefined)?.staff;
                    const text = textOf(m);
                    const tools = m.role === "assistant" && !staff ? m.parts.map((p) => (p.type.startsWith("tool-") && "output" in p ? toolLine(p.type, p.output) : null)).filter(Boolean) : [];
                    return (
                      <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
                        <div className="max-w-[85%] space-y-1">
                          {m.role === "assistant" && <p className="text-[0.6875rem] text-stone">{staff ? `${staff} · team` : agentName}</p>}
                          {text && (
                            <p className={`whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "rounded-br-md bg-charcoal text-ivory" : staff ? "rounded-bl-md bg-blush/50" : "rounded-bl-md border border-line bg-white"}`}>{text}</p>
                          )}
                          {tools.map((t, i) => <p key={i} className="text-xs text-brass-ink">· {t}</p>)}
                        </div>
                      </div>
                    );
                  })
                ) : sel.transcript ? (
                  <pre className="whitespace-pre-wrap rounded-xl bg-linen/40 p-4 font-sans text-sm leading-relaxed">{sel.transcript}</pre>
                ) : (
                  <Empty>No transcript for this conversation.</Empty>
                )}
              </div>

              {sel.channel === "web" && <TeamReply callId={sel.id} takenBy={selState.takeover?.by ?? null} agentName={agentName} />}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function Page(props: Parameters<typeof Inbox>[0]) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <Inbox {...props} />
    </Suspense>
  );
}

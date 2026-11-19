import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import type { UIMessage } from "ai";
import { formatInTimeZone } from "date-fns-tz";
import DashboardLoading from "@/app/(platform)/dashboard/loading";
import { requireArea } from "@/lib/session";
import { ArrowLeft, Inbox as InboxIcon, MessagesSquare, UserRound } from "lucide-react";
import { ButtonLink, Card, EmptyState, PageHeader, StatusBadge, cn, SegmentedNav } from "@/components/admin/kit";
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
    case "tool-book_appointment":
      return "success" in o
        ? `Booked · ref ${String(o.reference ?? "")}${o.member ? " · member benefit applied" : ""}${o.gift_card ? " · paid with gift card" : ""}`
        : "Tried to book";
    case "tool-check_gift_card": return "Checked a gift card";
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
    <div className="grid gap-6">
      <PageHeader
        eyebrow={s.isAll ? `All ${s.scopeIds.length} studios` : (s.salon.area ?? "")}
        title="Inbox"
        description={`Every phone call and website chat ${agentName} handled. Take over a live chat to answer yourself.`}
      />
      <div>
        <SegmentedNav label="Filter" className="mb-4" items={FILTERS.map(([k, label]) => ({ href: href(k ? { channel: k } : {}), label, active: filter === k }))} />

        <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <Card className={cn("max-h-[75dvh] gap-0 overflow-y-auto py-0", sp.id && "hidden lg:flex")}>
            {list?.length ? (
              <ul className="divide-y">
                {list.map((c) => {
                  const st = (c.agent_state ?? {}) as State;
                  const lastGuest = [...(st.ui ?? [])].reverse().find((m) => m.role === "user");
                  return (
                    <li key={c.id}>
                      <Link
                        href={href({ id: c.id })}
                        aria-current={c.id === selectedId ? "true" : undefined}
                        className={cn("block px-4 py-3 text-sm transition-colors hover:bg-muted/60", c.id === selectedId && "bg-muted")}
                      >
                        <span className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate font-medium">{who(c)}</span>
                          <span className="tabular shrink-0 text-xs text-muted-foreground">{formatInTimeZone(new Date(c.created_at), tz, "d MMM, h:mm a")}</span>
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={c.channel}>{c.channel === "web" ? "chat" : "phone"}</StatusBadge>
                          {st.takeover && <StatusBadge tone="success">team live</StatusBadge>}
                          {c.outcome && <StatusBadge status={c.outcome} />}
                          {s.isAll && <span className="text-xs text-muted-foreground">{studio(c.salon_id)}</span>}
                        </span>
                        {(c.summary || lastGuest) && <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{c.summary ?? textOf(lastGuest!)}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon={InboxIcon} title="No conversations yet" description="They appear here as soon as a guest calls or chats." />
            )}
          </Card>

          <Card className={cn("min-h-[60dvh] gap-0 py-0", !sp.id && "hidden lg:flex")}>
            {!sel ? (
              <EmptyState icon={MessagesSquare} title="Pick a conversation" className="my-auto" />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
                  <ButtonLink href={href({})} variant="ghost" size="sm" className="-ml-2 lg:hidden">
                    <ArrowLeft aria-hidden /> Inbox
                  </ButtonLink>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold">{who(sel)}</h2>
                    <p className="text-xs text-muted-foreground">
                      {sel.channel === "web" ? "Website chat" : "Phone call"} · {formatInTimeZone(new Date(sel.created_at), tz, "EEE d MMM, h:mm a")}
                      {sel.duration_seconds ? ` · ${Math.floor(sel.duration_seconds / 60)}m ${sel.duration_seconds % 60}s` : ""}
                      {s.salons.length > 1 ? ` · ${studio(sel.salon_id)}` : ""}
                    </p>
                  </div>
                  {sel.customer && (
                    <ButtonLink href={`/dashboard/guests/${sel.customer.id}` as Route} variant="outline" size="sm">
                      <UserRound aria-hidden /> Guest profile
                    </ButtonLink>
                  )}
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5" role="log" aria-label="Conversation">
                  {sel.summary && (
                    <p className="rounded-lg bg-muted px-4 py-3 text-sm">
                      <span className="font-medium">Summary: </span>
                      {sel.summary}
                    </p>
                  )}
                  {sel.recording_url && <audio controls preload="none" src={sel.recording_url} className="w-full" />}
                  {sel.channel === "web" && selState.ui?.length ? (
                    selState.ui.map((m) => {
                      const staff = (m.metadata as { staff?: string } | undefined)?.staff;
                      const text = textOf(m);
                      const tools =
                        m.role === "assistant" && !staff
                          ? m.parts.map((p) => (p.type.startsWith("tool-") && "output" in p ? toolLine(p.type, p.output) : null)).filter(Boolean)
                          : [];
                      return (
                        <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
                          <div className="max-w-[85%] space-y-1">
                            {m.role === "assistant" && <p className="text-[0.6875rem] text-muted-foreground">{staff ? `${staff} · team` : agentName}</p>}
                            {text && (
                              <p
                                className={cn(
                                  "rounded-xl px-4 py-2.5 text-sm whitespace-pre-line",
                                  m.role === "user"
                                    ? "rounded-br-sm bg-primary text-primary-foreground"
                                    : staff
                                      ? "rounded-bl-sm bg-primary/12"
                                      : "rounded-bl-sm border bg-background",
                                )}
                              >
                                {text}
                              </p>
                            )}
                            {tools.map((t, i) => (
                              <p key={i} className="text-xs text-primary">
                                · {t}
                              </p>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  ) : sel.transcript ? (
                    <pre className="rounded-lg bg-muted p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap">{sel.transcript}</pre>
                  ) : (
                    <EmptyState title="No transcript for this conversation" />
                  )}
                </div>

                {sel.channel === "web" && <TeamReply callId={sel.id} takenBy={selState.takeover?.by ?? null} agentName={agentName} />}
              </>
            )}
          </Card>
        </div>
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

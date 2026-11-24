"use client";
// The concierge chat panel. Loaded only when the guest opens the chat (next/dynamic), so it never weighs on page load.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useChat } from "@ai-sdk/react";
import { track } from "@/lib/track-client";
import { DefaultChatTransport, type InferUITools, type UIMessage } from "ai";
import * as m from "motion/react-m";
import { ArrowUp, Mic, Phone, X } from "lucide-react";
import type { ConciergeTools } from "@/lib/concierge/tools";
import { saveChatLead } from "@/app/(brand)/b/[brand]/concierge-actions";
import { depositCheckout } from "@/app/(brand)/b/[brand]/payment-actions";
import { DepositPay } from "@/components/brand/deposit-pay";
import { AnimatePresence } from "motion/react";
import { useShanayaVoice } from "@/components/use-shanaya-voice";
import { CallScreen, type CallStage } from "./call-screen";
import { BrandImage } from "@/components/brand/brand-image";
import { cn, formatDuration, formatPrice } from "@/lib/utils";
import { EASE_OUT_SOFT } from "@/components/motion/motion-provider";
import { getConciergePage } from "./page-context";

type ChatMessage = UIMessage<unknown, never, InferUITools<ConciergeTools>>;
type Part = ChatMessage["parts"][number];

const ID_KEY = "concierge:id";

type VoiceLine = { role: "ai" | "you"; text: string };
type PastCall = { id: string; seconds: number; lines: VoiceLine[] };

/** A finished voice call, folded into the conversation: one quiet line, with the words tucked away. */
function CallNote({ call, agentName }: { call: PastCall; agentName: string }) {
  return (
    <div className="rounded-2xl border border-line/80 bg-white/60 px-4 py-3 text-[0.8125rem]">
      <p className="flex items-center gap-2 text-stone">
        <Phone className="size-3.5" strokeWidth={1.5} aria-hidden />
        Voice call with {agentName} · {call.seconds < 60 ? "under a minute" : `${Math.round(call.seconds / 60)} min`}
      </p>
      {call.lines.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-charcoal underline-offset-4 hover:underline">View transcript</summary>
          <ul className="mt-2 space-y-1.5 text-stone">
            {call.lines.map((l, i) => (
              <li key={i}>
                <span className="font-medium text-charcoal">{l.role === "ai" ? agentName : "You"}:</span> {l.text}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

const href = (p: string) => p as Route; // brand paths are clean URLs on the brand domain (see lib/brand/href.ts)

function chatId() {
  try {
    const existing = sessionStorage.getItem(ID_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(ID_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

const to12 = (t: string) => {
  const [h, mm] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};
const dayName = (d: string) => new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

export default function ConciergePanel({
  brand,
  brandName,
  agentName,
  voiceSlug,
  opener,
  onClose,
}: {
  brand: string;
  brandName: string;
  agentName: string;
  voiceSlug: string;
  /** A message to send as soon as the panel opens (from a nudge or a "Ask Shanaya about this" button). */
  opener?: string | null;
  onClose: () => void;
}) {
  const [id] = useState(chatId);
  const [restored, setRestored] = useState<ChatMessage[] | null>(null);
  const [teamAtOpen, setTeamAtOpen] = useState<string | null>(null);

  // Restore this tab's conversation (the server keeps it; the browser keeps only the id).
  useEffect(() => {
    let alive = true;
    fetch(`/api/concierge/${brand}?id=${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setTeamAtOpen(d.takeover?.by ?? null);
        setRestored(Array.isArray(d.messages) ? d.messages : []);
      })
      .catch(() => alive && setRestored([]));
    return () => {
      alive = false;
    };
  }, [brand, id]);

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={`Chat with ${agentName}`}
      className="fixed inset-x-0 bottom-0 z-50 flex h-[88dvh] flex-col overflow-hidden rounded-t-3xl border border-line bg-ivory/92 shadow-lift backdrop-blur-xl sm:inset-x-auto sm:right-5 sm:bottom-5 sm:h-[min(42rem,calc(100dvh-2.5rem))] sm:w-[25rem] sm:rounded-3xl"
    >
      {restored === null ? (
        <div className="grid flex-1 place-items-center text-sm text-stone" aria-busy="true">One moment…</div>
      ) : (
        <Conversation brand={brand} brandName={brandName} id={id} initial={restored} teamAtOpen={teamAtOpen} agentName={agentName} voiceSlug={voiceSlug} opener={opener} onClose={onClose} />
      )}
    </div>
  );
}

function Conversation({
  brand,
  brandName,
  id,
  initial,
  teamAtOpen,
  agentName,
  voiceSlug,
  opener,
  onClose,
}: {
  brand: string;
  brandName: string;
  id: string;
  initial: ChatMessage[];
  teamAtOpen: string | null;
  agentName: string;
  voiceSlug: string;
  opener?: string | null;
  onClose: () => void;
}) {
  const [transport] = useState(
    () =>
      new DefaultChatTransport<ChatMessage>({
        api: `/api/concierge/${brand}`,
        // Send only the newest message; the server holds the history.
        prepareSendMessagesRequest: ({ id, messages }) => {
          const p = getConciergePage();
          return { body: { id, message: messages[messages.length - 1], page: { kind: p.kind, service: p.service, studio: p.studio } } };
        },
      }),
  );
  const { messages, setMessages, sendMessage, status, error, clearError } = useChat<ChatMessage>({ id, messages: initial, transport });
  const team = useTeamReplies(brand, id, teamAtOpen, status === "ready" || status === "error", messages.length, setMessages);
  const [input, setInput] = useState("");
  // Voice calls: the call screen covers the panel; afterwards the call folds into the conversation as one line.
  const [voiceLines, setVoiceLines] = useState<VoiceLine[]>([]);
  const [pastCalls, setPastCalls] = useState<PastCall[]>([]);
  const [callStage, setCallStage] = useState<CallStage | null>(null);
  const callOpen = useRef(false);
  useEffect(() => {
    callOpen.current = callStage !== null;
  }, [callStage]);
  const voice = useShanayaVoice(`/api/widget/${voiceSlug}/voice`, (role, text) => setVoiceLines((l) => [...l, { role, text }]));
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const beginCall = () => {
    setCallStage("call");
    void voice.start();
  };
  // Explain the microphone first, unless the browser already allows it.
  const openCall = async () => {
    let granted = false;
    try {
      granted = (await navigator.permissions?.query({ name: "microphone" as PermissionName }))?.state === "granted";
    } catch {
      /* Safari and older browsers can't tell: show the explainer */
    }
    if (granted) beginCall();
    else setCallStage("priming");
  };

  // When a call ends: show "Call ended" for a moment, then fold the call into the conversation and return to chat.
  useEffect(() => {
    if (voice.status !== "ended" || callStage !== "call") return;
    const seconds = voice.startedAt ? Math.round((Date.now() - voice.startedAt) / 1000) : 0;
    const t = setTimeout(() => {
      setPastCalls((c) => (seconds > 0 || voiceLines.length ? [...c, { id: `call${c.length}`, seconds, lines: voiceLines }] : c));
      setVoiceLines([]);
      setCallStage(null);
      inputRef.current?.focus({ preventScroll: true });
    }, 1600);
    return () => clearTimeout(t);
  }, [voice.status, voice.startedAt, callStage, voiceLines]);
  const logRef = useRef<HTMLDivElement>(null);
  const sentOpener = useRef(false);
  const busy = status === "submitted" || status === "streaming";

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    clearError();
    track("chat_message");
    void sendMessage({ text: t });
  };

  useEffect(() => {
    // The opening question (from a nudge or an "Ask Shanaya" button) is sent once, on a timer that the cleanup cancels:
    // if React mounts twice (dev Strict Mode), only the mount that stays sends it.
    const t = opener && !sentOpener.current ? setTimeout(() => ((sentOpener.current = true), send(opener)), 0) : undefined;
    inputRef.current?.focus({ preventScroll: true });
    // Escape closes the chat, but never hangs up a voice call by accident.
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !callOpen.current && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pastCalls, status]);

  const lastAssistant = [...messages].reverse().find((x) => x.role === "assistant");
  const showTyping = !team && (status === "submitted" || (status === "streaming" && !lastAssistant?.parts.some((p) => p.type === "text" && p.text)));

  return (
    <>
      <header className="flex items-center gap-3 border-b border-line/80 px-5 py-4">
        <span aria-hidden="true" className="grid size-10 place-items-center rounded-full border border-champagne bg-ivory">
          <span className="display-cut text-xl text-brass-ink">{agentName[0]}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="display-cut text-[1.25rem] leading-tight">{agentName}</p>
          <p className="text-[0.75rem] text-stone" aria-live="polite">{team ? `${team} from the studio team is with you` : "Your beauty concierge · AI assistant"}</p>
        </div>
        <button onClick={() => void openCall()} className="grid size-11 place-items-center rounded-full text-charcoal hover:bg-linen" aria-label={`Call ${agentName} by voice`} title="Talk instead of typing">
          <Mic className="size-[1.125rem]" strokeWidth={1.4} />
        </button>
        <button onClick={onClose} className="grid size-11 place-items-center rounded-full text-stone hover:bg-linen hover:text-charcoal" aria-label="Close chat">
          <X className="size-5" strokeWidth={1.25} />
        </button>
      </header>

      <AnimatePresence>
        {callStage && (
          <CallScreen key="call" stage={callStage} voice={voice} agentName={agentName} brandName={brandName} onBegin={beginCall} onDismiss={() => setCallStage(null)} />
        )}
      </AnimatePresence>

      <div ref={logRef} role="log" aria-live="polite" aria-label="Conversation" data-lenis-prevent className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5">
        {messages.length === 0 && (
          <Bubble role="assistant">
            Hello, I&apos;m {agentName}. Tell me about your skin, an occasion coming up, or simply when you&apos;d like to visit, and I&apos;ll find the right ritual and time for you.
          </Bubble>
        )}
        {messages.length === 0 && (
          <Chips options={["Something for dull skin", "Bridal skin plan", "Find a studio near me", "Book a facial this week"]} onPick={send} disabled={busy} />
        )}
        {messages.map((msg, i) => (
          <MessageView key={msg.id || `m${i}`} msg={msg} isLast={i === messages.length - 1} busy={busy} onSend={send} brand={brand} chatId={id} />
        ))}
        {pastCalls.map((c) => (
          <CallNote key={c.id} call={c} agentName={agentName} />
        ))}
        {showTyping && <Typing name={agentName} />}
        {error && (
          <div role="alert" className="rounded-2xl border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger">
            {friendlyError(error)}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
          setInput("");
        }}
        className="border-t border-line/80 bg-ivory/80 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-white/80 px-3 py-2 focus-within:border-brass focus-within:ring-4 focus-within:ring-brass/10">
          <label htmlFor="concierge-input" className="sr-only">Message {agentName}</label>
          <textarea
            id="concierge-input"
            ref={inputRef}
            rows={1}
            value={input}
            maxLength={1000}
            disabled={voice.status === "live"}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
                setInput("");
              }
            }}
            placeholder={voice.status === "live" ? "You're on a voice call…" : "Ask about a ritual, a studio or a time…"}
            className="max-h-32 min-h-10 flex-1 resize-none bg-transparent py-2 text-[0.9375rem] outline-none placeholder:text-stone/70"
          />
          <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="mb-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-charcoal text-ivory transition-opacity disabled:opacity-30">
            <ArrowUp className="size-4" strokeWidth={1.75} />
          </button>
        </div>
        <p className="mt-2 text-center text-[0.6875rem] text-stone">
          AI assistant. Prices and times come live from the studios.{" "}
          <Link href={href("/privacy")} className="underline underline-offset-2">Privacy</Link>
        </p>
      </form>
    </>
  );
}

/**
 * A team member can take over a chat from the dashboard inbox. While the panel is open and idle, check the saved
 * conversation every few seconds and pull in their replies. Returns the team member's name while they're answering.
 */
function useTeamReplies(brand: string, id: string, initialBy: string | null, idle: boolean, count: number, setMessages: (m: ChatMessage[]) => void) {
  const [by, setBy] = useState<string | null>(initialBy);
  useEffect(() => {
    if (!idle || count === 0) return;
    let alive = true;
    const tick = async () => {
      try {
        const d = await fetch(`/api/concierge/${brand}?id=${id}`, { cache: "no-store" }).then((r) => r.json());
        if (!alive) return;
        setBy(d.takeover?.by ?? null);
        if (Array.isArray(d.messages) && d.messages.length > count) setMessages(d.messages);
      } catch {}
    };
    const t = setInterval(tick, by ? 3000 : 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [brand, id, idle, count, by, setMessages]);
  return by;
}

function friendlyError(e: Error) {
  try {
    const j = JSON.parse(e.message);
    if (j?.error) return String(j.error);
  } catch {}
  return "I couldn't reach the studio just now. Please try again in a moment.";
}

/* ─────────────────────────── message rendering ─────────────────────────── */

function MessageView({ msg, isLast, busy, onSend, brand, chatId }: { msg: ChatMessage; isLast: boolean; busy: boolean; onSend: (t: string) => void; brand: string; chatId: string }) {
  if (msg.role === "user") {
    const text = msg.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
    return <Bubble role="user">{text}</Bubble>;
  }
  // A reply typed by a team member from the dashboard inbox.
  const staff = (msg.metadata as { staff?: string } | undefined)?.staff;
  if (staff) {
    return (
      <div className="space-y-1">
        <p className="text-[0.6875rem] tracking-[0.04em] text-stone">{staff} · studio team</p>
        <Bubble role="assistant">{msg.parts.map((p) => (p.type === "text" ? p.text : "")).join("")}</Bubble>
      </div>
    );
  }
  // The model often calls tools before it writes; show her words first, then the cards, and the reply chips last.
  const rank = (p: Part) => (p.type === "text" ? 0 : p.type === "tool-suggest_replies" ? 2 : 1);
  // If she checked times more than once in a reply, only the latest set of time chips is shown.
  const lastSlots = msg.parts.map((p) => p.type).lastIndexOf("tool-check_availability");
  const ordered = msg.parts
    .map((part, i) => ({ part, i }))
    .filter(({ part, i }) => part.type !== "tool-check_availability" || i === lastSlots)
    .sort((a, b) => rank(a.part) - rank(b.part) || a.i - b.i);
  return (
    <div className="space-y-3">
      {ordered.map(({ part, i }) => (
        <PartView key={i} part={part} isLast={isLast} busy={busy} onSend={onSend} brand={brand} chatId={chatId} />
      ))}
    </div>
  );
}

function PartView({ part, isLast, busy, onSend, brand, chatId }: { part: Part; isLast: boolean; busy: boolean; onSend: (t: string) => void; brand: string; chatId: string }) {
  if (part.type === "text") return part.text ? <Bubble role="assistant">{part.text}</Bubble> : null;
  if (!part.type.startsWith("tool-")) return null;
  const p = part as Extract<Part, { type: `tool-${string}` }>;
  if (p.state !== "output-available") return null;
  const out = p.output as Record<string, unknown>;
  if (!out || "error" in out) return null;

  switch (p.type) {
    case "tool-show_treatments":
      return <TreatmentCards cards={(out as { cards: TreatmentCard[] }).cards} onSend={onSend} disabled={busy} />;
    case "tool-show_studios":
      return <StudioCards studios={(out as { studios: StudioCard[] }).studios} onSend={onSend} disabled={busy} />;
    case "tool-show_specialists":
      return <SpecialistCards data={out as { studio: string; specialists: SpecialistCard[] }} onSend={onSend} disabled={busy} />;
    case "tool-suggest_replies":
      return isLast ? <Chips options={(out as { options: string[] }).options} onPick={onSend} disabled={busy} /> : null;
    case "tool-check_availability":
      return <SlotChips data={out as AvailabilityOut} onSend={onSend} disabled={busy || !isLast} />;
    case "tool-book_appointment":
      return "success" in out ? <BookedCard b={out as BookedOut} onSend={onSend} /> : null;
    case "tool-ask_for_contact_details":
      return <ContactForm reason={String(out.reason ?? "")} brand={brand} chatId={chatId} onDone={(name) => onSend(`I've shared my contact details (${name}).`)} />;
    case "tool-request_callback":
      return "success" in out ? <Note>The team has your request and will call you back.</Note> : null;
    default:
      return null;
  }
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_OUT_SOFT }}
      className={cn(
        "max-w-[88%] whitespace-pre-line rounded-2xl px-4 py-3 text-[0.9375rem] leading-relaxed",
        role === "user" ? "ml-auto rounded-br-md bg-charcoal text-ivory" : "rounded-bl-md border border-line/70 bg-white/80 text-charcoal",
      )}
    >
      {role === "assistant" && <span className="sr-only">Shanaya: </span>}
      {children}
    </m.div>
  );
}

function Typing({ name }: { name: string }) {
  return (
    <div className="flex w-fit items-center gap-1.5 rounded-2xl rounded-bl-md border border-line/70 bg-white/80 px-4 py-3.5" role="status" aria-label={`${name} is typing`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 rounded-full bg-brass motion-safe:animate-[typing_1.2s_ease-in-out_infinite]" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-linen px-4 py-3 text-[0.8125rem] text-stone">{children}</p>;
}

function Chips({ options, onPick, disabled }: { options: string[]; onPick: (t: string) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested replies">
      {options.map((o) => (
        <button key={o} type="button" disabled={disabled} onClick={() => onPick(o)} className="min-h-9 rounded-full border border-champagne bg-ivory px-3.5 text-[0.8125rem] text-charcoal transition-colors hover:border-charcoal disabled:opacity-40">
          {o}
        </button>
      ))}
    </div>
  );
}

/* ───────────────────────────── cards ───────────────────────────── */
type TreatmentCard = { code: string; name: string; headline: string; price: number; minutes: number | null; image: string; href: string; consultationFirst: boolean; category: string };
type StudioCard = { branch_id: string; slug: string; area: string; city: string; address: string | null; image: string; hours: string };
type SpecialistCard = { name: string; title: string; specialties: string[]; href: string };
type AvailabilityOut = { branch?: string; date?: string; service?: string; available?: { time: string; therapists: string[] }[]; next_available_date?: string; next_available?: { time: string; therapists: string[] }[]; consultation_required?: boolean };
type BookedOut = {
  reference: string; branch: string; service?: string; therapist?: string; date: string; time: string; price: number; address?: string | null;
  deposit?: { amount: number; token: string; hold_until: string | null; refund_hours: number };
  member?: { tier: string; benefit: "discount" | "included"; discount: number };
  gift_card?: { paid: number; balance_left: number };
  pay_at_studio?: number;
};

function TreatmentCards({ cards, onSend, disabled }: { cards: TreatmentCard[]; onSend: (t: string) => void; disabled: boolean }) {
  return (
    <ul className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]" aria-label="Suggested treatments">
      {cards.map((c) => (
        <li key={c.code} className="w-56 shrink-0 snap-start overflow-hidden rounded-2xl border border-line/80 bg-white/85">
          <div className="relative aspect-[4/3] bg-sand">
            <BrandImage id={c.image} fill sizes="224px" alt="" />
          </div>
          <div className="p-4">
            <p className="text-[0.6875rem] uppercase tracking-[0.18em] text-brass-ink">{c.category}</p>
            <p className="display-cut mt-1 text-[1.125rem] leading-snug">{c.name}</p>
            <p className="mt-1 text-[0.8125rem] text-stone tabular-nums">
              {formatPrice(c.price)}
              {c.minutes ? ` · ${formatDuration(c.minutes)}` : ""}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <button type="button" disabled={disabled} onClick={() => onSend(c.consultationFirst ? `I'd like a consultation for the ${c.name}` : `I'd like to book the ${c.name}`)} className="min-h-9 rounded-full bg-charcoal px-4 text-[0.8125rem] text-ivory disabled:opacity-40">
                {c.consultationFirst ? "Consult" : "Book"}
              </button>
              <Link href={href(c.href)} className="text-[0.8125rem] underline decoration-line underline-offset-4 hover:decoration-charcoal">Details</Link>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function StudioCards({ studios, onSend, disabled }: { studios: StudioCard[]; onSend: (t: string) => void; disabled: boolean }) {
  return (
    <ul className="grid gap-2" aria-label="Studios">
      {studios.map((s) => (
        <li key={s.slug} className="flex items-center gap-3 rounded-2xl border border-line/80 bg-white/85 p-2.5">
          <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-sand">
            <BrandImage id={s.image} fill sizes="64px" alt="" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="display-cut block text-[1.0625rem] leading-tight">{s.area}</span>
            <span className="block truncate text-[0.75rem] text-stone">{s.city} · {s.hours.split(" · ")[0]}</span>
          </span>
          <button type="button" disabled={disabled} onClick={() => onSend(`The ${s.area} studio, please`)} className="min-h-9 shrink-0 rounded-full border border-charcoal/25 px-3.5 text-[0.8125rem] hover:border-charcoal disabled:opacity-40">
            Choose
          </button>
        </li>
      ))}
    </ul>
  );
}

function SpecialistCards({ data, onSend, disabled }: { data: { studio: string; specialists: SpecialistCard[] }; onSend: (t: string) => void; disabled: boolean }) {
  return (
    <div className="rounded-2xl border border-line/80 bg-white/85 p-3">
      <p className="px-1 text-[0.6875rem] uppercase tracking-[0.18em] text-brass-ink">The {data.studio} team</p>
      <ul className="mt-2 divide-y divide-line/70">
        {data.specialists.map((p) => (
          <li key={p.href} className="flex items-center justify-between gap-3 px-1 py-2.5">
            <span className="min-w-0">
              <Link href={href(p.href)} className="block font-medium hover:underline">{p.name}</Link>
              <span className="block truncate text-[0.75rem] text-stone">{p.title}{p.specialties[0] ? ` · ${p.specialties[0]}` : ""}</span>
            </span>
            <button type="button" disabled={disabled} onClick={() => onSend(`I'd like ${p.name}`)} className="min-h-9 shrink-0 rounded-full border border-charcoal/25 px-3 text-[0.8125rem] hover:border-charcoal disabled:opacity-40">
              Choose
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SlotChips({ data, onSend, disabled }: { data: AvailabilityOut; onSend: (t: string) => void; disabled: boolean }) {
  const date = data.available?.length ? data.date : data.next_available_date;
  const slots = data.available?.length ? data.available : data.next_available ?? [];
  if (!date || !slots.length) return null;
  return (
    <div className="rounded-2xl border border-line/80 bg-white/85 p-3">
      <p className="px-1 text-[0.8125rem] text-stone">
        {data.service ? `${data.service} · ` : ""}
        {dayName(date)}
        {data.branch ? ` · ${data.branch.split(", ").pop()}` : ""}
      </p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Available times">
        {slots.map((s) => (
          <button key={s.time} type="button" disabled={disabled} onClick={() => onSend(`${to12(s.time)} on ${dayName(date)} works for me`)} className="min-h-10 rounded-xl border border-line bg-ivory px-3.5 text-sm tabular-nums transition-colors hover:border-charcoal hover:bg-blush/40 disabled:opacity-40" aria-label={`${to12(s.time)} on ${dayName(date)}${s.therapists[0] ? ` with ${s.therapists[0]}` : ""}`}>
            {to12(s.time)}
          </button>
        ))}
      </div>
    </div>
  );
}

function BookedCard({ b, onSend }: { b: BookedOut; onSend: (t: string) => void }) {
  const [state, setState] = useState<string | null>(b.deposit ? null : "none");
  // After a reload the saved card can't know whether the deposit was paid since, so ask the server once.
  useEffect(() => {
    if (!b.deposit) return;
    let alive = true;
    void depositCheckout(b.deposit.token).then((r) => alive && setState(r?.state ?? "pending"));
    return () => {
      alive = false;
    };
  }, [b.deposit]);
  const held = b.deposit && state === "pending";
  const lapsed = b.deposit && (state === "expired" || state === "refunded");
  return (
    <div className="rounded-2xl border border-champagne bg-ivory p-4">
      <p className="text-[0.6875rem] uppercase tracking-[0.18em] text-brass-ink">{held ? "Held for you" : lapsed ? "Hold ended" : b.deposit && state === "paid" ? "Confirmed · deposit paid" : "Booked"}</p>
      <p className="display-cut mt-1 text-[1.25rem]">{b.service}</p>
      <p className="mt-1 text-[0.8125rem] text-stone">
        {dayName(b.date)}, {to12(b.time)} · {b.branch}
        {b.therapist ? ` · with ${b.therapist}` : ""}
      </p>
      <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-linen px-3 py-1 text-[0.8125rem]">
        Reference <span className="font-medium tracking-[0.12em]">{b.reference}</span>
      </p>
      {(b.member || b.gift_card) && (
        <dl className="mt-3 grid gap-1 text-[0.8125rem]">
          {b.member && (
            <div className="flex justify-between gap-3">
              <dt className="text-stone">{b.member.benefit === "included" ? `Included with ${b.member.tier}` : `${b.member.tier} discount`}</dt>
              <dd className="tabular-nums">−{formatPrice(b.member.discount)}</dd>
            </div>
          )}
          {b.gift_card && (
            <div className="flex justify-between gap-3">
              <dt className="text-stone">Gift card ({formatPrice(b.gift_card.balance_left)} left)</dt>
              <dd className="tabular-nums">−{formatPrice(b.gift_card.paid)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3 font-medium">
            <dt>To pay at the studio</dt>
            <dd className="tabular-nums">{b.pay_at_studio ? formatPrice(b.pay_at_studio) : "Nothing"}</dd>
          </div>
        </dl>
      )}
      {held && b.deposit && (
        <div className="mt-4 border-t border-line pt-4">
          <DepositPay
            compact
            token={b.deposit.token}
            amount={b.deposit.amount}
            holdUntil={b.deposit.hold_until}
            refundHours={b.deposit.refund_hours}
            onPaid={() => {
              setState("paid");
              onSend(`I've paid the ₹${b.deposit!.amount.toLocaleString("en-IN")} deposit.`);
            }}
            onRelease={() => {
              setState("expired");
              onSend("I'd like to choose a different time.");
            }}
          />
        </div>
      )}
      {lapsed && <p className="mt-3 text-[0.8125rem] text-stone">This time is no longer held. Ask me for another time and I&apos;ll find one.</p>}
    </div>
  );
}

function ContactForm({ reason, brand, chatId, onDone }: { reason: string; brand: string; chatId: string; onDone: (name: string) => void }) {
  const [state, setState] = useState<{ status: "idle" | "saving" | "done"; error?: string; fe?: Record<string, string>; name?: string }>({ status: "idle" });
  if (state.status === "done") return <Note>Thank you, {state.name}. The team will contact you about {reason.toLowerCase()}.</Note>;
  const fe = state.fe ?? {};
  return (
    <form
      className="grid gap-3 rounded-2xl border border-line/80 bg-white/85 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setState({ status: "saving" });
        const r = await saveChatLead({
          brand,
          chatId,
          reason,
          name: String(f.get("name") ?? ""),
          phone: String(f.get("phone") ?? ""),
          email: String(f.get("email") ?? ""),
          consent: f.get("consent") === "on",
        });
        if (r.ok) {
          setState({ status: "done", name: r.name });
          onDone(r.name);
        } else setState({ status: "idle", error: r.error, fe: r.fieldErrors });
      }}
    >
      <p className="text-[0.8125rem] text-stone">So the team can contact you about <span className="text-charcoal">{reason}</span>:</p>
      {(["name", "phone", "email"] as const).map((n) => (
        <div key={n} className="grid gap-1">
          <label htmlFor={`cc-${n}`} className="text-[0.75rem] font-medium">
            {n === "name" ? "Your name" : n === "phone" ? "Mobile number" : "Email (optional)"}
          </label>
          <input
            id={`cc-${n}`}
            name={n}
            type={n === "phone" ? "tel" : n === "email" ? "email" : "text"}
            autoComplete={n === "name" ? "name" : n === "phone" ? "tel" : "email"}
            aria-invalid={fe[n] ? true : undefined}
            aria-describedby={fe[n] ? `cc-${n}-e` : undefined}
            className="h-10 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brass focus:ring-4 focus:ring-brass/10"
          />
          {fe[n] && <span id={`cc-${n}-e`} className="text-[0.75rem] text-danger">{fe[n]}</span>}
        </div>
      ))}
      <label className="flex items-start gap-2.5 text-[0.75rem] leading-relaxed text-stone">
        <input type="checkbox" name="consent" className="mt-0.5 size-4 accent-charcoal" aria-invalid={fe.consent ? true : undefined} />
        I agree that Lumière may contact me about this request.
      </label>
      {fe.consent && <span className="text-[0.75rem] text-danger">{fe.consent}</span>}
      {state.error && !Object.keys(fe).length && <p role="alert" className="text-[0.75rem] text-danger">{state.error}</p>}
      <button type="submit" disabled={state.status === "saving"} className="min-h-10 rounded-full bg-charcoal text-sm text-ivory disabled:opacity-50">
        {state.status === "saving" ? "Sending…" : "Share my details"}
      </button>
    </form>
  );
}

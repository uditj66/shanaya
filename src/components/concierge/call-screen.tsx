"use client";
// A website voice call with Shanaya as a real call, not a chat: it covers the whole panel (the sheet on phones), puts
// her voice first, and shows text only when the guest asks for captions.
import { useEffect, useRef, useState } from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import { Captions, CaptionsOff, Mic, MicOff, PhoneOff } from "lucide-react";
import { LiveOrb, type OrbState } from "@/components/live-orb";
import { CallCardView } from "./call-card-view";
import { NumberEntry } from "./number-entry";
import type { useShanayaVoice } from "@/components/use-shanaya-voice";
import { cn } from "@/lib/utils";
import { EASE_OUT_SOFT } from "@/components/motion/motion-provider";

type Voice = ReturnType<typeof useShanayaVoice>;
export type CallStage = "priming" | "call";

const CAPTIONS_KEY = "concierge:captions";
const readCaptions = () => {
  try {
    return localStorage.getItem(CAPTIONS_KEY) === "on";
  } catch {
    return false;
  }
};

const clock = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

/** Seconds since the call connected, ticking once a second while it's live. */
function useElapsed(startedAt: number | null, running: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  return startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
}

export function CallScreen({
  stage,
  voice,
  agentName,
  brandName,
  onBegin,
  onDismiss,
}: {
  stage: CallStage;
  voice: Voice;
  agentName: string;
  brandName: string;
  /** Start the call (from the microphone explainer, or "Try again"). */
  onBegin: () => void;
  /** Close the call screen and go back to the chat. */
  onDismiss: () => void;
}) {
  const [captionsOn, setCaptionsOn] = useState(readCaptions);
  const endRef = useRef<HTMLButtonElement>(null);
  const live = voice.status === "live";
  const connecting = voice.status === "connecting";
  const elapsed = useElapsed(voice.startedAt, live);
  const card = voice.cards.at(-1) ?? null; // the newest card: offered times, then the booking

  useEffect(() => {
    if (stage === "call" && (live || connecting)) endRef.current?.focus({ preventScroll: true });
  }, [stage, live, connecting]);

  const toggleCaptions = () => {
    const next = !captionsOn;
    setCaptionsOn(next);
    try {
      localStorage.setItem(CAPTIONS_KEY, next ? "on" : "off");
    } catch {
      /* private mode: remembered for this call only */
    }
  };

  // One state drives both the orb and the status line. Her speaking wins; then a running tool; then thinking.
  const orb: OrbState =
    stage === "priming" ? "idle"
    : connecting ? "connecting"
    : !live ? "idle"
    : voice.speaking ? "speaking"
    : voice.activity?.kind === "working" ? "working"
    : voice.activity?.kind === "thinking" ? "thinking"
    : voice.muted ? "muted"
    : "listening";

  const status =
    stage === "priming" ? null
    : connecting ? "Connecting…"
    : voice.status === "ended" ? `Call ended${elapsed ? ` · ${clock(elapsed)}` : ""}`
    : !live ? null
    : orb === "speaking" ? `${agentName} is speaking`
    : orb === "working" && voice.activity?.kind === "working" ? voice.activity.label
    : orb === "thinking" ? "One moment…"
    : orb === "muted" ? "You're muted"
    : "Listening…";

  return (
    <m.section
      aria-label={`Voice call with ${agentName}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: EASE_OUT_SOFT }}
      className="absolute inset-0 z-20 flex flex-col bg-[radial-gradient(120%_80%_at_50%_30%,var(--color-ivory)_0%,var(--color-linen)_70%,var(--color-sand)_100%)] text-charcoal"
    >
      {/* Who and how long */}
      <header className="px-6 pt-8 text-center">
        <p className="text-[0.6875rem] tracking-[0.22em] text-stone uppercase">{brandName}</p>
        <h2 className="display-cut mt-1 text-[2rem] leading-tight">{agentName}</h2>
        <p className="mt-1 text-[0.8125rem] text-stone">
          Your beauty concierge · AI assistant
          {live && (
            <>
              {" · "}
              <span className="tabular-nums" aria-label={`Call time ${clock(elapsed)}`}>
                {clock(elapsed)}
              </span>
            </>
          )}
        </p>
      </header>

      {/* Her presence */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-2">
        {/* the orb makes room when there's a card to read */}
        <LiveOrb state={orb} levels={voice.levels} size={card ? 104 : 168} />
        <p className="min-h-6 text-[0.9375rem] text-stone" aria-live="polite">
          {status}
        </p>
        {live && voice.weakNetwork && (
          <p role="status" className="-mt-4 rounded-full bg-linen px-3 py-1 text-[0.75rem] text-stone">
            Your connection is weak. Shanaya may break up a little.
          </p>
        )}
        {live && <NumberEntry asked={voice.numberAsked} onSend={voice.sendNumber} />}
        {card && (live || voice.status === "ended") && (
          <div className="w-full max-w-[22rem]" aria-live="polite">
            <CallCardView key={card.kind === "booking" ? card.reference : `${card.date}-${card.service}`} card={card} brandName={brandName} />
          </div>
        )}

        {stage === "priming" && (
          <div className="max-w-[18rem] text-center">
            <p className="text-[0.9375rem] leading-relaxed">
              Talk to {agentName} the way you&apos;d call the studio. Your browser will ask to use your microphone. Please allow it.
            </p>
            <p className="mt-2 text-[0.75rem] text-stone">Calls may be recorded for quality and booking purposes.</p>
          </div>
        )}

        {voice.status === "error" && voice.error && (
          <p role="alert" className="max-w-[18rem] text-center text-[0.875rem] text-danger">
            {voice.error}
          </p>
        )}
      </div>

      {/* Optional captions: only the line being spoken now, never a running log */}
      <div className="min-h-[5.5rem] px-6" aria-hidden={!captionsOn}>
        <AnimatePresence mode="wait">
          {captionsOn && live && voice.caption && (
            <m.p
              key={voice.caption.role}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE_OUT_SOFT }}
              className={cn("line-clamp-3 text-center text-[0.9375rem] leading-snug", voice.caption.role === "you" ? "text-stone italic" : "text-charcoal")}
            >
              {voice.caption.text}
            </m.p>
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <footer className="px-6 pt-2 pb-[max(1.75rem,env(safe-area-inset-bottom))]">
        {stage === "priming" || voice.status === "error" ? (
          <div className="flex flex-col items-center gap-3">
            <button onClick={onBegin} className="min-h-12 w-full max-w-[16rem] rounded-full bg-charcoal px-6 text-[0.9375rem] text-ivory hover:bg-charcoal/90">
              {voice.status === "error" ? (voice.dropped ? "Call back" : "Try again") : "Start the call"}
            </button>
            <button onClick={onDismiss} className="min-h-10 px-4 text-[0.875rem] text-stone hover:text-charcoal">
              Back to chat
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-6">
            <CallButton label={voice.muted ? "Unmute" : "Mute"} pressed={voice.muted} disabled={!live} onClick={() => voice.setMuted(!voice.muted)}>
              {voice.muted ? <MicOff className="size-5" strokeWidth={1.5} /> : <Mic className="size-5" strokeWidth={1.5} />}
            </CallButton>
            <button
              ref={endRef}
              onClick={() => void voice.stop()}
              disabled={voice.status === "ended"}
              aria-label="End call"
              className="grid size-16 place-items-center rounded-full bg-danger text-ivory shadow-lift transition-transform hover:scale-105 disabled:opacity-50"
            >
              <PhoneOff className="size-6" strokeWidth={1.5} />
            </button>
            <CallButton label={captionsOn ? "Hide captions" : "Show captions"} pressed={captionsOn} onClick={toggleCaptions}>
              {captionsOn ? <Captions className="size-5" strokeWidth={1.5} /> : <CaptionsOff className="size-5" strokeWidth={1.5} />}
            </CallButton>
          </div>
        )}
      </footer>
    </m.section>
  );
}

function CallButton({ label, pressed, disabled, onClick, children }: { label: string; pressed: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={cn(
        "grid size-12 place-items-center rounded-full border transition-colors disabled:opacity-40",
        pressed ? "border-charcoal bg-charcoal text-ivory" : "border-line bg-white/70 text-charcoal hover:bg-white",
      )}
    >
      {children}
    </button>
  );
}

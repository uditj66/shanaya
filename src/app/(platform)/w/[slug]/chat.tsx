"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useShanayaVoice } from "@/components/use-shanaya-voice";
import { VoiceOrb } from "@/components/voice-orb";

type Msg = { role: "ai" | "you"; text: string };

export function Chat({ slug, salonName, agentName }: { slug: string; salonName: string; agentName: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Voice = a live Vapi call with exactly the same voice, personality and tools as the phone line.
  const addLine = useCallback((role: "ai" | "you", line: string) => setMsgs((m) => [...m, { role, text: line }]), []);
  const voice = useShanayaVoice(`/api/widget/${slug}/voice`, addLine);

  const send = useCallback(
    async (message: string) => {
      if (!message.trim() || busy) return;
      setBusy(true);
      setMsgs((m) => [...m, { role: "you", text: message }]);
      try {
        const r = await fetch(`/api/widget/${slug}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, text: message }) });
        const d = await r.json();
        setMsgs((m) => [...m, { role: "ai", text: d.reply ?? d.error ?? "Sorry, something went wrong." }]);
      } catch {
        setMsgs((m) => [...m, { role: "ai", text: "Connection problem. Please try again." }]);
      } finally {
        setBusy(false);
      }
    },
    [busy, sessionId, slug],
  );

  useEffect(() => {
    fetch(`/api/widget/${slug}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      .then((r) => r.json())
      .then((d) => {
        setSessionId(d.sessionId ?? null);
        setMsgs([{ role: "ai", text: d.reply ?? d.error ?? `Hello, I'm ${agentName}.` }]);
      });
  }, [slug, agentName]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  return (
    <div className="flex h-dvh flex-col bg-ivory">
      <header className="flex items-center gap-3 border-b border-line bg-white px-4 py-3">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-gold to-rose font-serif text-lg text-white">{agentName[0]}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-lg leading-tight font-semibold">{salonName}</p>
          <p className="text-xs text-muted">{agentName} · AI booking assistant</p>
        </div>
        {!voice.live && (
          <button onClick={voice.start} className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-ivory hover:bg-black">
            🎙 Talk to {agentName}
          </button>
        )}
      </header>

      {voice.live && (
        <div className="flex items-center gap-4 border-b border-line bg-gradient-to-r from-cream to-white px-4 py-4">
          <VoiceOrb active={voice.speaking} connecting={voice.status === "connecting"} />
          <div className="min-w-0 flex-1">
            <p className="font-serif text-lg font-semibold">{voice.status === "connecting" ? `Connecting you to ${agentName}…` : `On a call with ${agentName}`}</p>
            <p className="text-xs text-muted">{voice.status === "connecting" ? "Please allow the microphone" : voice.speaking ? `${agentName} is speaking` : "Listening… speak naturally, you can interrupt anytime"}</p>
          </div>
          <button onClick={voice.stop} className="rounded-full bg-danger px-3.5 py-1.5 text-xs font-medium text-white">End call</button>
        </div>
      )}
      {voice.error && <p className="border-b border-line bg-danger/5 px-4 py-2 text-xs text-danger">{voice.error}</p>}

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role === "ai" ? "bg-white shadow-sm ring-1 ring-line" : "ml-auto bg-ink text-ivory"}`}>
            {m.text}
          </div>
        ))}
        {busy && <div className="w-16 rounded-2xl bg-white px-4 py-2.5 text-sm text-muted ring-1 ring-line">…</div>}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
          setText("");
        }}
        className="flex gap-2 border-t border-line bg-white p-3"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={voice.live ? "You're on a voice call…" : "Ask about treatments or book a slot…"}
          disabled={voice.live}
          className="field flex-1"
          maxLength={1000}
        />
        <button disabled={busy || voice.live || !text.trim()} className="rounded-lg bg-ink px-4 text-sm font-medium text-ivory disabled:opacity-40">Send</button>
      </form>
      <p className="bg-white pb-2 text-center text-[10px] text-muted">AI assistant · voice calls may be recorded for quality · your details are used only for your booking ·{" "}
        <a href="/privacy" target="_blank" className="underline hover:text-ink">Privacy</a>
      </p>
    </div>
  );
}

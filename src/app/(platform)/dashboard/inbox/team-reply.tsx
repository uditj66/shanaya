"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendTeamReply, setTakeover } from "./actions";

/** Take over a website chat, reply as the team, and hand it back to the AI. Refreshes while the chat is live. */
export function TeamReply({ callId, takenBy, agentName }: { callId: string; takenBy: string | null; agentName: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // While a team member is answering, pull in the guest's new messages every few seconds.
  useEffect(() => {
    if (!takenBy) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [takenBy, router]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Something went wrong.");
      else after?.();
    });

  return (
    <div className="border-t border-line bg-ivory/60 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        {takenBy ? (
          <>
            <span className="inline-flex items-center gap-2 text-charcoal">
              <span aria-hidden="true" className="size-2 rounded-full bg-success" />
              {takenBy} is answering. {agentName} is paused.
            </span>
            <button type="button" disabled={pending} onClick={() => run(() => setTakeover(callId, false))} className="ml-auto min-h-9 rounded-full px-3 text-stone ring-1 ring-line hover:text-charcoal disabled:opacity-50">
              Hand back to {agentName}
            </button>
          </>
        ) : (
          <>
            <span className="text-stone">{agentName} is handling this chat.</span>
            <button type="button" disabled={pending} onClick={() => run(() => setTakeover(callId, true))} className="ml-auto min-h-9 rounded-full bg-charcoal px-4 text-ivory disabled:opacity-50">
              Take over
            </button>
          </>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (t) run(() => sendTeamReply(callId, t), () => setText(""));
        }}
        className="flex items-end gap-2"
      >
        <label htmlFor="team-reply" className="sr-only">Reply to the guest</label>
        <textarea
          id="team-reply"
          rows={2}
          value={text}
          maxLength={1000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={takenBy ? "Write to the guest…" : "Reply as the team (this pauses the AI)…"}
          className="field min-h-12 flex-1 resize-none"
        />
        <button disabled={pending || !text.trim()} className="min-h-11 rounded-full bg-charcoal px-5 text-sm text-ivory disabled:opacity-40">
          {pending ? "Sending…" : "Send"}
        </button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
